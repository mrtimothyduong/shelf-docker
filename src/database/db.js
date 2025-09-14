import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Database {
    constructor() {
        this.pool = null;
    }

    async connect() {
        if (this.pool) {
            return this.pool;
        }

        const config = {
            user: process.env.POSTGRES_USER || 'shelf_user',
            password: process.env.POSTGRES_PASSWORD || 'shelf_password',
            host: process.env.POSTGRES_HOST || 'postgres',
            port: process.env.POSTGRES_PORT || 5432,
            database: process.env.POSTGRES_DB || 'shelf_db',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };

        this.pool = new Pool(config);

        // Test the connection
        try {
            const client = await this.pool.connect();
            console.log('Connected to PostgreSQL database');
            client.release();
        } catch (err) {
            console.error('Database connection error:', err);
            throw err;
        }

        return this.pool;
    }

    async query(text, params) {
        if (!this.pool) {
            await this.connect();
        }
        
        try {
            const result = await this.pool.query(text, params);
            return result;
        } catch (err) {
            console.error('Database query error:', err);
            throw err;
        }
    }

    async migrate() {
        console.log('Running database migrations...');
        
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        try {
            await this.query(schema);
            console.log('Database migration completed successfully');
        } catch (err) {
            console.error('Database migration failed:', err);
            throw err;
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            console.log('Database connection closed');
        }
    }

    // Helper methods for common operations
    async findOne(table, conditions = {}) {
        const keys = Object.keys(conditions);
        if (keys.length === 0) {
            const result = await this.query(`SELECT * FROM ${table} LIMIT 1`);
            return result.rows[0] || null;
        }

        const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
        const values = keys.map(key => conditions[key]);
        
        const result = await this.query(
            `SELECT * FROM ${table} WHERE ${whereClause} LIMIT 1`,
            values
        );
        
        return result.rows[0] || null;
    }

    async findMany(table, conditions = {}, orderBy = '', limit = null) {
        const keys = Object.keys(conditions);
        let query = `SELECT * FROM ${table}`;
        let values = [];

        if (keys.length > 0) {
            const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
            query += ` WHERE ${whereClause}`;
            values = keys.map(key => conditions[key]);
        }

        if (orderBy) {
            query += ` ORDER BY ${orderBy}`;
        }

        if (limit) {
            query += ` LIMIT ${limit}`;
        }

        const result = await this.query(query, values);
        return result.rows;
    }

    async insert(table, data) {
        const keys = Object.keys(data);
        const values = keys.map(key => data[key]);
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
        
        const query = `
            INSERT INTO ${table} (${keys.join(', ')})
            VALUES (${placeholders})
            RETURNING *
        `;
        
        const result = await this.query(query, values);
        return result.rows[0];
    }

    async upsert(table, data, conflictColumns = []) {
        const keys = Object.keys(data);
        const values = keys.map(key => data[key]);
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
        
        let query = `
            INSERT INTO ${table} (${keys.join(', ')})
            VALUES (${placeholders})
        `;

        if (conflictColumns.length > 0) {
            const updateColumns = keys
                .filter(key => !conflictColumns.includes(key))
                .map(key => `${key} = EXCLUDED.${key}`)
                .join(', ');
            
            query += `
                ON CONFLICT (${conflictColumns.join(', ')})
                DO UPDATE SET ${updateColumns}, updated_at = CURRENT_TIMESTAMP
            `;
        }

        query += ' RETURNING *';
        
        const result = await this.query(query, values);
        return result.rows[0];
    }

    async update(table, data, conditions) {
        const dataKeys = Object.keys(data);
        const conditionKeys = Object.keys(conditions);
        
        const setClause = dataKeys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        const whereClause = conditionKeys.map((key, index) => `${key} = $${dataKeys.length + index + 1}`).join(' AND ');
        
        const values = [
            ...dataKeys.map(key => data[key]),
            ...conditionKeys.map(key => conditions[key])
        ];
        
        const query = `
            UPDATE ${table}
            SET ${setClause}, updated_at = CURRENT_TIMESTAMP
            WHERE ${whereClause}
            RETURNING *
        `;
        
        const result = await this.query(query, values);
        return result.rows[0];
    }

    async delete(table, conditions) {
        const keys = Object.keys(conditions);
        const whereClause = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
        const values = keys.map(key => conditions[key]);
        
        const query = `DELETE FROM ${table} WHERE ${whereClause} RETURNING *`;
        const result = await this.query(query, values);
        return result.rows;
    }
}

// Export singleton instance
const db = new Database();
export default db;