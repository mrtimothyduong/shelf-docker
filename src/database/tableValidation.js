/**
 * Table and column validation to prevent SQL injection
 */

// Whitelist of allowed tables
const ALLOWED_TABLES = [
    'records',
    'board_games', 
    'books',
    'sync_status'
];

// Whitelist of allowed columns for ORDER BY
const ALLOWED_COLUMNS = [
    'id', 'artist', 'sort_artist', 'title', 'name', 'sort_name', 
    'year_of_original_release', 'year_of_release', 'year_published',
    'author', 'sort_author', 'date_added', 'created_at', 'updated_at',
    'external_id', 'in_collection', 'in_wishlist'
];

/**
 * Validate table name against whitelist
 */
export function validateTableName(table) {
    if (!ALLOWED_TABLES.includes(table)) {
        throw new Error(`Invalid table name: ${table}`);
    }
    return table;
}

/**
 * Validate and sanitize ORDER BY clause
 */
export function validateOrderBy(orderBy) {
    if (!orderBy) return '';
    
    // Parse ORDER BY clause (handle "column ASC", "column DESC", "column1, column2")
    const orderParts = orderBy.split(',').map(part => part.trim());
    
    for (const part of orderParts) {
        const [column, direction = 'ASC'] = part.split(/\s+/);
        
        // Validate column name
        if (!ALLOWED_COLUMNS.includes(column)) {
            throw new Error(`Invalid column in ORDER BY: ${column}`);
        }
        
        // Validate sort direction
        if (!['ASC', 'DESC', 'asc', 'desc'].includes(direction)) {
            throw new Error(`Invalid sort direction: ${direction}`);
        }
    }
    
    return orderBy;
}

/**
 * Validate LIMIT value
 */
export function validateLimit(limit) {
    if (limit === null || limit === undefined) return null;
    
    const numLimit = parseInt(limit, 10);
    if (isNaN(numLimit) || numLimit < 1 || numLimit > 1000) {
        throw new Error(`Invalid limit: must be between 1 and 1000`);
    }
    
    return numLimit;
}