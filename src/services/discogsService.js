import fetch from 'node-fetch';
import config from '../config/index.js';
import { setTimeout } from 'timers/promises';
import imageService from './imageService.js';
import itunesService from './itunesService.js';

class DiscogsService {
    constructor() {
        this.baseUrl = config.discogs.baseUrl;
        this.token = config.discogs.token;
        this.userId = config.discogs.userId;
        this.userAgent = config.discogs.userAgent;
    }

    async makeRequest(endpoint, params = {}) {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        
        // Add authentication token
        if (this.token) {
            url.searchParams.append('token', this.token);
        }

        // Add additional parameters
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });

        const options = {
            headers: {
                'User-Agent': this.userAgent,
                'Accept': 'application/json'
            },
            timeout: config.api.requestTimeoutMs
        };

        try {
            console.log(`Discogs API request: ${url.pathname}`);
            const response = await fetch(url.toString(), options);

            if (!response.ok) {
                throw new Error(`Discogs API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            // Respect rate limits
            await setTimeout(config.api.rateLimitDelay);
            
            return data;
        } catch (error) {
            console.error('Discogs API request failed:', error);
            throw error;
        }
    }

    async getUserCollection(page = 1, perPage = 100) {
        if (!this.userId) {
            throw new Error('Discogs user ID not configured');
        }

        const endpoint = `/users/${this.userId}/collection/folders/0/releases`;
        const params = {
            page: page.toString(),
            per_page: perPage.toString(),
            sort: 'added',
            sort_order: 'desc'
        };

        return await this.makeRequest(endpoint, params);
    }

    async getUserWantlist(page = 1, perPage = 100) {
        if (!this.userId) {
            throw new Error('Discogs user ID not configured');
        }

        const endpoint = `/users/${this.userId}/wants`;
        const params = {
            page: page.toString(),
            per_page: perPage.toString()
        };

        return await this.makeRequest(endpoint, params);
    }

    async getRelease(releaseId) {
        const endpoint = `/releases/${releaseId}`;
        return await this.makeRequest(endpoint);
    }

    async getMasterRelease(masterId) {
        const endpoint = `/masters/${masterId}`;
        return await this.makeRequest(endpoint);
    }

    async getAllCollectionItems() {
        const allItems = [];
        let page = 1;
        let hasMorePages = true;

        while (hasMorePages) {
            try {
                const response = await this.getUserCollection(page, 100);
                
                if (response.releases && response.releases.length > 0) {
                    allItems.push(...response.releases);
                    
                    // Check if there are more pages
                    hasMorePages = response.pagination && page < response.pagination.pages;
                    page++;
                    
                    console.log(`Fetched page ${page - 1}/${response.pagination?.pages || '?'} of Discogs collection`);
                } else {
                    hasMorePages = false;
                }
            } catch (error) {
                console.error(`Error fetching collection page ${page}:`, error);
                break;
            }
        }

        console.log(`Total collection items fetched: ${allItems.length}`);
        return allItems;
    }

    async getAllWantlistItems() {
        const allItems = [];
        let page = 1;
        let hasMorePages = true;

        while (hasMorePages) {
            try {
                const response = await this.getUserWantlist(page, 100);
                
                if (response.wants && response.wants.length > 0) {
                    allItems.push(...response.wants);
                    
                    // Check if there are more pages
                    hasMorePages = response.pagination && page < response.pagination.pages;
                    page++;
                    
                    console.log(`Fetched page ${page - 1}/${response.pagination?.pages || '?'} of Discogs wantlist`);
                } else {
                    hasMorePages = false;
                }
            } catch (error) {
                console.error(`Error fetching wantlist page ${page}:`, error);
                break;
            }
        }

        console.log(`Total wantlist items fetched: ${allItems.length}`);
        return allItems;
    }

    transformToRecord(item, isWishlist = false) {
        const basic_information = item.basic_information || item;
        
        return {
            external_id: basic_information.id?.toString(),
            artist: this.getMainArtist(basic_information.artists),
            sort_artist: this.getSortArtist(basic_information.artists),
            title: basic_information.title,
            year_of_original_release: basic_information.year,
            year_of_release: basic_information.year,
            format: this.getFormat(basic_information.formats),
            country: basic_information.country,
            label: this.getMainLabel(basic_information.labels),
            catalog_number: this.getCatalogNumber(basic_information.labels),
            genres: JSON.stringify(basic_information.genres || []),
            styles: JSON.stringify(basic_information.styles || []),
            thumb_url: basic_information.thumb,
            cover_image_url: this.getDiscogsImageUrl(basic_information),
            date_added: item.date_added ? new Date(item.date_added) : new Date(),
            in_collection: !isWishlist,
            in_wishlist: isWishlist
        };
    }

    /**
     * Downloads and caches Discogs + iTunes images for a record
     * @param {Object} record - The record object with external_id and cover_image_url
     * @returns {Object} - Record with updated local image paths and release year
     */
    async downloadRecordImages(record) {
        if (!record.external_id) {
            return record;
        }

        try {
            console.log(`Downloading images for record: ${record.artist} - ${record.title}`);
            
            // 1. Download Discogs image (lower quality but reliable)
            if (record.cover_image_url) {
                const discogsImagePath = await imageService.downloadRecordImage(
                    record.external_id,
                    record.cover_image_url,
                    this.token,
                    'discogs'
                );

                if (discogsImagePath) {
                    record.discogs_image_local_path = discogsImagePath;
                    record.cover_image_local_path = discogsImagePath; // Default to Discogs
                }
            }

            // 2. Search iTunes for higher quality image and original release year 
            // Re-enabled with original shelf-3.2.4-og request patterns to avoid 403 blocking
            if (true) { // Re-enabled with fixes from original implementation
                try {
                    const [itunesImageUrl, itunesOriginalYear] = await itunesService.searchAlbum(record.title, record.artist);
                    
                    if (itunesImageUrl) {
                        const itunesImagePath = await imageService.downloadRecordImage(
                            record.external_id,
                            itunesImageUrl,
                            null, // No token needed for iTunes
                            'itunes'
                        );

                        if (itunesImagePath) {
                            record.itunes_image_local_path = itunesImagePath;
                            record.cover_image_local_path = itunesImagePath; // Prefer iTunes for higher quality
                        }
                    }

                    // 3. Update original release year if iTunes provided a valid one
                    if (itunesOriginalYear) {
                        const validYear = itunesService.validateReleaseYear(itunesOriginalYear, record.year_of_release);
                        if (validYear) {
                            record.year_of_original_release = validYear;
                        }
                    }
                } catch (error) {
                    console.log(`iTunes lookup skipped for ${record.artist} - ${record.title}: ${error.message}`);
                }
            }

            return record;

        } catch (error) {
            console.error(`Failed to download images for record ${record.external_id}:`, error);
            return record;
        }
    }

    getMainArtist(artists) {
        if (!artists || artists.length === 0) return 'Unknown Artist';
        return artists[0].name;
    }

    getSortArtist(artists) {
        if (!artists || artists.length === 0) return 'Unknown Artist';
        
        const mainArtist = artists[0];
        
        // Remove articles for sorting
        let sortName = mainArtist.name;
        
        // Handle "The" prefix
        if (sortName.toLowerCase().startsWith('the ')) {
            sortName = sortName.substring(4) + ', The';
        }
        
        return sortName;
    }

    getFormat(formats) {
        if (!formats || formats.length === 0) return 'Unknown';
        return formats.map(f => f.name).join(', ');
    }

    getMainLabel(labels) {
        if (!labels || labels.length === 0) return 'Unknown Label';
        return labels[0].name;
    }

    getCatalogNumber(labels) {
        if (!labels || labels.length === 0) return '';
        return labels[0].catno || '';
    }

    getBestImage(images) {
        if (!images || images.length === 0) return null;
        
        // Prefer larger images
        const sorted = images.sort((a, b) => {
            const aSize = (a.width || 0) * (a.height || 0);
            const bSize = (b.width || 0) * (b.height || 0);
            return bSize - aSize;
        });
        
        return sorted[0].uri;
    }

    /**
     * Extract Discogs image URL using the original logic:
     * 1. First try cover_image
     * 2. Then fall back to thumb
     */
    getDiscogsImageUrl(basic_information) {
        if (basic_information.cover_image) {
            return basic_information.cover_image;
        } else if (basic_information.thumb) {
            return basic_information.thumb;
        }
        return null;
    }
}

export default new DiscogsService();