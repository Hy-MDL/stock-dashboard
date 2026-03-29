import os
from supabase import create_client, Client
from datetime import datetime
from typing import Optional

# Supabase connection
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")

supabase: Client = create_client(supabase_url, supabase_key)

# Helper functions to replace SQLModel operations

class Student:
    @staticmethod
    def get_all():
        return supabase.table('student').select('*').execute().data

    @staticmethod
    def get_by_id(student_id: int):
        result = supabase.table('student').select('*').eq('id', student_id).execute()
        return result.data[0] if result.data else None

    @staticmethod
    def get_by_name(name: str):
        result = supabase.table('student').select('*').eq('name', name).execute()
        return result.data[0] if result.data else None

    @staticmethod
    def create(name: str, student_id: str):
        return supabase.table('student').insert({
            'name': name,
            'student_id': student_id
        }).execute().data[0]

    @staticmethod
    def delete(student_id: int):
        supabase.table('student').delete().eq('id', student_id).execute()

class Week:
    @staticmethod
    def get_all():
        return supabase.table('week').select('*').order('week_number').execute().data

    @staticmethod
    def get_by_number(week_number: int):
        result = supabase.table('week').select('*').eq('week_number', week_number).execute()
        return result.data[0] if result.data else None

    @staticmethod
    def create(week_number: int, week_start: str, week_end: str):
        return supabase.table('week').insert({
            'week_number': week_number,
            'week_start': week_start,
            'week_end': week_end,
            'is_confirmed': False
        }).execute().data[0]

    @staticmethod
    def update(week_number: int, week_start: str, week_end: str):
        supabase.table('week').update({
            'week_start': week_start,
            'week_end': week_end
        }).eq('week_number', week_number).execute()

    @staticmethod
    def confirm(week_number: int):
        supabase.table('week').update({
            'is_confirmed': True
        }).eq('week_number', week_number).execute()

    @staticmethod
    def delete(week_number: int):
        supabase.table('week').delete().eq('week_number', week_number).execute()

class StockSelection:
    @staticmethod
    def get_by_student_week(student_id: int, week_id: int):
        result = supabase.table('stock_selection').select('*').eq('student_id', student_id).eq('week_id', week_id).execute()
        return result.data[0] if result.data else None

    @staticmethod
    def get_all_tickers():
        result = supabase.table('stock_selection').select('ticker').execute()
        return [r['ticker'] for r in result.data]

    @staticmethod
    def upsert(student_id: int, week_id: int, ticker: str, stock_name: str):
        existing = StockSelection.get_by_student_week(student_id, week_id)

        if existing:
            supabase.table('stock_selection').update({
                'ticker': ticker,
                'stock_name': stock_name
            }).eq('student_id', student_id).eq('week_id', week_id).execute()
        else:
            supabase.table('stock_selection').insert({
                'student_id': student_id,
                'week_id': week_id,
                'ticker': ticker,
                'stock_name': stock_name
            }).execute()

class DailyPrice:
    @staticmethod
    def get_by_ticker_date(ticker: str, date: str):
        result = supabase.table('daily_price').select('*').eq('ticker', ticker).eq('date', date).execute()
        return result.data[0] if result.data else None

    @staticmethod
    def get_by_ticker_range(ticker: str, start_date: str, end_date: str):
        return supabase.table('daily_price').select('*').eq('ticker', ticker).gte('date', start_date).lte('date', end_date).order('date').execute().data

    @staticmethod
    def get_latest_by_ticker(ticker: str):
        result = supabase.table('daily_price').select('*').eq('ticker', ticker).order('date', desc=True).limit(1).execute()
        return result.data[0] if result.data else None

    @staticmethod
    def upsert(ticker: str, date: str, open_price: float, high: float, low: float, close: float, volume: int):
        supabase.table('daily_price').upsert({
            'ticker': ticker,
            'date': date,
            'open': open_price,
            'high': high,
            'low': low,
            'close': close,
            'volume': volume
        }, on_conflict='ticker,date').execute()

class RankHistory:
    @staticmethod
    def get_by_week(week_id: int):
        return supabase.table('rank_history').select('*').eq('week_id', week_id).order('date').execute().data

    @staticmethod
    def get_by_student_week_date(student_id: int, week_id: int, date: str):
        result = supabase.table('rank_history').select('*').eq('student_id', student_id).eq('week_id', week_id).eq('date', date).execute()
        return result.data[0] if result.data else None

    @staticmethod
    def insert(student_id: int, week_id: int, date: str, rank: int, yield_pct: float, current_price: float):
        supabase.table('rank_history').insert({
            'student_id': student_id,
            'week_id': week_id,
            'date': date,
            'rank': rank,
            'yield_pct': yield_pct,
            'current_price': current_price
        }).execute()

def create_db_and_tables():
    """Not needed for Supabase - tables created via SQL"""
    pass
