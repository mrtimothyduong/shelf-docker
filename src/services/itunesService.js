import fetch from 'node-fetch';
import Fuse from 'fuse.js';
import config from '../config/index.js';

/**
 * iTunes Search Service
 * Searches iTunes Store API for high-resolution album artwork and release dates
 * Uses Fuse.js for fuzzy matching to handle variations in artist/album names
 * Based on the original shelf-3.2.4-og iTunes integration
 */
class ITunesService {
    constructor() {
        this.baseUrl = 'https://itunes.apple.com/search';
        // Use original shelf-style user agent (application-specific, not browser-mimicking)
        const userId = config.discogs.userId || 'anonymous';
        this.userAgent = `${userId} Shelf/2.0 +https://github.com/shelf`;
        this.maxArtSize = config.api.maxArtSize;
        
        // Rate limiting - use original pattern (20 calls per minute)
        this.remainingCalls = 20;
        this.rateLimitWindow = 60; // seconds (not milliseconds like before)
    }

    /**
     * Search iTunes for album and get high-res artwork + original release date
     * @param {string} title - Album title
     * @param {string} artist - Artist name
     * @returns {Promise<[string|null, number|null]>} - [imageUrl, yearOfOriginalRelease]
     */
    async searchAlbum(title, artist) {
        try {
            // Check rate limiting
            await this.respectRateLimit();

            // Clean and prepare search terms
            const searchTerm = this.sanitizeSearchTerm(`${title} ${artist}`);
            const url = `${this.baseUrl}?entity=album&limit=100&term=${encodeURIComponent(searchTerm)}`;

            console.log(`Searching iTunes for: ${artist} - ${title}`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Content-Type': 'application/json'  // Only minimal headers like original
                },
                timeout: config.api.requestTimeoutMs
            });

            if (!response.ok) {
                throw new Error(`iTunes API error: ${response.status} ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('text/javascript')) {
                throw new Error(`Unexpected content type: ${contentType}`);
            }

            const data = await response.json();
            this.remainingCalls--;

            // No additional delay needed with proper rate limiting

            if (data.resultCount === 0) {
                console.log(`No iTunes results for: ${artist} - ${title}`);
                return [null, null];
            }

            // Use fuzzy search to find best match
            const [imageUrl, originalReleaseYear] = this.findBestMatch(data.results, artist, title);
            
            if (imageUrl) {
                console.log(`iTunes match found for: ${artist} - ${title}`);
                return [this.upgradeImageUrl(imageUrl), originalReleaseYear];
            } else {
                console.log(`No good iTunes match for: ${artist} - ${title}`);
                return [null, null];
            }

        } catch (error) {
            console.error(`iTunes search failed for ${artist} - ${title}:`, error.message);
            return [null, null];
        }
    }

    /**
     * Find the best matching album using fuzzy search
     * @param {Array} results - iTunes search results
     * @param {string} artist - Target artist name
     * @param {string} title - Target album title
     * @returns {[string|null, number|null]} - [imageUrl, year]
     */
    findBestMatch(results, artist, title) {
        // First, fuzzy match on artist name
        const artistFuse = new Fuse(results, {
            shouldSort: true,
            threshold: 0.8,
            location: 0,
            distance: 100,
            maxPatternLength: 32,
            minMatchCharLength: 1,
            keys: ['artistName']
        });

        const artistMatches = artistFuse.search(artist);
        
        if (artistMatches.length === 0) {
            return [null, null];
        }

        // Then, fuzzy match on album title from artist matches
        const titleFuse = new Fuse(artistMatches, {
            shouldSort: true,
            threshold: 0.8,
            location: 0,
            distance: 100,
            maxPatternLength: 32,
            minMatchCharLength: 1,
            keys: ['item.collectionName']
        });

        const titleMatches = titleFuse.search(title);

        if (titleMatches.length === 0) {
            return [null, null];
        }

        // Get the best match
        const bestMatch = titleMatches[0].item.item || titleMatches[0].item;
        
        const imageUrl = bestMatch.artworkUrl100;
        const releaseYear = bestMatch.releaseDate ? new Date(bestMatch.releaseDate).getUTCFullYear() : null;

        return [imageUrl, releaseYear];
    }

    /**
     * Upgrade iTunes image URL from 100x100 to higher resolution
     * @param {string} imageUrl - Original iTunes image URL
     * @returns {string} - High-resolution image URL
     */
    upgradeImageUrl(imageUrl) {
        if (!imageUrl) return null;
        
        // Replace 100x100 with desired size
        return imageUrl.replace('100x100', `${this.maxArtSize}x${this.maxArtSize}`);
    }

    /**
     * Clean search terms for iTunes API
     * @param {string} searchTerm - Raw search term
     * @returns {string} - Cleaned search term
     */
    sanitizeSearchTerm(searchTerm) {
        // No space replacement needed - encodeURIComponent handles it properly
        return searchTerm;
    }

    /**
     * Respect iTunes rate limiting (20 calls per minute) - original pattern
     */
    async respectRateLimit() {
        if (this.remainingCalls <= 1) {
            console.log(`iTunes rate limit reached, waiting ${this.rateLimitWindow} seconds...`);
            await new Promise(resolve => setTimeout(resolve, this.rateLimitWindow * 1000));
            this.remainingCalls = 20;
        }
    }

    /**
     * Validate that the original release year makes sense
     * Original release should not be after the pressing/release year
     * @param {number} originalYear - Year from iTunes
     * @param {number} pressingYear - Year from Discogs
     * @returns {number|null} - Valid year or null
     */
    validateReleaseYear(originalYear, pressingYear) {
        if (!originalYear || !pressingYear) return originalYear;
        
        // Original release can't be after pressing year
        if (originalYear > pressingYear) {
            console.log(`Invalid iTunes year: original ${originalYear} > pressing ${pressingYear}`);
            return null;
        }
        
        return originalYear;
    }
}

export default new ITunesService();