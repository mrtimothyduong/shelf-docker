import { query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import logger from '../services/logger.js';

/**
 * Input validation middleware using express-validator
 */

/**
 * Handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.security('warn', 'Input validation failed', {
            ip: req.ip,
            path: req.path,
            errors: errors.array()
        });
        
        return res.status(400).json({
            error: 'Invalid input',
            details: errors.array()
        });
    }
    next();
};

/**
 * Validate search query parameters
 */
export const validateSearchQuery = [
    query('q')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('Search query must be between 2 and 100 characters')
        .matches(/^[a-zA-Z0-9\s\-\.'&()]+$/)
        .withMessage('Search query contains invalid characters'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    
    handleValidationErrors
];

/**
 * Validate record ID parameters
 */
export const validateRecordId = [
    query('id')
        .isInt({ min: 1 })
        .withMessage('Record ID must be a positive integer'),
    
    handleValidationErrors
];

/**
 * Rate limiting for different endpoint types
 */
export const createRateLimit = (windowMs, max, message = 'Too many requests') => {
    return rateLimit({
        windowMs,
        max,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            logger.security('warn', 'Rate limit exceeded', {
                ip: req.ip,
                path: req.path,
                userAgent: req.get('user-agent')
            });
            res.status(429).json({ error: message });
        }
    });
};

// Pre-configured rate limiters
export const apiRateLimit = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests per window
    'Too many API requests, please try again later'
);

export const searchRateLimit = createRateLimit(
    60 * 1000, // 1 minute  
    30, // 30 searches per minute
    'Too many search requests, please slow down'
);

export const healthRateLimit = createRateLimit(
    60 * 1000, // 1 minute
    10, // 10 health checks per minute
    'Too many health check requests'
);