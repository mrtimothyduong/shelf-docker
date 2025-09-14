import express from 'express';
import db from '../database/db.js';
import syncService from '../services/syncService.js';
import config from '../config/index.js';

const router = express.Router();

// Get sync status
router.get('/sync/status', async (req, res) => {
    try {
        const status = await syncService.getSyncStatus();
        res.json(status);
    } catch (error) {
        console.error('Error getting sync status:', error);
        res.status(500).json({ error: 'Failed to get sync status' });
    }
});

// Trigger manual sync for records
router.post('/sync/records', async (req, res) => {
    try {
        if (!config.features.recordsEnabled) {
            return res.status(400).json({ error: 'Records not enabled' });
        }

        await syncService.syncRecordsManually();
        res.json({ message: 'Records sync completed' });
    } catch (error) {
        console.error('Error syncing records:', error);
        res.status(500).json({ error: error.message });
    }
});

// Trigger manual sync for board games
router.post('/sync/boardgames', async (req, res) => {
    try {
        if (!config.features.boardGamesEnabled) {
            return res.status(400).json({ error: 'Board games not enabled' });
        }

        await syncService.syncBoardGamesManually();
        res.json({ message: 'Board games sync completed' });
    } catch (error) {
        console.error('Error syncing board games:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get collection statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = {};

        if (config.features.recordsEnabled) {
            const recordCount = await db.query('SELECT COUNT(*) FROM records WHERE in_collection = true');
            const recordWishlistCount = await db.query('SELECT COUNT(*) FROM records WHERE in_wishlist = true');
            stats.records = {
                collection: parseInt(recordCount.rows[0].count),
                wishlist: parseInt(recordWishlistCount.rows[0].count)
            };
        }

        if (config.features.boardGamesEnabled) {
            const gameCount = await db.query('SELECT COUNT(*) FROM board_games WHERE in_collection = true');
            const gameWishlistCount = await db.query('SELECT COUNT(*) FROM board_games WHERE in_wishlist = true');
            stats.boardGames = {
                collection: parseInt(gameCount.rows[0].count),
                wishlist: parseInt(gameWishlistCount.rows[0].count)
            };
        }

        if (config.features.booksEnabled) {
            const bookCount = await db.query('SELECT COUNT(*) FROM books WHERE in_collection = true');
            const bookWishlistCount = await db.query('SELECT COUNT(*) FROM books WHERE in_wishlist = true');
            stats.books = {
                collection: parseInt(bookCount.rows[0].count),
                wishlist: parseInt(bookWishlistCount.rows[0].count)
            };
        }

        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// Search endpoints
router.get('/search/records', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.json([]);
        }

        const query = `
            SELECT * FROM records 
            WHERE in_collection = true 
            AND (
                LOWER(artist) LIKE LOWER($1) OR 
                LOWER(title) LIKE LOWER($1)
            )
            ORDER BY sort_artist, year_of_original_release, title
            LIMIT 50
        `;

        const result = await db.query(query, [`%${q}%`]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error searching records:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

router.get('/search/boardgames', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.json([]);
        }

        const query = `
            SELECT * FROM board_games 
            WHERE in_collection = true 
            AND LOWER(name) LIKE LOWER($1)
            ORDER BY name
            LIMIT 50
        `;

        const result = await db.query(query, [`%${q}%`]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error searching board games:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

router.get('/search/books', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.json([]);
        }

        const query = `
            SELECT * FROM books 
            WHERE in_collection = true 
            AND (
                LOWER(title) LIKE LOWER($1) OR 
                LOWER(author) LIKE LOWER($1)
            )
            ORDER BY author, title
            LIMIT 50
        `;

        const result = await db.query(query, [`%${q}%`]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error searching books:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

export default router;