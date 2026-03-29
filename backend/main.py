import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from database_supabase import supabase

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Student Stock Dashboard API")

@app.on_event("startup")
async def startup_event():
    port = os.environ.get("PORT", "8000")
    logger.info(f"--- Server starting up on port {port} ---")
    logger.info(f"--- Supabase client initialized ---")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class LoginRequest(BaseModel):
    name: str

class WeekRequest(BaseModel):
    week_number: int
    week_start: str
    week_end: str

class StudentTickerRequest(BaseModel):
    student_id: int
    week_number: int
    ticker: str
    stock_name: str

class AddStudentRequest(BaseModel):
    name: str
    student_id: str

@app.get("/")
def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "Student Stock Dashboard API"}

@app.get("/api/weeks")
def get_weeks():
    """Get all weeks."""
    response = supabase.table('week').select('*').order('week_number').execute()
    return [{
        "id": w["id"],
        "week_number": w["week_number"],
        "week_start": w["week_start"],
        "week_end": w["week_end"],
        "is_confirmed": w.get("is_confirmed", False)
    } for w in response.data]

@app.post("/api/weeks")
def create_week(request: WeekRequest):
    """Admin: Create a new week."""
    existing = supabase.table('week').select('*').eq('week_number', request.week_number).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Week already exists")

    supabase.table('week').insert({
        "week_number": request.week_number,
        "week_start": request.week_start,
        "week_end": request.week_end,
        "is_confirmed": False
    }).execute()

    return {"message": "Week created successfully"}

@app.put("/api/weeks/{week_number}")
def update_week(week_number: int, request: WeekRequest):
    """Admin: Update week dates."""
    week = supabase.table('week').select('*').eq('week_number', week_number).execute()
    if not week.data:
        raise HTTPException(status_code=404, detail="Week not found")

    supabase.table('week').update({
        "week_start": request.week_start,
        "week_end": request.week_end
    }).eq('week_number', week_number).execute()

    return {"message": "Week updated successfully"}

@app.delete("/api/weeks/{week_number}")
def delete_week(week_number: int):
    """Admin: Delete a week."""
    week = supabase.table('week').select('*').eq('week_number', week_number).execute()
    if not week.data:
        raise HTTPException(status_code=404, detail="Week not found")

    supabase.table('week').delete().eq('week_number', week_number).execute()
    return {"message": "Week deleted successfully"}

@app.post("/api/weeks/{week_number}/confirm")
def confirm_week(week_number: int):
    """Admin: Confirm a week (locks price data from being re-downloaded)."""
    week = supabase.table('week').select('*').eq('week_number', week_number).execute()
    if not week.data:
        raise HTTPException(status_code=404, detail="Week not found")

    supabase.table('week').update({"is_confirmed": True}).eq('week_number', week_number).execute()
    return {"message": f"Week {week_number} confirmed"}

@app.get("/api/leaderboard")
def get_leaderboard(week_number: int = None):
    """Get leaderboard for a specific week."""
    if week_number is None:
        week_response = supabase.table('week').select('*').order('week_number', desc=True).limit(1).execute()
    else:
        week_response = supabase.table('week').select('*').eq('week_number', week_number).execute()

    if not week_response.data:
        return []

    week = week_response.data[0]

    # Get all students
    students_response = supabase.table('student').select('*').execute()
    students = students_response.data

    results = []

    for student in students:
        # Skip admin accounts and KOSPI index from leaderboard
        if "_admin" in student["name"].lower() or student["student_id"] == "KOSPI_INDEX":
            continue

        # Get stock selection for this week
        selection_response = supabase.table('stock_selection').select('*').eq('student_id', student["id"]).eq('week_id', week["id"]).execute()

        if not selection_response.data:
            continue

        selection = selection_response.data[0]

        # Get price data for the ticker
        prices_response = supabase.table('daily_price').select('*').eq('ticker', selection["ticker"]).gte('date', week["week_start"]).lte('date', week["week_end"]).order('date').execute()

        if not prices_response.data:
            continue

        prices = prices_response.data
        buy_price = prices[0]["open"]
        current_price = prices[-1]["close"]
        yield_pct = ((current_price - buy_price) / buy_price) * 100

        results.append({
            "id": student["id"],
            "name": student["name"],
            "student_id": student["student_id"],
            "stock": selection["stock_name"],
            "ticker": selection["ticker"],
            "week_number": week["week_number"],
            "buy_price": buy_price,
            "current_price": current_price,
            "yield": round(yield_pct, 2),
            "last_updated": prices[-1]["date"]
        })

    # Add KOSPI baseline
    kospi_prices = supabase.table('daily_price').select('*').eq('ticker', '^KS11').gte('date', week["week_start"]).lte('date', week["week_end"]).order('date').execute()

    if kospi_prices.data:
        kospi_buy = kospi_prices.data[0]["open"]
        kospi_sell = kospi_prices.data[-1]["close"]
        kospi_yield = ((kospi_sell - kospi_buy) / kospi_buy) * 100

        results.append({
            "id": -1,
            "name": "KOSPI (기준선)",
            "student_id": "KOSPI",
            "stock": "KOSPI 지수",
            "ticker": "^KS11",
            "week_number": week["week_number"],
            "buy_price": kospi_buy,
            "current_price": kospi_sell,
            "yield": round(kospi_yield, 2),
            "last_updated": kospi_prices.data[-1]["date"]
        })

    # Sort and rank
    results.sort(key=lambda x: x["yield"], reverse=True)
    for i, res in enumerate(results):
        res["rank"] = i + 1

    return results

@app.get("/api/students")
def get_students():
    """Get all students with their selections by week."""
    students_response = supabase.table('student').select('*').execute()
    students = students_response.data

    weeks_response = supabase.table('week').select('*').order('week_number').execute()
    weeks = weeks_response.data

    result = []
    for student in students:
        student_data = {
            "id": student["id"],
            "name": student["name"],
            "student_id": student["student_id"],
            "weeks": []
        }

        for week in weeks:
            selection_response = supabase.table('stock_selection').select('*').eq('student_id', student["id"]).eq('week_id', week["id"]).execute()

            selection = selection_response.data[0] if selection_response.data else None

            week_data = {
                "week_number": week["week_number"],
                "week_start": week["week_start"],
                "week_end": week["week_end"],
                "ticker": selection["ticker"] if selection else None,
                "stock_name": selection["stock_name"] if selection else None
            }
            student_data["weeks"].append(week_data)

        result.append(student_data)

    return result

@app.post("/api/student-ticker")
def set_student_ticker(request: StudentTickerRequest):
    """Admin: Set student's ticker for a specific week."""
    student_response = supabase.table('student').select('*').eq('id', request.student_id).execute()
    if not student_response.data:
        raise HTTPException(status_code=404, detail="Student not found")

    week_response = supabase.table('week').select('*').eq('week_number', request.week_number).execute()
    if not week_response.data:
        raise HTTPException(status_code=404, detail="Week not found")

    week = week_response.data[0]

    # Check if selection exists
    selection_response = supabase.table('stock_selection').select('*').eq('student_id', request.student_id).eq('week_id', week["id"]).execute()

    if selection_response.data:
        # Update
        supabase.table('stock_selection').update({
            "ticker": request.ticker,
            "stock_name": request.stock_name
        }).eq('student_id', request.student_id).eq('week_id', week["id"]).execute()
    else:
        # Insert
        supabase.table('stock_selection').insert({
            "student_id": request.student_id,
            "week_id": week["id"],
            "ticker": request.ticker,
            "stock_name": request.stock_name
        }).execute()

    return {"message": "Ticker updated successfully"}

@app.post("/api/students")
def add_student(request: AddStudentRequest):
    """Admin: Add a new student."""
    existing = supabase.table('student').select('*').eq('student_id', request.student_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Student ID already exists")

    result = supabase.table('student').insert({
        "name": request.name,
        "student_id": request.student_id
    }).execute()

    return {"message": "Student added successfully", "id": result.data[0]["id"]}

@app.delete("/api/students/{student_id}")
def delete_student(student_id: int):
    """Admin: Delete a student."""
    student = supabase.table('student').select('*').eq('id', student_id).execute()
    if not student.data:
        raise HTTPException(status_code=404, detail="Student not found")

    supabase.table('student').delete().eq('id', student_id).execute()
    return {"message": "Student deleted successfully"}

@app.post("/api/login")
def login(request: LoginRequest):
    """Check if user exists and return user info with admin status."""
    student_response = supabase.table('student').select('*').eq('name', request.name).execute()

    if not student_response.data:
        raise HTTPException(status_code=404, detail="User not found")

    student = student_response.data[0]
    is_admin = request.name == "전현민_admin"

    return {
        "id": student["id"],
        "name": student["name"],
        "student_id": student["student_id"],
        "is_admin": is_admin
    }

@app.get("/api/rank-history/{week_number}")
def get_rank_history(week_number: int):
    """Get historical rank data for a specific week."""
    week_response = supabase.table('week').select('*').eq('week_number', week_number).execute()
    if not week_response.data:
        raise HTTPException(status_code=404, detail="Week not found")

    week = week_response.data[0]

    history_response = supabase.table('rank_history').select('*').eq('week_id', week["id"]).order('date').execute()

    # Group by student
    student_history = {}
    for record in history_response.data:
        student_response = supabase.table('student').select('*').eq('id', record["student_id"]).execute()
        if student_response.data:
            student = student_response.data[0]
            if student["id"] not in student_history:
                student_history[student["id"]] = {
                    "student_id": student["id"],
                    "name": student["name"],
                    "student_number": student["student_id"],
                    "data": []
                }
            student_history[student["id"]]["data"].append({
                "date": record["date"],
                "rank": record["rank"],
                "yield": round(record["yield_pct"], 2)
            })

    return list(student_history.values())

@app.get("/api/kospi/{week_number}")
def get_kospi_data(week_number: int):
    """Get KOSPI index performance for a specific week."""
    week_response = supabase.table('week').select('*').eq('week_number', week_number).execute()
    if not week_response.data:
        raise HTTPException(status_code=404, detail="Week not found")

    week = week_response.data[0]

    # Get KOSPI prices for the week
    prices_response = supabase.table('daily_price').select('*').eq('ticker', '^KS11').gte('date', week["week_start"]).lte('date', week["week_end"]).order('date').execute()

    if not prices_response.data:
        return None

    prices = prices_response.data
    buy_price = prices[0]["open"]
    current_price = prices[-1]["close"]
    yield_pct = ((current_price - buy_price) / buy_price) * 100

    return {
        "buy_price": round(buy_price, 2),
        "current_price": round(current_price, 2),
        "yield": round(yield_pct, 2),
        "daily_data": [{
            "date": p["date"],
            "price": round(p["close"], 2)
        } for p in prices]
    }

@app.post("/api/sync")
def sync_data():
    """Admin: Manually sync all stock data using yfinance and store in Supabase."""
    try:
        import yfinance as yf
        import requests
        from database_supabase import StockSelection, DailyPrice

        # Setup session with User-Agent to avoid being blocked
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })

        # 1. Get all unique tickers from stock selections
        response = supabase.table('stock_selection').select('ticker').execute()
        tickers = list(set([r['ticker'] for r in response.data]))
        
        # Add KOSPI index to sync list
        if "^KS11" not in tickers:
            tickers.append("^KS11")

        logger.info(f"Syncing data for tickers: {tickers}")

        count = 0
        for ticker in tickers:
            try:
                # Pass session to Ticker
                stock = yf.Ticker(ticker, session=session)
                # Fetch last 3 months
                df = stock.history(period="3mo", interval="1d", auto_adjust=False)
                
                if df.empty:
                    logger.warning(f"No data found for {ticker}")
                    continue

                for date, row in df.iterrows():
                    formatted_date = date.strftime('%Y-%m-%d')
                    
                    supabase.table('daily_price').upsert({
                        'ticker': ticker,
                        'date': formatted_date,
                        'open': float(row["Open"]),
                        'high': float(row["High"]),
                        'low': float(row["Low"]),
                        'close': float(row["Close"]),
                        'volume': int(row["Volume"])
                    }, on_conflict='ticker,date').execute()
                
                count += 1
                logger.info(f"Successfully synced {ticker}")
            except Exception as ticker_err:
                logger.error(f"Error syncing ticker {ticker}: {ticker_err}")

        return {"message": f"Sync completed. Updated {count} stocks."}
    except Exception as e:
        logger.error(f"Sync overall error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
