import config from '../config/index.js';
import db from '../database/db.js';
import cachedDb from './cachedDbService.js';
import discogsService from './discogsService.js';
import boardGameGeekService from './boardGameGeekService.js';

class SyncService {
    constructor() {
        this.syncInterval = null;
        this.isRunning = false;
    }

    async performInitialSync() {
        console.log('Starting initial data sync...');

        const syncPromises = [];

        if (config.features.recordsEnabled) {
            syncPromises.push(this.syncRecords());
        }

        if (config.features.boardGamesEnabled) {
            syncPromises.push(this.syncBoardGames());
        }

        await Promise.allSettled(syncPromises);
        console.log('Initial sync completed');
    }

    startPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(async () => {
            if (!this.isRunning) {
                await this.performSync();
            }
        }, config.api.refreshFrequencyMs);

        console.log(`Periodic sync scheduled every ${config.api.refreshFrequencyMs / 1000 / 60} minutes`);
    }

    async performSync() {
        if (this.isRunning) {
            console.log('Sync already in progress, skipping...');
            return;
        }

        this.isRunning = true;
        console.log('Starting periodic sync...');

        try {
            const syncPromises = [];

            if (config.features.recordsEnabled) {
                syncPromises.push(this.syncRecords());
            }

            if (config.features.boardGamesEnabled) {
                syncPromises.push(this.syncBoardGames());
            }

            await Promise.allSettled(syncPromises);
            console.log('Periodic sync completed');
        } catch (error) {
            console.error('Error during sync:', error);
        } finally {
            this.isRunning = false;
        }
    }

    async syncRecords() {
        console.log('Syncing records from Discogs...');

        try {
            await this.updateSyncStatus('discogs', true);

            // Fetch collection and wishlist
            console.log('Fetching items from Discogs API...');
            const [collectionItems, wishlistItems] = await Promise.all([
                discogsService.getAllCollectionItems(),
                discogsService.getAllWantlistItems()
            ]);
            
            console.log(`Fetched ${collectionItems.length} collection items and ${wishlistItems.length} wishlist items`);

            // Transform and upsert collection items with parallel processing
            console.log(`Processing ${collectionItems.length} collection items...`);
            await this.processRecordsInParallel(collectionItems, false);

            // Transform and upsert wishlist items with parallel processing
            console.log(`Processing ${wishlistItems.length} wishlist items...`);
            await this.processRecordsInParallel(wishlistItems, true);

            await this.updateSyncStatus('discogs', false, null);
            console.log(`Records sync completed: ${collectionItems.length} collection, ${wishlistItems.length} wishlist`);

        } catch (error) {
            console.error('Records sync failed:', error);
            await this.updateSyncStatus('discogs', false, error.message);
            throw error;
        }
    }

    async syncBoardGames() {
        console.log('Syncing board games from BoardGameGeek...');

        try {
            await this.updateSyncStatus('boardgamegeek', true);

            // Fetch collection and wishlist
            const [collectionItems, wishlistItems] = await Promise.all([
                boardGameGeekService.getAllCollectionItems(),
                boardGameGeekService.getAllWishlistItems()
            ]);

            // Transform collection items
            const collectionGames = collectionItems.map(item => 
                boardGameGeekService.transformToBoardGame(item, false)
            );

            // Transform wishlist items
            const wishlistGames = wishlistItems.map(item => 
                boardGameGeekService.transformToBoardGame(item, true)
            );

            // Enrich with detailed data (optional, can be disabled for faster sync)
            const allGames = [...collectionGames, ...wishlistGames];
            const enrichedGames = await boardGameGeekService.enrichGameData(allGames);

            // Upsert to database with image downloading
            for (const game of enrichedGames) {
                const gameWithImages = await boardGameGeekService.downloadBoardGameImages(game);
                await cachedDb.upsert('board_games', gameWithImages, ['external_id']);
            }

            await this.updateSyncStatus('boardgamegeek', false, null);
            console.log(`Board games sync completed: ${collectionGames.length} collection, ${wishlistGames.length} wishlist`);

        } catch (error) {
            console.error('Board games sync failed:', error);
            await this.updateSyncStatus('boardgamegeek', false, error.message);
            throw error;
        }
    }

    async updateSyncStatus(service, inProgress, errorMessage = null) {
        const updateData = {
            sync_in_progress: inProgress,
            error_message: errorMessage
        };

        if (!inProgress) {
            updateData.last_sync_at = new Date();
        }

        await cachedDb.update('sync_status', updateData, { service });
    }

    /**
     * Process records in parallel with controlled concurrency
     * @param {Array} items - Record items from API
     * @param {boolean} isWishlist - Whether these are wishlist items
     */
    async processRecordsInParallel(items, isWishlist) {
        const BATCH_SIZE = 3; // Process 3 records concurrently (respects rate limits)
        const chunks = this.chunkArray(items, BATCH_SIZE);
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`Processing batch ${i + 1}/${chunks.length} (${chunk.length} records)...`);
            
            // Process batch in parallel
            const promises = chunk.map(async (item) => {
                try {
                    const record = discogsService.transformToRecord(item, isWishlist);
                    console.log(`Processing ${isWishlist ? 'wishlist ' : ''}record: ${record.artist} - ${record.title}, has image URL: ${!!record.cover_image_url}`);
                    
                    const recordWithImages = await discogsService.downloadRecordImages(record);
                    await cachedDb.upsert('records', recordWithImages, ['external_id']);
                    
                    return { success: true, record: record.title };
                } catch (error) {
                    console.error(`Failed to process record:`, error.message);
                    return { success: false, error: error.message };
                }
            });
            
            // Wait for batch to complete
            const results = await Promise.allSettled(promises);
            
            // Log batch results
            const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            const failed = results.length - successful;
            
            if (failed > 0) {
                console.warn(`Batch ${i + 1} completed: ${successful} successful, ${failed} failed`);
            } else {
                console.log(`Batch ${i + 1} completed successfully (${successful} records)`);
            }
            
            // Small delay between batches to be respectful of APIs
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    /**
     * Split array into chunks
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    async getSyncStatus() {
        return await cachedDb.findMany('sync_status');
    }

    async stop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        // Wait for any running sync to complete
        while (this.isRunning) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('Sync service stopped');
    }

    // Manual sync triggers
    async syncRecordsManually() {
        if (this.isRunning) {
            throw new Error('Sync already in progress');
        }

        this.isRunning = true;
        try {
            await this.syncRecords();
        } finally {
            this.isRunning = false;
        }
    }

    async syncBoardGamesManually() {
        if (this.isRunning) {
            throw new Error('Sync already in progress');
        }

        this.isRunning = true;
        try {
            await this.syncBoardGames();
        } finally {
            this.isRunning = false;
        }
    }
}

export default new SyncService();