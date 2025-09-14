#!/usr/bin/env node

/**
 * Image Cache Cleanup Utility
 * Cleans cached images for Shelf v2
 * Usage: node scripts/cleanImageCache.js [options]
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const IMAGE_BASE_PATH = path.resolve(__dirname, '../public/images');
const TYPES = {
    records: {
        directory: 'records',
        pattern: /^record\d+$/,
        files: ['discogs-album-art.jpg', 'itunes-album-art.jpg']
    },
    'board-games': {
        directory: 'board-games',
        pattern: /^boardgame\d+$/,
        files: ['board-game-cover-art.jpg']
    },
    books: {
        directory: 'books',
        pattern: /^book\d+$/,
        files: ['book-cover-art.jpg']
    }
};

class ImageCacheCleaner {
    constructor() {
        this.dryRun = false;
        this.verbose = false;
        this.statistics = {
            directoriesRemoved: 0,
            filesRemoved: 0,
            bytesFreed: 0,
            errors: 0
        };
    }

    async getDirectorySize(dirPath) {
        let size = 0;
        try {
            const stats = await fs.stat(dirPath);
            if (stats.isDirectory()) {
                const files = await fs.readdir(dirPath);
                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    const fileStats = await fs.stat(filePath);
                    if (fileStats.isFile()) {
                        size += fileStats.size;
                    }
                }
            }
        } catch (error) {
            console.warn(`Warning: Could not calculate size for ${dirPath}: ${error.message}`);
        }
        return size;
    }

    async cleanTypeDirectory(type, config) {
        const typeDir = path.join(IMAGE_BASE_PATH, config.directory);
        
        try {
            const entries = await fs.readdir(typeDir, { withFileTypes: true });
            const cacheDirectories = entries
                .filter(entry => entry.isDirectory() && config.pattern.test(entry.name))
                .map(entry => entry.name);

            console.log(`Found ${cacheDirectories.length} cache directories for ${type}`);

            for (const cacheDir of cacheDirectories) {
                await this.cleanCacheDirectory(path.join(typeDir, cacheDir), config.files);
            }

        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`Directory ${typeDir} does not exist, skipping ${type}`);
            } else {
                console.error(`Error cleaning ${type}:`, error.message);
                this.statistics.errors++;
            }
        }
    }

    async cleanCacheDirectory(dirPath, expectedFiles) {
        try {
            // Calculate directory size before deletion
            const sizeBefore = await this.getDirectorySize(dirPath);
            
            if (this.verbose) {
                console.log(`Cleaning cache directory: ${path.basename(dirPath)}`);
            }

            // Remove individual cache files
            for (const file of expectedFiles) {
                const filePath = path.join(dirPath, file);
                try {
                    if (!this.dryRun) {
                        await fs.unlink(filePath);
                    }
                    this.statistics.filesRemoved++;
                    if (this.verbose) {
                        console.log(`  Removed file: ${file}`);
                    }
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.warn(`Warning: Could not remove ${filePath}: ${error.message}`);
                    }
                }
            }

            // Try to remove the directory if it's empty
            try {
                if (!this.dryRun) {
                    await fs.rmdir(dirPath);
                }
                this.statistics.directoriesRemoved++;
                this.statistics.bytesFreed += sizeBefore;
                if (this.verbose) {
                    console.log(`  Removed directory: ${path.basename(dirPath)}`);
                }
            } catch (error) {
                if (error.code !== 'ENOTEMPTY' && error.code !== 'ENOENT') {
                    console.warn(`Warning: Could not remove directory ${dirPath}: ${error.message}`);
                }
            }

        } catch (error) {
            console.error(`Error cleaning cache directory ${dirPath}:`, error.message);
            this.statistics.errors++;
        }
    }

    async cleanSpecificItem(type, itemId) {
        const config = TYPES[type];
        if (!config) {
            throw new Error(`Invalid type: ${type}. Valid types are: ${Object.keys(TYPES).join(', ')}`);
        }

        const prefix = type === 'board-games' ? 'boardgame' : type === 'books' ? 'book' : 'record';
        const dirName = `${prefix}${itemId}`;
        const targetDir = path.join(IMAGE_BASE_PATH, config.directory, dirName);

        console.log(`Cleaning specific ${type} item: ${itemId}`);
        await this.cleanCacheDirectory(targetDir, config.files);
    }

    async cleanAll() {
        console.log('Starting image cache cleanup...');
        console.log(`Image base path: ${IMAGE_BASE_PATH}`);
        console.log(`Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE'}`);
        console.log('');

        for (const [type, config] of Object.entries(TYPES)) {
            console.log(`Cleaning ${type}...`);
            await this.cleanTypeDirectory(type, config);
            console.log('');
        }

        this.printSummary();
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    printSummary() {
        console.log('Cleanup Summary:');
        console.log('================');
        console.log(`Files removed: ${this.statistics.filesRemoved}`);
        console.log(`Directories removed: ${this.statistics.directoriesRemoved}`);
        console.log(`Space freed: ${this.formatBytes(this.statistics.bytesFreed)}`);
        console.log(`Errors: ${this.statistics.errors}`);
        
        if (this.dryRun) {
            console.log('');
            console.log('NOTE: This was a dry run. No files were actually deleted.');
            console.log('Run without --dry-run to perform the actual cleanup.');
        }
    }

    printUsage() {
        console.log('Usage: node scripts/cleanImageCache.js [options]');
        console.log('');
        console.log('Options:');
        console.log('  --dry-run              Preview what would be deleted without actually deleting');
        console.log('  --verbose              Show detailed output');
        console.log('  --type <type>          Clean only specific type (records, board-games, books)');
        console.log('  --item <type> <id>     Clean specific item (e.g., --item records 12345)');
        console.log('  --help                 Show this help message');
        console.log('');
        console.log('Examples:');
        console.log('  node scripts/cleanImageCache.js                    # Clean all cached images');
        console.log('  node scripts/cleanImageCache.js --dry-run          # Preview cleanup');
        console.log('  node scripts/cleanImageCache.js --type records     # Clean only records');
        console.log('  node scripts/cleanImageCache.js --item records 123 # Clean specific record');
    }
}

async function main() {
    const cleaner = new ImageCacheCleaner();
    const args = process.argv.slice(2);

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '--help':
            case '-h':
                cleaner.printUsage();
                process.exit(0);
                break;
                
            case '--dry-run':
                cleaner.dryRun = true;
                break;
                
            case '--verbose':
            case '-v':
                cleaner.verbose = true;
                break;
                
            case '--type':
                const type = args[++i];
                if (!type || !TYPES[type]) {
                    console.error(`Error: Invalid or missing type. Valid types: ${Object.keys(TYPES).join(', ')}`);
                    process.exit(1);
                }
                await cleaner.cleanTypeDirectory(type, TYPES[type]);
                cleaner.printSummary();
                process.exit(0);
                break;
                
            case '--item':
                const itemType = args[++i];
                const itemId = args[++i];
                if (!itemType || !itemId || !TYPES[itemType]) {
                    console.error('Error: --item requires type and id arguments');
                    process.exit(1);
                }
                await cleaner.cleanSpecificItem(itemType, itemId);
                cleaner.printSummary();
                process.exit(0);
                break;
                
            default:
                console.error(`Error: Unknown argument: ${arg}`);
                cleaner.printUsage();
                process.exit(1);
        }
    }

    // If no specific action was taken, clean all
    await cleaner.cleanAll();
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nOperation cancelled by user');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// Run the script
if (import.meta.url === `file://${__filename}`) {
    main().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}