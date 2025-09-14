import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import { Liquid } from 'liquidjs';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import config from './config/index.js';
import db from './database/db.js';
import cachedDb from './services/cachedDbService.js';
import cleanJsonData from './database/cleanJsonData.js';
import imageService from './services/imageService.js';
import * as socketCodes from './common/socketCodes.js';
import recordsRouter from './routes/records.js';
import boardGamesRouter from './routes/boardGames.js';
import booksRouter from './routes/books.js';
import apiRouter from './routes/api.js';
import syncService from './services/syncService.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ShelfApp {
    constructor() {
        this.app = express();
        this.server = null;
        this.liquid = null;
        this.io = null;
        
        // Sync status tracking
        this.syncStatus = {
            recordsInProgress: false,
            boardGamesInProgress: false,
            booksInProgress: false
        };
    }

    async initialize() {
        // Connect to database
        await db.connect();
        
        // Run database migrations
        try {
            await db.migrate();
        } catch (err) {
            if (!err.message.includes('already exists')) {
                throw err;
            }
            console.log('Database schema already exists');
        }

        // Clean up any malformed JSON data
        try {
            await cleanJsonData();
        } catch (err) {
            console.warn('JSON cleanup failed (this is ok if database is empty):', err.message);
        }

        // Setup Express app
        this.setupMiddleware();
        this.setupTemplateEngine();
        this.setupRoutes();
        this.setupErrorHandling();

        console.log('Shelf application initialized successfully');
    }

    setupMiddleware() {
        // Compression
        this.app.use(compression());

        // Static files
        this.app.use(express.static(path.join(__dirname, '../public')));

        // JSON parsing
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Set view engine
        this.app.set('view engine', 'liquid');
        this.app.set('views', path.join(__dirname, '../views/_layouts'));
    }

    setupTemplateEngine() {
        this.liquid = new Liquid({
            root: [
                path.join(__dirname, '../views'),
                path.join(__dirname, '../views/_includes'),
                path.join(__dirname, '../views/_layouts')
            ],
            extname: '.liquid',
            cache: config.nodeEnv === 'production'
        });

        this.app.engine('liquid', this.liquid.express());
    }

    setupRoutes() {
        // API routes
        this.app.use('/api', apiRouter);

        // Main page routes
        this.app.use('/', recordsRouter);
        this.app.use('/record', recordsRouter); // Also mount records at /record for wishlist URL
        this.app.use('/game', boardGamesRouter);
        this.app.use('/book', booksRouter);

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                features: config.features
            });
        });

        // Cache status endpoint
        this.app.get('/cache-status', (req, res) => {
            const cacheStats = cachedDb.getStats();
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                cache: cacheStats
            });
        });

        // Static page routes
        this.app.get('/about', (req, res) => {
            res.render('about', {
                siteTitle: config.siteTitle,
                publicUrl: config.publicUrl,
                ownerName: config.ownerName || 'Library Owner',
                twitterHandle: config.twitterHandle || '',
                recordShelfEnabled: config.features.recordsEnabled,
                boardGameShelfEnabled: config.features.boardGamesEnabled,
                bookShelfEnabled: config.features.booksEnabled,
                menu: 'about'
            });
        });

        this.app.get('/acknowledgements', (req, res) => {
            res.render('acknowledgements', {
                siteTitle: config.siteTitle,
                publicUrl: config.publicUrl,
                recordShelfEnabled: config.features.recordsEnabled,
                boardGameShelfEnabled: config.features.boardGamesEnabled,
                bookShelfEnabled: config.features.booksEnabled,
                menu: 'acknowledgements'
            });
        });

        // Contribute page - redirect to GitHub
        this.app.get('/contribute', (req, res) => {
            res.redirect('https://github.com/anthropics/shelf-v2');
        });

        // Initialize image service directories (sync version)
        imageService.initializeDirectories().catch(console.error);

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).render('error', { 
                error: 'Page not found',
                siteTitle: config.siteTitle,
                publicUrl: config.publicUrl
            });
        });
    }

    setupErrorHandling() {
        // Global error handler
        this.app.use((err, req, res, next) => {
            console.error('Application error:', err);

            if (res.headersSent) {
                return next(err);
            }

            const statusCode = err.statusCode || 500;
            const message = config.nodeEnv === 'production' ? 'Internal Server Error' : err.message;

            res.status(statusCode).render('error', {
                error: message,
                siteTitle: config.siteTitle,
                publicUrl: config.publicUrl
            });
        });
    }

    setupSocketIO() {
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: "*", // Configure this properly for production
                methods: ["GET", "POST"]
            }
        });

        this.io.on('connection', (socket) => {
            console.log('Client connected to Socket.IO');

            // Handle client requests for data
            socket.on(socketCodes.INITIAL_RECORD_COLLECTION_IN_PROGRESS, () => {
                socket.emit(socketCodes.INITIAL_RECORD_COLLECTION_IN_PROGRESS, this.syncStatus.recordsInProgress);
            });

            socket.on(socketCodes.RECORD_COLLECTION, async () => {
                try {
                    const records = await cachedDb.findMany('records', { in_collection: true }, 'sort_artist, year_of_original_release, title');
                    const transformedRecords = this.transformRecordsForClient(records);
                    socket.emit(socketCodes.RECORD_COLLECTION, transformedRecords);
                } catch (error) {
                    console.error('Error fetching records for socket:', error);
                    socket.emit(socketCodes.SYNC_ERROR, 'Failed to fetch records');
                }
            });

            socket.on(socketCodes.RECORD_WISHLIST, async () => {
                try {
                    const records = await cachedDb.findMany('records', { in_wishlist: true }, 'sort_artist, year_of_original_release, title');
                    const transformedRecords = this.transformRecordsForClient(records);
                    socket.emit(socketCodes.RECORD_WISHLIST, transformedRecords);
                } catch (error) {
                    console.error('Error fetching wishlist for socket:', error);
                    socket.emit(socketCodes.SYNC_ERROR, 'Failed to fetch wishlist');
                }
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected from Socket.IO');
            });
        });

        console.log('Socket.IO server initialized');
    }

    transformRecordsForClient(records) {
        // Transform database records to match frontend expectations
        return records.map(record => ({
            _id: record.id, // Vue template expects _id
            id: record.id,
            artist: record.artist,
            sortArtist: record.sort_artist || record.artist,
            title: record.title,
            yearOfOriginalRelease: record.year_of_original_release,
            yearOfRelease: record.year_of_release,
            format: record.format,
            country: record.country,
            label: record.label,
            catalogNumber: record.catalog_number,
            genres: this.safeJsonParse(record.genres, []),
            styles: this.safeJsonParse(record.styles, []),
            thumbUrl: record.thumb_url,
            coverImageUrl: record.discogs_image_local_path || record.cover_image_local_path || record.cover_image_url || record.thumb_url || '/images/records/missing-artwork.png',
            discogsUrl: `https://www.discogs.com/release/${record.external_id}`,
            dateAdded: record.date_added
        }));
    }

    safeJsonParse(data, fallback = []) {
        if (!data || data === 'null' || data === 'undefined' || data === '') return fallback;
        if (Array.isArray(data) || typeof data === 'object') return data;
        if (typeof data === 'string') {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.warn('Failed to parse JSON string:', data);
                return fallback;
            }
        }
        return fallback;
    }

    async startSyncServices() {
        console.log('Starting sync services...');
        
        // Start initial sync
        await syncService.performInitialSync();
        
        // Schedule recurring syncs
        syncService.startPeriodicSync();
        
        console.log('Sync services started');
    }

    async start() {
        await this.initialize();

        this.server = createServer(this.app);
        
        // Setup Socket.IO
        this.setupSocketIO();

        this.server.listen(config.port, () => {
            console.log(`Shelf server running on port ${config.port}`);
            console.log(`Environment: ${config.nodeEnv}`);
            console.log(`Site: ${config.publicUrl}`);
            console.log(`Features enabled:`, config.features);
            
            // Start sync services in background (non-blocking)
            this.startSyncServices().catch(error => {
                console.error('Sync services failed to start:', error);
            });
            
            // Preload cache in background
            cachedDb.preloadCache().catch(error => {
                console.error('Cache preloading failed:', error);
            });
        });

        // Graceful shutdown
        process.on('SIGINT', () => this.shutdown('SIGINT'));
        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    }

    async shutdown(signal) {
        console.log(`Received ${signal}, shutting down gracefully...`);

        if (this.server) {
            this.server.close(() => {
                console.log('HTTP server closed');
            });
        }

        try {
            await syncService.stop();
            await cachedDb.close(); // This will also shutdown cache and close db
            console.log('Shutdown complete');
            process.exit(0);
        } catch (err) {
            console.error('Error during shutdown:', err);
            process.exit(1);
        }
    }
}

// Start the application
const app = new ShelfApp();
app.start().catch(err => {
    console.error('Failed to start application:', err);
    process.exit(1);
});

export default ShelfApp;