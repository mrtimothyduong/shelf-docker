import db from './db.js';

/**
 * Clean up any malformed JSON data in the database
 */
async function cleanJsonData() {
    console.log('Starting JSON data cleanup...');
    
    try {
        // Clean records table
        console.log('Cleaning records table...');
        const records = await db.query('SELECT id, genres, styles FROM records');
        
        for (const record of records.rows) {
            const updates = {};
            
            // Fix genres field
            if (record.genres) {
                try {
                    JSON.parse(record.genres);
                } catch (error) {
                    // Try to fix single quotes
                    try {
                        const fixed = record.genres.replace(/'/g, '"');
                        JSON.parse(fixed);
                        updates.genres = fixed;
                        console.log(`Fixed genres for record ${record.id}: ${record.genres} -> ${fixed}`);
                    } catch (error2) {
                        updates.genres = '[]';
                        console.log(`Reset genres for record ${record.id}: ${record.genres} -> []`);
                    }
                }
            }
            
            // Fix styles field
            if (record.styles) {
                try {
                    JSON.parse(record.styles);
                } catch (error) {
                    // Try to fix single quotes
                    try {
                        const fixed = record.styles.replace(/'/g, '"');
                        JSON.parse(fixed);
                        updates.styles = fixed;
                        console.log(`Fixed styles for record ${record.id}: ${record.styles} -> ${fixed}`);
                    } catch (error2) {
                        updates.styles = '[]';
                        console.log(`Reset styles for record ${record.id}: ${record.styles} -> []`);
                    }
                }
            }
            
            // Update record if we have changes
            if (Object.keys(updates).length > 0) {
                await db.update('records', updates, { id: record.id });
            }
        }
        
        // Clean board_games table
        console.log('Cleaning board_games table...');
        const boardGames = await db.query('SELECT id, mechanics, categories FROM board_games');
        
        for (const game of boardGames.rows) {
            const updates = {};
            
            // Fix mechanics field
            if (game.mechanics) {
                try {
                    JSON.parse(game.mechanics);
                } catch (error) {
                    try {
                        const fixed = game.mechanics.replace(/'/g, '"');
                        JSON.parse(fixed);
                        updates.mechanics = fixed;
                        console.log(`Fixed mechanics for game ${game.id}: ${game.mechanics} -> ${fixed}`);
                    } catch (error2) {
                        updates.mechanics = '[]';
                        console.log(`Reset mechanics for game ${game.id}: ${game.mechanics} -> []`);
                    }
                }
            }
            
            // Fix categories field
            if (game.categories) {
                try {
                    JSON.parse(game.categories);
                } catch (error) {
                    try {
                        const fixed = game.categories.replace(/'/g, '"');
                        JSON.parse(fixed);
                        updates.categories = fixed;
                        console.log(`Fixed categories for game ${game.id}: ${game.categories} -> ${fixed}`);
                    } catch (error2) {
                        updates.categories = '[]';
                        console.log(`Reset categories for game ${game.id}: ${game.categories} -> []`);
                    }
                }
            }
            
            // Update game if we have changes
            if (Object.keys(updates).length > 0) {
                await db.update('board_games', updates, { id: game.id });
            }
        }
        
        // Clean books table
        console.log('Cleaning books table...');
        const books = await db.query('SELECT id, genres FROM books');
        
        for (const book of books.rows) {
            const updates = {};
            
            // Fix genres field
            if (book.genres) {
                try {
                    JSON.parse(book.genres);
                } catch (error) {
                    try {
                        const fixed = book.genres.replace(/'/g, '"');
                        JSON.parse(fixed);
                        updates.genres = fixed;
                        console.log(`Fixed genres for book ${book.id}: ${book.genres} -> ${fixed}`);
                    } catch (error2) {
                        updates.genres = '[]';
                        console.log(`Reset genres for book ${book.id}: ${book.genres} -> []`);
                    }
                }
            }
            
            // Update book if we have changes
            if (Object.keys(updates).length > 0) {
                await db.update('books', updates, { id: book.id });
            }
        }
        
        console.log('JSON data cleanup completed successfully');
        
    } catch (error) {
        console.error('Error during JSON cleanup:', error);
        throw error;
    }
}

export default cleanJsonData;