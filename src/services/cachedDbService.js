import db from '../database/db.js';
import cacheService from './cacheService.js';

/**
 * Cached Database Service
 * Wraps database operations with intelligent caching
 */
class CachedDbService {
    constructor() {
        // Cache TTL configurations for different data types
        this.cacheTtls = {
            records: 10 * 60 * 1000,      // 10 minutes (changes during sync)
            board_games: 15 * 60 * 1000,  // 15 minutes
            books: 15 * 60 * 1000,        // 15 minutes
            sync_status: 30 * 1000,       // 30 seconds (frequently updated)
            static: 60 * 60 * 1000        // 1 hour for rarely changing data
        };
    }

    /**
     * Cached version of db.findMany
     */
    async findMany(table, conditions = {}, orderBy = null) {
        const cacheKey = cacheService.generateKey('findMany', table, conditions, orderBy);
        
        // Try cache first
        const cached = cacheService.get(cacheKey);
        if (cached !== null) {
            return cached;
        }

        // Cache miss - query database
        console.log(`Cache MISS: Querying database for ${table}`);
        const result = await db.findMany(table, conditions, orderBy);
        
        // Cache the result
        const ttl = this.cacheTtls[table] || this.cacheTtls.static;
        cacheService.set(cacheKey, result, ttl);
        
        return result;
    }

    /**
     * Cached version of db.findOne
     */
    async findOne(table, conditions = {}) {
        const cacheKey = cacheService.generateKey('findOne', table, conditions);
        
        // Try cache first
        const cached = cacheService.get(cacheKey);
        if (cached !== null) {
            return cached;
        }

        // Cache miss - query database
        console.log(`Cache MISS: Querying database for single ${table}`);
        const result = await db.findOne(table, conditions);
        
        // Cache the result
        const ttl = this.cacheTtls[table] || this.cacheTtls.static;
        cacheService.set(cacheKey, result, ttl);
        
        return result;
    }

    /**
     * Count records with caching
     */
    async count(table, conditions = {}) {
        const cacheKey = cacheService.generateKey('count', table, conditions);
        
        const cached = cacheService.get(cacheKey);
        if (cached !== null) {
            return cached;
        }

        console.log(`Cache MISS: Counting ${table}`);
        const result = await db.count(table, conditions);
        
        const ttl = this.cacheTtls[table] || this.cacheTtls.static;
        cacheService.set(cacheKey, result, ttl);
        
        return result;
    }

    /**
     * Non-cached write operations that invalidate cache
     */
    async create(table, data) {
        const result = await db.create(table, data);
        this.invalidateTable(table);
        return result;
    }

    async update(table, conditions, data) {
        const result = await db.update(table, conditions, data);
        this.invalidateTable(table);
        return result;
    }

    async upsert(table, data, conflictColumns) {
        const result = await db.upsert(table, data, conflictColumns);
        this.invalidateTable(table);
        return result;
    }

    async delete(table, conditions) {
        const result = await db.delete(table, conditions);
        this.invalidateTable(table);
        return result;
    }

    /**
     * Batch operations with cache invalidation
     */
    async batchUpsert(table, dataArray, conflictColumns) {
        const result = await db.batchUpsert(table, dataArray, conflictColumns);
        this.invalidateTable(table);
        return result;
    }

    /**
     * Invalidate all cache entries for a specific table
     */
    invalidateTable(table) {
        cacheService.invalidatePattern(`:${table}:`);
        console.log(`Cache invalidated for table: ${table}`);
    }

    /**
     * Invalidate cache entries by specific conditions
     */
    invalidateTableConditions(table, conditions = {}) {
        const pattern = cacheService.generateKey('', table, conditions);
        cacheService.invalidatePattern(pattern);
        console.log(`Cache invalidated for ${table} with conditions:`, conditions);
    }

    /**
     * Preload commonly accessed data into cache
     */
    async preloadCache() {
        console.log('Preloading cache with common queries...');
        
        try {
            // Preload record collections and wishlists
            await this.findMany('records', { in_collection: true }, 'sort_artist, year_of_original_release, title');
            await this.findMany('records', { in_wishlist: true }, 'sort_artist, year_of_original_release, title');
            
            // Preload board games if enabled
            await this.findMany('board_games', { in_collection: true }, 'sort_name');
            
            // Preload books if enabled  
            await this.findMany('books', { in_collection: true }, 'sort_author, title');
            
            console.log('Cache preloading completed');
        } catch (error) {
            console.error('Cache preloading failed:', error);
        }
    }

    /**
     * Get cache statistics including database-specific metrics
     */
    getStats() {
        const cacheStats = cacheService.getStats();
        
        return {
            ...cacheStats,
            ttlConfig: this.cacheTtls
        };
    }

    /**
     * Direct access to underlying database for special operations
     */
    get direct() {
        return db;
    }

    /**
     * Passthrough methods that don't need caching
     */
    async connect() {
        return db.connect();
    }

    async close() {
        cacheService.shutdown();
        return db.close();
    }

    async migrate() {
        return db.migrate();
    }

    async query(sql, params) {
        return db.query(sql, params);
    }
}

export default new CachedDbService();