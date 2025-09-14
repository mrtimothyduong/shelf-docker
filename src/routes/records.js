import express from 'express';
import cachedDb from '../services/cachedDbService.js';
import config from '../config/index.js';

const router = express.Router();

// Records wishlist
router.get('/wishlist', async (req, res) => {
    try {
        if (!config.features.recordsEnabled) {
            return res.redirect('/game');
        }

        // Get all records from wishlist (cached)
        const records = await cachedDb.findMany('records', 
            { in_wishlist: true }, 
            'sort_artist, year_of_original_release, title'
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

        // Transform for frontend - same as collection
        const transformedRecords = records.map(record => ({
            _id: record.id,
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
            genres: safeJsonParse(record.genres, []),
            styles: safeJsonParse(record.styles, []),
            thumbUrl: record.thumb_url,
            coverImageUrl: record.cover_image_local_path || record.cover_image_url || record.thumb_url || '/images/records/missing-artwork.png',
            discogsUrl: `https://www.discogs.com/release/${record.external_id}`,
            dateAdded: record.date_added
        }));

        res.render('records', {
            records: transformedRecords,
            recordsJson: JSON.stringify(transformedRecords),
            recordCount: transformedRecords.length,
            siteTitle: config.siteTitle,
            publicUrl: config.publicUrl,
            menu: 'records',
            submenu: 'wishlist', // Active navigation state
            wishlist: true, // Flag to indicate this is wishlist view
            collectionPath: '/',
            wishlistPath: '/record/wishlist',
            recordShelfEnabled: config.features.recordsEnabled,
            boardGameShelfEnabled: config.features.boardGamesEnabled,
            bookShelfEnabled: config.features.booksEnabled
        });

    } catch (error) {
        console.error('Error loading records wishlist:', error);
        res.status(500).render('error', {
            error: 'Failed to load records wishlist',
            siteTitle: config.siteTitle,
            publicUrl: config.publicUrl
        });
    }
});

// Records homepage
router.get('/', async (req, res) => {
    try {
        if (!config.features.recordsEnabled) {
            return res.redirect('/game');
        }

        // Get all records from collection (cached)
        const records = await cachedDb.findMany('records', 
            { in_collection: true }, 
            'sort_artist, year_of_original_release, title'
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
        const transformedRecords = records.map(record => ({
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
            genres: safeJsonParse(record.genres, []),
            styles: safeJsonParse(record.styles, []),
            thumbUrl: record.thumb_url,
            coverImageUrl: record.cover_image_local_path || record.cover_image_url || record.thumb_url || '/images/records/missing-artwork.png',
            discogsUrl: `https://www.discogs.com/release/${record.external_id}`, // Generate Discogs URL
            dateAdded: record.date_added
        }));

        res.render('records', {
            records: transformedRecords,
            recordsJson: JSON.stringify(transformedRecords), // Pass as JSON string
            recordCount: transformedRecords.length,
            siteTitle: config.siteTitle,
            publicUrl: config.publicUrl,
            menu: 'records',
            submenu: 'collection', // Active navigation state
            collectionPath: '/',
            wishlistPath: '/record/wishlist',
            recordShelfEnabled: config.features.recordsEnabled,
            boardGameShelfEnabled: config.features.boardGamesEnabled,
            bookShelfEnabled: config.features.booksEnabled
        });

    } catch (error) {
        console.error('Error loading records:', error);
        res.status(500).render('error', {
            error: 'Failed to load records',
            siteTitle: config.siteTitle,
            publicUrl: config.publicUrl
        });
    }
});

export default router;