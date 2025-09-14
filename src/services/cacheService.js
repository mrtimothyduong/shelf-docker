/**
 * In-Memory Cache Service
 * Provides fast caching layer for database queries and expensive operations
 * Features: TTL expiration, cache invalidation, memory usage monitoring
 */
class CacheService {
    constructor() {
        this.cache = new Map();
        this.ttls = new Map(); // Store TTL timestamps
        this.defaultTtl = 15 * 60 * 1000; // 15 minutes in milliseconds
        this.maxCacheSize = 1000; // Maximum cache entries
        
        // Start cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000); // Run cleanup every minute
        
        console.log('Cache service initialized');
    }

    /**
     * Generate cache key from multiple parameters
     */
    generateKey(...parts) {
        return parts.map(part => 
            typeof part === 'object' ? JSON.stringify(part) : String(part)
        ).join(':');
    }

    /**
     * Store value in cache with TTL
     */
    set(key, value, ttl = this.defaultTtl) {
        // If cache is full, remove oldest entries
        if (this.cache.size >= this.maxCacheSize) {
            this.evictOldest();
        }

        const expiryTime = Date.now() + ttl;
        this.cache.set(key, value);
        this.ttls.set(key, expiryTime);
        
        console.log(`Cache SET: ${key} (TTL: ${Math.round(ttl/1000)}s)`);
    }

    /**
     * Get value from cache
     */
    get(key) {
        const expiryTime = this.ttls.get(key);
        
        // Check if key exists and is not expired
        if (!expiryTime || Date.now() > expiryTime) {
            this.delete(key);
            return null;
        }

        const value = this.cache.get(key);
        console.log(`Cache HIT: ${key}`);
        return value;
    }

    /**
     * Check if key exists and is not expired
     */
    has(key) {
        const expiryTime = this.ttls.get(key);
        
        if (!expiryTime || Date.now() > expiryTime) {
            this.delete(key);
            return false;
        }

        return this.cache.has(key);
    }

    /**
     * Delete specific key
     */
    delete(key) {
        this.cache.delete(key);
        this.ttls.delete(key);
        console.log(`Cache DELETE: ${key}`);
    }

    /**
     * Clear all cache entries
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.ttls.clear();
        console.log(`Cache CLEAR: Removed ${size} entries`);
    }

    /**
     * Invalidate cache entries by pattern
     */
    invalidatePattern(pattern) {
        let removed = 0;
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.delete(key);
                removed++;
            }
        }
        console.log(`Cache INVALIDATE: Pattern "${pattern}" removed ${removed} entries`);
        return removed;
    }

    /**
     * Remove expired entries
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;
        
        for (const [key, expiryTime] of this.ttls.entries()) {
            if (now > expiryTime) {
                this.delete(key);
                removed++;
            }
        }
        
        if (removed > 0) {
            console.log(`Cache CLEANUP: Removed ${removed} expired entries`);
        }
    }

    /**
     * Evict oldest entries when cache is full
     */
    evictOldest() {
        // Remove 10% of cache entries (oldest first)
        const entriesToRemove = Math.ceil(this.cache.size * 0.1);
        const sortedEntries = Array.from(this.ttls.entries())
            .sort(([,a], [,b]) => a - b)
            .slice(0, entriesToRemove);
            
        for (const [key] of sortedEntries) {
            this.delete(key);
        }
        
        console.log(`Cache EVICT: Removed ${entriesToRemove} oldest entries`);
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const totalEntries = this.cache.size;
        const memoryUsage = this.estimateMemoryUsage();
        
        return {
            totalEntries,
            maxCacheSize: this.maxCacheSize,
            utilizationPercent: Math.round((totalEntries / this.maxCacheSize) * 100),
            estimatedMemoryKB: Math.round(memoryUsage / 1024)
        };
    }

    /**
     * Estimate memory usage (rough calculation)
     */
    estimateMemoryUsage() {
        let size = 0;
        for (const [key, value] of this.cache.entries()) {
            size += key.length * 2; // UTF-16 characters
            size += JSON.stringify(value).length * 2;
        }
        return size;
    }

    /**
     * Shutdown cache service
     */
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.clear();
        console.log('Cache service shutdown');
    }
}

export default new CacheService();