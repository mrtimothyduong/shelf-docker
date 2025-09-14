-- Shelf v2 Database Schema with PostgreSQL
-- Drop tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS board_games CASCADE;
DROP TABLE IF EXISTS records CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS sync_status CASCADE;

-- Sync status table to track external API sync
CREATE TABLE sync_status (
    id SERIAL PRIMARY KEY,
    service VARCHAR(50) NOT NULL UNIQUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_in_progress BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Records table (from Discogs)
CREATE TABLE records (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(50) NOT NULL UNIQUE, -- Discogs ID
    artist VARCHAR(500) NOT NULL,
    sort_artist VARCHAR(500),
    title VARCHAR(500) NOT NULL,
    year_of_original_release INTEGER,
    year_of_release INTEGER,
    format VARCHAR(100),
    country VARCHAR(100),
    label VARCHAR(300),
    catalog_number VARCHAR(100),
    genres JSONB,
    styles JSONB,
    thumb_url TEXT,
    cover_image_url TEXT,
    cover_image_local_path TEXT,
    discogs_image_local_path TEXT,
    itunes_image_local_path TEXT,
    date_added TIMESTAMP WITH TIME ZONE,
    in_collection BOOLEAN DEFAULT TRUE,
    in_wishlist BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Board games table (from BoardGameGeek)
CREATE TABLE board_games (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(50) NOT NULL UNIQUE, -- BGG ID
    name VARCHAR(500) NOT NULL,
    year_published INTEGER,
    min_players INTEGER,
    max_players INTEGER,
    playing_time INTEGER,
    min_age INTEGER,
    description TEXT,
    image_url TEXT,
    thumb_url TEXT,
    cover_image_local_path TEXT,
    mechanics JSONB,
    categories JSONB,
    rating DECIMAL(3,2),
    complexity_rating DECIMAL(3,2),
    rank INTEGER,
    date_added TIMESTAMP WITH TIME ZONE,
    in_collection BOOLEAN DEFAULT TRUE,
    in_wishlist BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Books table (for future use when replacement for Goodreads is found)
CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(500),
    isbn VARCHAR(20),
    publication_year INTEGER,
    description TEXT,
    image_url TEXT,
    thumb_url TEXT,
    cover_image_local_path TEXT,
    genres JSONB,
    page_count INTEGER,
    rating DECIMAL(3,2),
    date_added TIMESTAMP WITH TIME ZONE,
    in_collection BOOLEAN DEFAULT TRUE,
    in_wishlist BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_records_artist ON records (artist);
CREATE INDEX idx_records_title ON records (title);
CREATE INDEX idx_records_year ON records (year_of_original_release);
CREATE INDEX idx_records_collection ON records (in_collection);
CREATE INDEX idx_records_external_id ON records (external_id);

CREATE INDEX idx_board_games_name ON board_games (name);
CREATE INDEX idx_board_games_year ON board_games (year_published);
CREATE INDEX idx_board_games_collection ON board_games (in_collection);
CREATE INDEX idx_board_games_external_id ON board_games (external_id);

CREATE INDEX idx_books_title ON books (title);
CREATE INDEX idx_books_author ON books (author);
CREATE INDEX idx_books_collection ON books (in_collection);
CREATE INDEX idx_books_external_id ON books (external_id);

-- Insert initial sync status records
INSERT INTO sync_status (service, last_sync_at) VALUES 
('discogs', NULL),
('boardgamegeek', NULL),
('goodreads', NULL);