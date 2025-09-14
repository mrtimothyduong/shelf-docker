import express from 'express';
import cachedDb from '../services/cachedDbService.js';
import config from '../config/index.js';

const router = express.Router();

// Books wishlist
router.get('/wishlist', async (req, res) => {
    try {
        if (!config.features.booksEnabled) {
            if (config.features.recordsEnabled) {
                return res.redirect('/');
            } else if (config.features.boardGamesEnabled) {
                return res.redirect('/game');
            } else {
                return res.status(404).render('error', {
                    error: 'No shelves are currently enabled',
                    siteTitle: config.siteTitle,
                    publicUrl: config.publicUrl
                });
            }
        }

        // Get all books from wishlist
        const books = await cachedDb.findMany('books', 
            { in_wishlist: true }, 
            'author, title'
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
        const transformedBooks = books.map(book => ({
            _id: book.id,
            id: book.id,
            title: book.title,
            author: book.author,
            sortAuthor: book.sort_author || book.author,
            isbn: book.isbn,
            yearPublished: book.year_published,
            publisher: book.publisher,
            pageCount: book.page_count,
            description: book.description,
            categories: safeJsonParse(book.categories, []),
            thumbUrl: book.thumb_url,
            coverImageUrl: book.cover_image_local_path || book.cover_image_url || book.thumb_url || '/images/books/missing-artwork.png',
            dateAdded: book.date_added
        }));

        res.render('books', {
            books: transformedBooks,
            booksJson: JSON.stringify(transformedBooks),
            bookCount: transformedBooks.length,
            siteTitle: config.siteTitle,
            publicUrl: config.publicUrl,
            menu: 'books',
            wishlist: true, // Flag to indicate wishlist view
            recordShelfEnabled: config.features.recordsEnabled,
            boardGameShelfEnabled: config.features.boardGamesEnabled,
            bookShelfEnabled: config.features.booksEnabled
        });

    } catch (error) {
        console.error('Error loading books wishlist:', error);
        res.status(500).render('error', {
            error: 'Failed to load books wishlist',
            siteTitle: config.siteTitle,
            publicUrl: config.publicUrl
        });
    }
});

// Books page
router.get('/', async (req, res) => {
    try {
        if (!config.features.booksEnabled) {
            if (config.features.recordsEnabled) {
                return res.redirect('/');
            } else if (config.features.boardGamesEnabled) {
                return res.redirect('/game');
            } else {
                return res.status(404).render('error', {
                    error: 'No shelves are currently enabled',
                    siteTitle: config.siteTitle,
                    publicUrl: config.publicUrl
                });
            }
        }

        // Get all books from collection
        const books = await cachedDb.findMany('books', 
            { in_collection: true }, 
            'author, title'
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
        const transformedBooks = books.map(book => ({
            id: book.id,
            title: book.title,
            author: book.author,
            isbn: book.isbn,
            publicationYear: book.publication_year,
            description: book.description,
            imageUrl: book.cover_image_local_path || book.image_url || '/images/books/missing-artwork.png',
            thumbUrl: book.thumb_url,
            genres: safeJsonParse(book.genres, []),
            pageCount: book.page_count,
            rating: book.rating,
            dateAdded: book.date_added
        }));

        res.render('books', {
            books: transformedBooks,
            bookCount: transformedBooks.length,
            siteTitle: config.siteTitle,
            publicUrl: config.publicUrl,
            menu: 'books',
            recordShelfEnabled: config.features.recordsEnabled,
            boardGameShelfEnabled: config.features.boardGamesEnabled,
            bookShelfEnabled: config.features.booksEnabled
        });

    } catch (error) {
        console.error('Error loading books:', error);
        res.status(500).render('error', {
            error: 'Failed to load books',
            siteTitle: config.siteTitle,
            publicUrl: config.publicUrl
        });
    }
});

export default router;