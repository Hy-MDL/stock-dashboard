import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from sqlmodel import Session, select
from database import engine, DailyPrice, IntradayPrice, StockSelection

def fetch_stock_data(ticker: str, days: int = 7):
    """Fetch 5m and daily data for a ticker and store in DB."""
    stock = yf.Ticker(ticker)

    # 1. Fetch Daily Data (Full history for Friday Open/Thursday Close)
    # We fetch a bit more than needed to ensure we have the dates
    # auto_adjust=False to get actual trading prices (not dividend-adjusted)
    df_daily = stock.history(period="3mo", interval="1d", auto_adjust=False)
    if not df_daily.empty:
        with Session(engine) as session:
            for date, row in df_daily.iterrows():
                # Check if already exists
                existing = session.exec(select(DailyPrice).where(
                    DailyPrice.ticker == ticker,
                    DailyPrice.date == date.to_pydatetime()
                )).first()
                
                if not existing:
                    dp = DailyPrice(
                        ticker=ticker,
                        date=date.to_pydatetime(),
                        open=row["Open"],
                        high=row["High"],
                        low=row["Low"],
                        close=row["Close"],
                        volume=int(row["Volume"])
                    )
                    session.add(dp)
            session.commit()

    # 2. Fetch Intraday 5m Data (Last 'days' days)
    # yfinance limit: 5m data only for last 60 days
    df_5m = stock.history(period=f"{days}d", interval="5m", auto_adjust=False)
    if not df_5m.empty:
        with Session(engine) as session:
            for ts, row in df_5m.iterrows():
                # Check if already exists (to avoid duplicates when concat)
                existing = session.exec(select(IntradayPrice).where(
                    IntradayPrice.ticker == ticker,
                    IntradayPrice.timestamp == ts.to_pydatetime()
                )).first()
                
                if not existing:
                    ip = IntradayPrice(
                        ticker=ticker,
                        timestamp=ts.to_pydatetime(),
                        price=row["Close"],
                        volume=int(row["Volume"])
                    )
                    session.add(ip)
            session.commit()

def update_all_stocks():
    """Sync all tickers in StockSelection."""
    with Session(engine) as session:
        tickers = session.exec(select(StockSelection.ticker).distinct()).all()
    
    for ticker in tickers:
        print(f"Fetching {ticker}...")
        try:
            fetch_stock_data(ticker)
        except Exception as e:
            print(f"Error fetching {ticker}: {e}")

if __name__ == "__main__":
    update_all_stocks()
    print("All stocks updated.")
