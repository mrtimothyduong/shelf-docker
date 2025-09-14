import express from 'express';
import cachedDb from '../services/cachedDbService.js';
import config from '../config/index.js';

const router = express.Router();

// Board games wishlist
router.get('/wishlist', async (req, res) => {
    try {
        if (!config.features.boardGamesEnabled) {
            if (config.features.recordsEnabled) {
                return res.redirect('/');
            } else {
                return res.redirect('/book');
            }
        }

        // Get all board games from wishlist
        const boardGames = await cachedDb.findMany('board_games', 
            { in_wishlist: true }, 
            'name, year_published'
        );

        // Safe JSON parsing helper - same as collection
        const safeJsonParse = (data, fallback = []) => {
            if (!data || data === 'null' || data === 'undefined' || data === '') {
                return fallback;
            }
            if (Array.isArray(data) || typeof data === 'object') {
                return data;
            }
            if (typeof data === 'string') {
                try {
                    return JSON.parse(data);
                } catch (e) {
                    console.warn('Failed to parse JSON string:', data, 'Returning fallback:', fallback);
                    return fallback;
                }
            }
            console.warn('Unexpected data type for JSON field:', typeof data, data, 'Returning fallback:', fallback);
            return fallback;
        };

        // Transform for frontend
        const transformedBoardGames = boardGames.map(game => ({
            _id: game.id,
            id: game.id,
            name: game.name,
            sortName: game.sort_name || game.name,
            yearPublished: game.year_published,
            minPlayers: game.min_players,
            maxPlayers: game.max_players,
            playingTime: game.playing_time,
            minPlayingTime: game.min_playing_time,
            maxPlayingTime: game.max_playing_time,
            minAge: game.min_age,
            description: game.description,
            publishers: safeJsonParse(game.publishers, []),
            designers: safeJsonParse(game.designers, []),
            artists: safeJsonParse(game.artists, []),
            categories: safeJsonParse(game.categories, []),
            mechanics: safeJsonParse(game.mechanics, []),
            families: safeJsonParse(game.families, []),
            thumbUrl: game.thumb_url,
            coverImageUrl: game.cover_image_local_path || game.cover_image_url || game.thumb_url || '/images/board-games/missing-artwork.png',
            bggUrl: `https://boardgamegeek.com/boardgame/${game.external_id}`,
            dateAdded: game.date_added
        }));

        res.render('boardGames', {
            boardGames: transformedBoardGames,
            boardGamesJson: JSON.stringify(transformedBoardGames),
            gameCount: transformedBoardGames.length,
            siteTitle: config.siteTitle,
            publicUrl: config.publicUrl,
            menu: 'boardGames',
            wishlist: true, // Flag to indicate wishlist view
            recordShelfEnabled: config.features.recordsEnabled,
            boardGameShelfEnabled: config.features.boardGamesEnabled,
            bookShelfEnabled: config.features.booksEnabled
        });

    } catch (error) {
        console.error('Error loading board games wishlist:', error);
        res.status(500).render('error', {
            error: 'Failed to load board games wishlist',
            siteTitle: config.siteTitle,
            publicUrl: config.publicUrl
        });
    }
});

// Board games page
router.get('/', async (req, res) => {
    try {
        if (!config.features.boardGamesEnabled) {
            if (config.features.recordsEnabled) {
                return res.redirect('/');
            } else {
                return res.redirect('/book');
            }
        }

        // Get all board games from collection
        const boardGames = await cachedDb.findMany('board_games', 
            { in_collection: true }, 
            'name, year_published'
        );

        // Safe JSON parsing helper - handles both JSONB objects and JSON strings
        const safeJsonParse = (data, fallback = []) => {
            // If data is null, undefined, or empty string, return fallback
            if (!data || data === 'null' || data === 'undefined' || data === '') {
                return fallback;
            }
            
            // If data is already an array or object (JSONB from PostgreSQL), return it directly
            if (Array.isArray(data) || typeof data === 'object') {
                return data;
            }
            
            // If data is a string, try to parse it as JSON
            if (typeof data === 'string') {
                try {
                    return JSON.parse(data);
                } catch (e) {
                    console.warn('Failed to parse JSON string:', data, 'Returning fallback:', fallback);
                    return fallback;
                }
            }
            
            // For any other data type, return fallback
            console.warn('Unexpected data type for JSON field:', typeof data, data, 'Returning fallback:', fallback);
            return fallback;
        };

        // Transform for frontend
        const transformedBoardGames = boardGames.map(game => ({
            id: game.id,
            name: game.name,
            yearPublished: game.year_published,
            minPlayers: game.min_players,
            maxPlayers: game.max_players,
            playingTime: game.playing_time,
            minAge: game.min_age,
            description: game.description,
            imageUrl: game.cover_image_local_path || game.image_url || '/images/board-games/missing-artwork.png',
            thumbUrl: game.thumb_url,
            mechanics: safeJsonParse(game.mechanics, []),
            categories: safeJsonParse(game.categories, []),
            rating: game.rating,
            complexityRating: game.complexity_rating,
            rank: game.rank,
            dateAdded: game.date_added
        }));

        res.render('boardGames', {
            boardGames: transformedBoardGames,
            boardGameCount: transformedBoardGames.length,
            siteTitle: config.siteTitle,
            publicUrl: config.publicUrl,
            menu: 'board-games',
            recordShelfEnabled: config.features.recordsEnabled,
            boardGameShelfEnabled: config.features.boardGamesEnabled,
            bookShelfEnabled: config.features.booksEnabled
        });

    } catch (error) {
        console.error('Error loading board games:', error);
        res.status(500).render('error', {
            error: 'Failed to load board games',
            siteTitle: config.siteTitle,
            publicUrl: config.publicUrl
        });
    }
});

export default router;