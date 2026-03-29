-- Supabase Database Schema for Student Stock Dashboard
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Students table
CREATE TABLE IF NOT EXISTS student (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    student_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_student_name ON student(name);
CREATE INDEX idx_student_student_id ON student(student_id);

-- Weeks table
CREATE TABLE IF NOT EXISTS week (
    id BIGSERIAL PRIMARY KEY,
    week_number INTEGER NOT NULL UNIQUE,
    week_start TIMESTAMP WITH TIME ZONE NOT NULL,
    week_end TIMESTAMP WITH TIME ZONE NOT NULL,
    is_confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_week_number ON week(week_number);

-- Stock Selections table
CREATE TABLE IF NOT EXISTS stock_selection (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES student(id) ON DELETE CASCADE,
    week_id BIGINT NOT NULL REFERENCES week(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    stock_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, week_id)
);

CREATE INDEX idx_stock_selection_student ON stock_selection(student_id);
CREATE INDEX idx_stock_selection_week ON stock_selection(week_id);
CREATE INDEX idx_stock_selection_ticker ON stock_selection(ticker);

-- Daily Price table
CREATE TABLE IF NOT EXISTS daily_price (
    id BIGSERIAL PRIMARY KEY,
    ticker TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    open DOUBLE PRECISION NOT NULL,
    high DOUBLE PRECISION NOT NULL,
    low DOUBLE PRECISION NOT NULL,
    close DOUBLE PRECISION NOT NULL,
    volume BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ticker, date)
);

CREATE INDEX idx_daily_price_ticker ON daily_price(ticker);
CREATE INDEX idx_daily_price_date ON daily_price(date);
CREATE INDEX idx_daily_price_ticker_date ON daily_price(ticker, date);

-- Intraday Price table
CREATE TABLE IF NOT EXISTS intraday_price (
    id BIGSERIAL PRIMARY KEY,
    ticker TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    volume BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ticker, timestamp)
);

CREATE INDEX idx_intraday_price_ticker ON intraday_price(ticker);
CREATE INDEX idx_intraday_price_timestamp ON intraday_price(timestamp);
CREATE INDEX idx_intraday_price_ticker_timestamp ON intraday_price(ticker, timestamp);

-- Rank History table
CREATE TABLE IF NOT EXISTS rank_history (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES student(id) ON DELETE CASCADE,
    week_id BIGINT NOT NULL REFERENCES week(id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    rank INTEGER NOT NULL,
    yield_pct DOUBLE PRECISION NOT NULL,
    current_price DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, week_id, date)
);

CREATE INDEX idx_rank_history_student ON rank_history(student_id);
CREATE INDEX idx_rank_history_week ON rank_history(week_id);
CREATE INDEX idx_rank_history_date ON rank_history(date);

-- Enable Row Level Security (RLS)
ALTER TABLE student ENABLE ROW LEVEL SECURITY;
ALTER TABLE week ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_selection ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_price ENABLE ROW LEVEL SECURITY;
ALTER TABLE intraday_price ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_history ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (you can modify these based on your needs)
CREATE POLICY "Enable read access for all users" ON student FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON week FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON stock_selection FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON daily_price FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON intraday_price FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON rank_history FOR SELECT USING (true);

-- Create policies for insert/update/delete (using service role key from API)
-- For now, we'll allow all operations for authenticated users
-- You should modify these policies based on your security requirements
CREATE POLICY "Enable insert for authenticated users" ON student FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON student FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON student FOR DELETE USING (true);

CREATE POLICY "Enable insert for authenticated users" ON week FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON week FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON week FOR DELETE USING (true);

CREATE POLICY "Enable insert for authenticated users" ON stock_selection FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON stock_selection FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON stock_selection FOR DELETE USING (true);

CREATE POLICY "Enable insert for authenticated users" ON daily_price FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON daily_price FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON daily_price FOR DELETE USING (true);

CREATE POLICY "Enable insert for authenticated users" ON intraday_price FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON intraday_price FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON intraday_price FOR DELETE USING (true);

CREATE POLICY "Enable insert for authenticated users" ON rank_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON rank_history FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users" ON rank_history FOR DELETE USING (true);
