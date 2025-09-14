import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const config = {
    // Server configuration
    port: process.env.PORT || 3008,
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // Application settings
    siteTitle: process.env.SITE_TITLE || 'Shelf',
    publicUrl: process.env.PUBLIC_URL || 'http://localhost:3008',
    ownerName: process.env.OWNER_NAME || 'Library Owner',
    twitterHandle: process.env.TWITTER_HANDLE || '',
    
    // Database configuration
    database: {
        host: process.env.POSTGRES_HOST || 'postgres',
        port: process.env.POSTGRES_PORT || 5432,
        name: process.env.POSTGRES_DB || 'shelf_db',
        user: process.env.POSTGRES_USER || 'shelf_user',
        password: process.env.POSTGRES_PASSWORD || 'shelf_password'
    },
    
    // Feature toggles
    features: {
        recordsEnabled: process.env.RECORD_SHELF_ENABLED !== 'false',
        boardGamesEnabled: process.env.BOARDGAME_SHELF_ENABLED !== 'false',
        booksEnabled: process.env.BOOK_SHELF_ENABLED === 'true' // Disabled by default
    },
    
    // External API configuration
    discogs: {
        userId: process.env.DISCOGS_USER_ID || '',
        token: process.env.DISCOGS_USER_TOKEN || '',
        baseUrl: 'https://api.discogs.com',
        userAgent: process.env.USER_AGENT || 'Shelf/2.0 +https://github.com/shelf'
    },
    
    boardGameGeek: {
        userId: process.env.BOARDGAMEGEEK_USER_ID || '',
        baseUrl: 'https://boardgamegeek.com/xmlapi2',
        userAgent: process.env.USER_AGENT || 'Shelf/2.0 +https://github.com/shelf'
    },
    
    // API settings
    api: {
        requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_IN_SECONDS || '5') * 1000,
        refreshFrequencyMs: parseInt(process.env.REFRESH_FREQUENCY_IN_MINUTES || '15') * 60 * 1000,
        maxArtSize: parseInt(process.env.MAX_ART_SIZE || '400'),
        rateLimitDelay: 1000 // 1 second between API calls
    },
    
    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info'
    },
    
    // Image storage
    images: {
        cachePath: process.env.IMAGE_CACHE_PATH || './public/images/cache',
        maxSize: parseInt(process.env.MAX_ART_SIZE || '400')
    }
};

// Validation
const validateConfig = () => {
    const errors = [];
    
    if (config.features.recordsEnabled && !config.discogs.userId) {
        errors.push('DISCOGS_USER_ID is required when records are enabled');
    }
    
    if (config.features.recordsEnabled && !config.discogs.token) {
        errors.push('DISCOGS_USER_TOKEN is required when records are enabled');
    }
    
    if (config.features.boardGamesEnabled && !config.boardGameGeek.userId) {
        errors.push('BOARDGAMEGEEK_USER_ID is required when board games are enabled');
    }
    
    if (errors.length > 0) {
        console.error('Configuration errors:');
        errors.forEach(error => console.error(`  - ${error}`));
        
        if (config.nodeEnv === 'production') {
            process.exit(1);
        } else {
            console.warn('Running in development mode with missing configuration');
        }
    }
};

validateConfig();

export default config;