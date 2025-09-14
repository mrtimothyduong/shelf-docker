import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import fetch from 'node-fetch';
import config from '../config/index.js';

/**
 * Image service for downloading, processing, and caching external images locally
 * Adapted from the original Shelf image caching system
 */
class ImageService {
    constructor() {
        this.requestTimeoutMs = config.api.requestTimeoutMs;
        this.maxImageSize = config.api.maxArtSize;
        this.userAgent = config.discogs.userAgent;
        
        // Base directories for image caching
        this.baseImagePath = './public/images';
        this.recordsPath = path.join(this.baseImagePath, 'records');
        this.boardGamesPath = path.join(this.baseImagePath, 'board-games');
        this.booksPath = path.join(this.baseImagePath, 'books');
    }

    /**
     * Check if an image already exists and is valid
     * @param {string} filePath - Full path to the image file
     * @returns {Promise<boolean>} - True if image exists and is valid
     */
    async validateExistingImage(filePath) {
        try {
            const stats = await fs.stat(filePath);
            if (stats.size === 0) {
                console.log(`Empty image file found, will re-download: ${filePath}`);
                return false;
            }
            
            // Check if it's a valid image by trying to read its metadata
            await sharp(filePath).metadata();
            console.log(`Valid cached image found: ${filePath}`);
            return true;
        } catch (error) {
            // File doesn't exist or is corrupted
            return false;
        }
    }

    /**
     * Downloads an image from a URL and saves it locally with resizing
     * @param {string} url - The image URL to download
     * @param {string} destinationDirectoryPath - Directory to save the image
     * @param {string} destinationFilename - Filename for the saved image
     * @param {Object} customHeaders - Additional HTTP headers
     * @param {Function} rateLimiter - Optional rate limiting function
     * @returns {Promise<string|null>} - Returns the local file path or null if failed
     */
    async downloadImage(url, destinationDirectoryPath, destinationFilename, customHeaders = {}, rateLimiter = null) {
        if (!url || !url.startsWith('http')) {
            console.warn('Invalid image URL provided:', url);
            return null;
        }

        try {
            const headers = {
                'User-Agent': this.userAgent,
                ...customHeaders
            };

            console.log(`Downloading image from ${url}...`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);
            
            const response = await fetch(url, {
                method: 'GET',
                headers,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (rateLimiter && typeof rateLimiter === 'function') {
                await rateLimiter(response.headers, url);
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Check if response is actually an image
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                throw new Error('Unexpected server response, got HTML document instead of image');
            }

            // Ensure directory exists
            await this.ensureDirectoryExists(destinationDirectoryPath);

            const filepath = path.join(destinationDirectoryPath, destinationFilename);
            const imageBuffer = await response.arrayBuffer();

            // Process and resize image with Sharp
            const artOptions = {
                fit: sharp.fit.inside,
                withoutEnlargement: false
            };

            await sharp(Buffer.from(imageBuffer))
                .resize(this.maxImageSize, this.maxImageSize, artOptions)
                .jpeg({ quality: 85 }) // Convert to JPEG for consistency
                .toFile(filepath);

            console.log(`Downloaded image: ${filepath}, content-type: ${contentType}, size: ${response.headers.get('content-length')}`);
            
            return filepath;

        } catch (error) {
            console.error('Image download failed:', error.message, 'URL:', url);
            return null;
        }
    }

    /**
     * Ensures a directory exists, creating it if necessary
     * @param {string} directoryPath - The directory path to ensure exists
     */
    async ensureDirectoryExists(directoryPath) {
        try {
            await fs.access(directoryPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                try {
                    await fs.mkdir(directoryPath, { recursive: true });
                    console.log(`Created directory: ${directoryPath}`);
                } catch (mkdirError) {
                    console.error('Failed to create directory:', mkdirError);
                    throw mkdirError;
                }
            } else {
                throw error;
            }
        }
    }

    /**
     * Downloads Discogs album art for a record
     * @param {string} recordId - The record ID
     * @param {string} imageUrl - The Discogs image URL
     * @param {string} token - Discogs API token
     * @returns {Promise<string|null>} - Local file path or null
     */
    async downloadRecordImage(recordId, imageUrl, token, imageType = 'discogs') {
        if (!imageUrl) return null;

        const recordDir = path.join(this.recordsPath, `record${recordId}`);
        const filename = imageType === 'discogs' ? 'discogs-album-art.jpg' : 'itunes-album-art.jpg';
        const fullPath = path.join(recordDir, filename);
        
        // Check if valid cached image already exists
        if (await this.validateExistingImage(fullPath)) {
            return `/images/records/record${recordId}/${filename}`;
        }
        
        const headers = token ? { 'Authorization': `Discogs token=${token}` } : {};
        
        const filepath = await this.downloadImage(imageUrl, recordDir, filename, headers);
        
        // Return web-accessible path
        if (filepath) {
            return `/images/records/record${recordId}/${filename}`;
        }
        
        return null;
    }

    /**
     * Downloads BoardGameGeek image for a board game
     * @param {string} gameId - The board game ID
     * @param {string} imageUrl - The BGG image URL
     * @returns {Promise<string|null>} - Local file path or null
     */
    async downloadBoardGameImage(gameId, imageUrl) {
        if (!imageUrl) return null;

        const gameDir = path.join(this.boardGamesPath, `boardgame${gameId}`);
        const filename = 'board-game-cover-art.jpg';
        
        const filepath = await this.downloadImage(imageUrl, gameDir, filename);
        
        // Return web-accessible path
        if (filepath) {
            return `/images/board-games/boardgame${gameId}/${filename}`;
        }
        
        return null;
    }

    /**
     * Downloads book cover image
     * @param {string} bookId - The book ID
     * @param {string} imageUrl - The book cover image URL
     * @returns {Promise<string|null>} - Local file path or null
     */
    async downloadBookImage(bookId, imageUrl) {
        if (!imageUrl) return null;

        const bookDir = path.join(this.booksPath, `book${bookId}`);
        const filename = 'book-cover-art.jpg';
        
        const filepath = await this.downloadImage(imageUrl, bookDir, filename);
        
        // Return web-accessible path
        if (filepath) {
            return `/images/books/book${bookId}/${filename}`;
        }
        
        return null;
    }

    /**
     * Rate limiting function for API requests
     * @param {Headers} responseHeaders - Response headers from the API
     * @param {string} url - The requested URL
     */
    async respectRateLimits(responseHeaders, url) {
        // Simple rate limiting - wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, config.api.rateLimitDelay));
    }

    /**
     * Cleans up cached images for a specific record/game/book
     * @param {string} type - 'records', 'board-games', or 'books'
     * @param {string} itemId - The item ID
     */
    async cleanupItemImages(type, itemId) {
        const typeMap = {
            'records': { dir: this.recordsPath, prefix: 'record' },
            'board-games': { dir: this.boardGamesPath, prefix: 'boardgame' },
            'books': { dir: this.booksPath, prefix: 'book' }
        };

        const config = typeMap[type];
        if (!config) {
            throw new Error(`Invalid type: ${type}`);
        }

        const itemDir = path.join(config.dir, `${config.prefix}${itemId}`);
        
        try {
            await fs.rm(itemDir, { recursive: true, force: true });
            console.log(`Cleaned up images for ${type} ${itemId}`);
        } catch (error) {
            console.error(`Failed to cleanup images for ${type} ${itemId}:`, error);
        }
    }

    /**
     * Initialize base image directories
     */
    async initializeDirectories() {
        const directories = [
            this.baseImagePath,
            this.recordsPath,
            this.boardGamesPath,
            this.booksPath
        ];

        for (const dir of directories) {
            await this.ensureDirectoryExists(dir);
        }

        console.log('Image service directories initialized');
    }
}

export default new ImageService();