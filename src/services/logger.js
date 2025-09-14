import winston from 'winston';
import config from '../config/index.js';

/**
 * Centralized logging service using Winston
 * Replaces 163+ console.log statements with proper structured logging
 */
class Logger {
    constructor() {
        this.logger = winston.createLogger({
            level: config.logging.level || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { 
                service: 'shelf-v2',
                version: '2.0.0'
            },
            transports: [
                // Write to combined log file
                new winston.transports.File({ 
                    filename: 'logs/combined.log',
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                }),
                
                // Write errors to separate file
                new winston.transports.File({ 
                    filename: 'logs/error.log', 
                    level: 'error',
                    maxsize: 5242880, // 5MB  
                    maxFiles: 5
                })
            ]
        });

        // Add console transport in development
        if (config.nodeEnv !== 'production') {
            this.logger.add(new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
            }));
        }
    }

    // Convenience methods
    error(message, meta = {}) {
        this.logger.error(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    // Service-specific loggers
    sync(level, message, meta = {}) {
        this.logger[level](message, { service: 'sync', ...meta });
    }

    api(level, message, meta = {}) {
        this.logger[level](message, { service: 'api', ...meta });
    }

    cache(level, message, meta = {}) {
        this.logger[level](message, { service: 'cache', ...meta });
    }

    database(level, message, meta = {}) {
        this.logger[level](message, { service: 'database', ...meta });
    }

    // Performance logging
    timing(operation, duration, meta = {}) {
        this.logger.info(`${operation} completed`, {
            duration: `${duration}ms`,
            type: 'performance',
            ...meta
        });
    }

    // Security logging  
    security(level, message, meta = {}) {
        this.logger[level](message, { 
            type: 'security',
            timestamp: new Date().toISOString(),
            ...meta 
        });
    }
}

export default new Logger();