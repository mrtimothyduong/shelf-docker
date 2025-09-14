#!/usr/bin/env node

/**
 * Manual Sync Script for Debugging
 * Forces a sync and shows detailed logging
 */

import config from '../src/config/index.js';
import db from '../src/database/db.js';
import syncService from '../src/services/syncService.js';

async function manualSync() {
    try {
        console.log('=== MANUAL SYNC START ===');
        console.log('Config features:', config.features);
        
        // Initialize database
        await db.connect();
        console.log('Database connected');

        // Force sync
        console.log('Starting manual sync...');
        await syncService.performInitialSync();
        console.log('Manual sync completed');

        // Check database
        const records = await db.findMany('records', {});
        console.log(`Total records in database: ${records.length}`);
        
        const withImages = records.filter(r => r.cover_image_local_path || r.discogs_image_local_path);
        console.log(`Records with local images: ${withImages.length}`);

        await db.close();
        console.log('=== MANUAL SYNC END ===');
        
    } catch (error) {
        console.error('Manual sync failed:', error);
        process.exit(1);
    }
}

manualSync();