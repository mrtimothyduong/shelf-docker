#!/usr/bin/env node

/**
 * Migration Runner for Shelf v2
 * Runs database migrations
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function runMigration(migrationFile) {
    const client = new Client({
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        user: config.database.user,
        password: config.database.password,
    });

    try {
        console.log('Connecting to database...');
        await client.connect();

        console.log(`Running migration: ${migrationFile}`);
        const migrationPath = path.join(__dirname, 'migrations', migrationFile);
        const migrationSQL = await fs.readFile(migrationPath, 'utf8');

        await client.query(migrationSQL);
        console.log('Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node src/database/runMigration.js <migration-file>');
        console.log('Example: node src/database/runMigration.js 001_add_image_paths.sql');
        process.exit(1);
    }

    const migrationFile = args[0];
    await runMigration(migrationFile);
}

if (import.meta.url === `file://${__filename}`) {
    main().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}