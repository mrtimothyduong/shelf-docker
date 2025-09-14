import fetch from 'node-fetch';
import xmljs from 'xml-js';
import config from '../config/index.js';
import { setTimeout } from 'timers/promises';
import imageService from './imageService.js';

class BoardGameGeekService {
    constructor() {
        this.baseUrl = config.boardGameGeek.baseUrl;
        this.userId = config.boardGameGeek.userId;
        this.userAgent = config.boardGameGeek.userAgent;
    }

    async makeRequest(endpoint, params = {}) {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        
        // Add parameters
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });

        const options = {
            headers: {
                'User-Agent': this.userAgent,
                'Accept': 'application/xml'
            },
            timeout: config.api.requestTimeoutMs
        };

        try {
            console.log(`BGG API request: ${url.pathname}`);
            const response = await fetch(url.toString(), options);

            if (!response.ok) {
                throw new Error(`BGG API error: ${response.status} ${response.statusText}`);
            }

            const xmlData = await response.text();
            
            // Convert XML to JSON
            const jsonData = xmljs.xml2js(xmlData, { 
                compact: true, 
                sanitize: true,
                textKey: '_text'
            });
            
            // Respect rate limits (BGG is strict about this)
            await setTimeout(config.api.rateLimitDelay * 2); // Double delay for BGG
            
            return jsonData;
        } catch (error) {
            console.error('BGG API request failed:', error);
            throw error;
        }
    }

    async getUserCollection() {
        if (!this.userId) {
            throw new Error('BoardGameGeek user ID not configured');
        }

        const endpoint = '/collection';
        const params = {
            username: this.userId,
            own: '1',
            stats: '1'
        };

        return await this.makeRequest(endpoint, params);
    }

    async getUserWishlist() {
        if (!this.userId) {
            throw new Error('BoardGameGeek user ID not configured');
        }

        const endpoint = '/collection';
        const params = {
            username: this.userId,
            wishlist: '1',
            stats: '1'
        };

        return await this.makeRequest(endpoint, params);
    }

    async getGameDetails(gameIds) {
        if (!gameIds || gameIds.length === 0) {
            return null;
        }

        const endpoint = '/thing';
        const params = {
            id: gameIds.join(','),
            stats: '1'
        };

        return await this.makeRequest(endpoint, params);
    }

    async getAllCollectionItems() {
        try {
            const response = await this.getUserCollection();
            
            if (!response.items || !response.items.item) {
                console.log('No collection items found');
                return [];
            }

            // Handle single item vs array
            const items = Array.isArray(response.items.item) ? response.items.item : [response.items.item];
            
            console.log(`Total BGG collection items fetched: ${items.length}`);
            return items;
        } catch (error) {
            console.error('Error fetching BGG collection:', error);
            return [];
        }
    }

    async getAllWishlistItems() {
        try {
            const response = await this.getUserWishlist();
            
            if (!response.items || !response.items.item) {
                console.log('No wishlist items found');
                return [];
            }

            // Handle single item vs array
            const items = Array.isArray(response.items.item) ? response.items.item : [response.items.item];
            
            console.log(`Total BGG wishlist items fetched: ${items.length}`);
            return items;
        } catch (error) {
            console.error('Error fetching BGG wishlist:', error);
            return [];
        }
    }

    transformToBoardGame(item, isWishlist = false) {
        const stats = item.stats || {};
        const rating = stats.rating || {};
        
        return {
            external_id: this.getAttribute(item, 'objectid'),
            name: this.getTextValue(item.name),
            year_published: parseInt(this.getTextValue(item.yearpublished)) || null,
            min_players: parseInt(this.getTextValue(item.stats?.minplayers)) || null,
            max_players: parseInt(this.getTextValue(item.stats?.maxplayers)) || null,
            playing_time: parseInt(this.getTextValue(item.stats?.playingtime)) || null,
            min_age: parseInt(this.getTextValue(item.stats?.minage)) || null,
            description: null, // Not available in collection API
            image_url: this.getTextValue(item.image),
            thumb_url: this.getTextValue(item.thumbnail),
            mechanics: JSON.stringify([]), // Would need separate API call
            categories: JSON.stringify([]), // Would need separate API call
            rating: parseFloat(this.getTextValue(rating.average)) || null,
            complexity_rating: parseFloat(this.getTextValue(rating.averageweight)) || null,
            rank: parseInt(this.getTextValue(rating.ranks?.rank?.value)) || null,
            date_added: new Date(),
            in_collection: !isWishlist,
            in_wishlist: isWishlist
        };
    }

    /**
     * Downloads and caches BoardGameGeek images for a board game
     * @param {Object} boardGame - The board game object with external_id and image_url
     * @returns {Object} - Board game with updated local image path
     */
    async downloadBoardGameImages(boardGame) {
        if (!boardGame.external_id || !boardGame.image_url) {
            return boardGame;
        }

        try {
            console.log(`Downloading images for board game: ${boardGame.name}`);
            
            // Download BGG image
            const localImagePath = await imageService.downloadBoardGameImage(
                boardGame.external_id,
                boardGame.image_url
            );

            if (localImagePath) {
                boardGame.cover_image_local_path = localImagePath;
            }

            return boardGame;

        } catch (error) {
            console.error(`Failed to download images for board game ${boardGame.external_id}:`, error);
            return boardGame;
        }
    }

    getAttribute(obj, attrName) {
        if (!obj || !obj._attributes) return null;
        return obj._attributes[attrName];
    }

    getTextValue(obj) {
        if (!obj) return null;
        if (typeof obj === 'string') return obj;
        if (obj._text) return obj._text;
        if (obj.value) return obj.value;
        return null;
    }

    async enrichGameData(games) {
        // Get detailed information for games in batches
        const batchSize = 20; // BGG allows up to 20 items per request
        const enrichedGames = [];

        for (let i = 0; i < games.length; i += batchSize) {
            const batch = games.slice(i, i + batchSize);
            const gameIds = batch.map(game => game.external_id).filter(id => id);

            if (gameIds.length === 0) {
                enrichedGames.push(...batch);
                continue;
            }

            try {
                const detailsResponse = await this.getGameDetails(gameIds);
                const details = this.parseGameDetails(detailsResponse);

                // Merge details with original games
                const enrichedBatch = batch.map(game => {
                    const detail = details.find(d => d.id === game.external_id);
                    if (detail) {
                        return {
                            ...game,
                            description: detail.description,
                            mechanics: JSON.stringify(detail.mechanics || []),
                            categories: JSON.stringify(detail.categories || [])
                        };
                    }
                    return game;
                });

                enrichedGames.push(...enrichedBatch);
                
                console.log(`Enriched ${i + batch.length}/${games.length} board games`);
            } catch (error) {
                console.error(`Error enriching batch ${i}-${i + batch.length}:`, error);
                enrichedGames.push(...batch);
            }
        }

        return enrichedGames;
    }

    parseGameDetails(response) {
        if (!response.items || !response.items.item) {
            return [];
        }

        const items = Array.isArray(response.items.item) ? response.items.item : [response.items.item];
        
        return items.map(item => ({
            id: this.getAttribute(item, 'id'),
            description: this.getTextValue(item.description),
            mechanics: this.parseLinks(item.link, 'boardgamemechanic'),
            categories: this.parseLinks(item.link, 'boardgamecategory')
        }));
    }

    parseLinks(links, type) {
        if (!links) return [];
        
        const linkArray = Array.isArray(links) ? links : [links];
        
        return linkArray
            .filter(link => this.getAttribute(link, 'type') === type)
            .map(link => this.getAttribute(link, 'value'))
            .filter(value => value);
    }
}

export default new BoardGameGeekService();