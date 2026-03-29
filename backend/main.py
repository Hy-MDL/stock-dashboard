import threading
import time
import schedule
from fastapi import FastAPI, Depends, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from database import engine, Student, Week, StockSelection, DailyPrice, IntradayPrice, RankHistory
from fetcher import update_all_stocks
from database import create_db_and_tables
from datetime import datetime, timedelta
from pydantic import BaseModel

app = FastAPI(title="Student Stock Dashboard API")

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

def get_db():
    with Session(engine) as session:
        yield session

@app.get("/api/weeks")
def get_weeks(db: Session = Depends(get_db)):
    """Get all weeks."""
    weeks = db.exec(select(Week).order_by(Week.week_number)).all()
    return [{
        "id": w.id,
        "week_number": w.week_number,
        "week_start": w.week_start.isoformat(),
        "week_end": w.week_end.isoformat(),
        "is_confirmed": w.is_confirmed
    } for w in weeks]

@app.post("/api/weeks")
def create_week(request: WeekRequest, db: Session = Depends(get_db)):
    """Admin: Create a new week."""
    existing = db.exec(select(Week).where(Week.week_number == request.week_number)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Week already exists")

    week = Week(
        week_number=request.week_number,
        week_start=datetime.fromisoformat(request.week_start),
        week_end=datetime.fromisoformat(request.week_end)
    )
    db.add(week)
    db.commit()
    return {"message": "Week created successfully"}

@app.put("/api/weeks/{week_number}")
def update_week(week_number: int, request: WeekRequest, db: Session = Depends(get_db)):
    """Admin: Update week dates."""
    week = db.exec(select(Week).where(Week.week_number == week_number)).first()
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")

    week.week_start = datetime.fromisoformat(request.week_start)
    week.week_end = datetime.fromisoformat(request.week_end)
    db.commit()
    return {"message": "Week updated successfully"}

@app.delete("/api/weeks/{week_number}")
def delete_week(week_number: int, db: Session = Depends(get_db)):
    """Admin: Delete a week."""
    week = db.exec(select(Week).where(Week.week_number == week_number)).first()
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")

    db.delete(week)
    db.commit()
    return {"message": "Week deleted successfully"}

@app.post("/api/weeks/{week_number}/confirm")
def confirm_week(week_number: int, db: Session = Depends(get_db)):
    """Admin: Confirm a week (locks price data from being re-downloaded)."""
    week = db.exec(select(Week).where(Week.week_number == week_number)).first()
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")

    week.is_confirmed = True
    db.commit()
    return {"message": f"Week {week_number} confirmed"}

@app.get("/api/leaderboard")
def get_leaderboard(week_number: int = None, db: Session = Depends(get_db)):
    """Get leaderboard for a specific week."""
    if week_number is None:
        # Get latest week
        week = db.exec(select(Week).order_by(Week.week_number.desc())).first()
    else:
        week = db.exec(select(Week).where(Week.week_number == week_number)).first()

    if not week:
        return []

    # Get first trading day for this week (0일차) - same as rank history
    first_trading_day = db.exec(select(DailyPrice.date).where(
        DailyPrice.ticker == "^KS11",
        DailyPrice.date >= week.week_start,
        DailyPrice.date <= week.week_end
    ).order_by(DailyPrice.date.asc())).first()

    students = db.exec(select(Student)).all()
    results = []

    for student in students:
        # Skip admin accounts and KOSPI index from leaderboard
        if "_admin" in student.name.lower() or student.student_id == "KOSPI_INDEX":
            continue
        selection = db.exec(select(StockSelection).where(
            StockSelection.student_id == student.id,
            StockSelection.week_id == week.id
        )).first()

        if not selection:
            continue

        # Buy price: FIRST TRADING DAY OPEN (0일차 시가) - same as rank history
        buy_price_record = db.exec(select(DailyPrice).where(
            DailyPrice.ticker == selection.ticker,
            DailyPrice.date == first_trading_day
        ).order_by(DailyPrice.date.asc())).first()

        if not buy_price_record:
            continue

        buy_price = buy_price_record.open

        # Sell price: latest close price within the week period
        sell_price_record = db.exec(select(DailyPrice).where(
            DailyPrice.ticker == selection.ticker,
            DailyPrice.date >= week.week_start,
            DailyPrice.date <= week.week_end
        ).order_by(DailyPrice.date.desc())).first()

        if not sell_price_record:
            continue

        current_price = sell_price_record.close
        yield_pct = ((current_price - buy_price) / buy_price) * 100

        results.append({
            "id": student.id,
            "name": student.name,
            "student_id": student.student_id,
            "stock": selection.stock_name,
            "ticker": selection.ticker,
            "week_number": week.week_number,
            "buy_price": buy_price,
            "current_price": current_price,
            "yield": round(yield_pct, 2),
            "last_updated": sell_price_record.date.isoformat()
        })

    # Calculate KOSPI baseline - use first trading day open and last day within week
    kospi_buy = db.exec(select(DailyPrice).where(
        DailyPrice.ticker == "^KS11",
        DailyPrice.date == first_trading_day
    ).order_by(DailyPrice.date.asc())).first()

    kospi_sell = db.exec(select(DailyPrice).where(
        DailyPrice.ticker == "^KS11",
        DailyPrice.date >= week.week_start,
        DailyPrice.date <= week.week_end
    ).order_by(DailyPrice.date.desc())).first()

    kospi_yield = 0
    if kospi_buy and kospi_sell:
        kospi_yield = ((kospi_sell.close - kospi_buy.open) / kospi_buy.open) * 100
        # Add KOSPI as baseline entry
        results.append({
            "id": -1,  # Special ID for KOSPI
            "name": "KOSPI (기준선)",
            "student_id": "KOSPI",
            "stock": "KOSPI 지수",
            "ticker": "^KS11",
            "week_number": week.week_number,
            "buy_price": kospi_buy.open,
            "current_price": kospi_sell.close,
            "yield": round(kospi_yield, 2),
            "last_updated": kospi_sell.date.isoformat(),
            "rank": 0  # Will be set after sorting
        })

    results.sort(key=lambda x: x["yield"], reverse=True)
    for i, res in enumerate(results):
        res["rank"] = i + 1

    # Find students without stock selections for this week and add them with -1% below lowest
    all_students = db.exec(select(Student)).all()
    students_with_results = {r["id"] for r in results}

    # Find minimum yield
    min_yield = min([r["yield"] for r in results]) if results else 0
    penalty_yield = min_yield - 1.0  # 1% below the lowest

    for student in all_students:
        # Skip admin, KOSPI, and students already in results
        if ("_admin" in student.name.lower() or
            student.student_id == "KOSPI_INDEX" or
            student.id in students_with_results):
            continue

        # Check if student should have a selection for this week
        # (student exists but no ticker assigned)
        results.append({
            "id": student.id,
            "name": student.name,
            "student_id": student.student_id,
            "stock": "미선택",
            "ticker": "-",
            "week_number": week.week_number,
            "buy_price": 0,
            "current_price": 0,
            "yield": round(penalty_yield, 2),
            "last_updated": datetime.now().isoformat(),
            "rank": len(results) + 1
        })

    return results

@app.get("/api/students")
def get_students(db: Session = Depends(get_db)):
    """Get all students with their selections by week."""
    students = db.exec(select(Student)).all()
    weeks = db.exec(select(Week).order_by(Week.week_number)).all()

    result = []
    for student in students:
        student_data = {
            "id": student.id,
            "name": student.name,
            "student_id": student.student_id,
            "weeks": []
        }

        for week in weeks:
            selection = db.exec(select(StockSelection).where(
                StockSelection.student_id == student.id,
                StockSelection.week_id == week.id
            )).first()

            week_data = {
                "week_number": week.week_number,
                "week_start": week.week_start.isoformat(),
                "week_end": week.week_end.isoformat(),
                "ticker": selection.ticker if selection else None,
                "stock_name": selection.stock_name if selection else None
            }
            student_data["weeks"].append(week_data)

        result.append(student_data)

    return result

@app.post("/api/student-ticker")
def set_student_ticker(request: StudentTickerRequest, db: Session = Depends(get_db)):
    """Admin: Set student's ticker for a specific week."""
    student = db.get(Student, request.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    week = db.exec(select(Week).where(Week.week_number == request.week_number)).first()
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")

    # Update or create selection
    selection = db.exec(select(StockSelection).where(
        StockSelection.student_id == student.id,
        StockSelection.week_id == week.id
    )).first()

    if selection:
        selection.ticker = request.ticker
        selection.stock_name = request.stock_name
    else:
        selection = StockSelection(
            student_id=student.id,
            week_id=week.id,
            ticker=request.ticker,
            stock_name=request.stock_name
        )
        db.add(selection)

    db.commit()
    return {"message": "Ticker updated successfully"}

@app.post("/api/students")
def add_student(request: AddStudentRequest, db: Session = Depends(get_db)):
    """Admin: Add a new student."""
    # Check if student_id already exists
    existing = db.exec(select(Student).where(Student.student_id == request.student_id)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student ID already exists")

    student = Student(
        name=request.name,
        student_id=request.student_id
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    return {"message": "Student added successfully", "id": student.id}

@app.delete("/api/students/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    """Admin: Delete a student."""
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    db.delete(student)
    db.commit()

    return {"message": "Student deleted successfully"}

@app.post("/api/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Check if user exists and return user info with admin status."""
    student = db.exec(select(Student).where(Student.name == request.name)).first()

    if not student:
        raise HTTPException(status_code=404, detail="User not found")

    is_admin = request.name == "전현민_admin"

    return {
        "id": student.id,
        "name": student.name,
        "student_id": student.student_id,
        "is_admin": is_admin
    }

@app.post("/api/sync")
def trigger_sync(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Trigger full data refresh - delete only unconfirmed weeks' price data and re-fetch."""
    def full_refresh():
        with Session(engine) as session:
            # Get confirmed weeks date ranges
            confirmed_weeks = session.exec(select(Week).where(Week.is_confirmed == True)).all()
            confirmed_dates = set()
            for week in confirmed_weeks:
                current = week.week_start
                while current <= week.week_end:
                    confirmed_dates.add(current.date())
                    current += timedelta(days=1)

            # Delete price data NOT in confirmed date ranges
            for price in session.exec(select(DailyPrice)).all():
                if price.date.date() not in confirmed_dates:
                    session.delete(price)

            for price in session.exec(select(IntradayPrice)).all():
                if price.timestamp.date() not in confirmed_dates:
                    session.delete(price)

            session.commit()

        # Re-fetch all stock data (fetcher will skip if data already exists)
        update_all_stocks()

    background_tasks.add_task(full_refresh)
    return {"message": "Data refresh started - only unconfirmed weeks will be updated"}

def save_daily_ranks(db: Session):
    """Save daily rank snapshot for all weeks."""
    weeks = db.exec(select(Week)).all()
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for week in weeks:
        students = db.exec(select(Student)).all()
        temp_results = []

        for student in students:
            # Skip admin and KOSPI from rank history
            if "_admin" in student.name.lower() or student.student_id == "KOSPI_INDEX":
                continue

            selection = db.exec(select(StockSelection).where(
                StockSelection.student_id == student.id,
                StockSelection.week_id == week.id
            )).first()

            if not selection:
                continue

            # Buy price: week start open
            buy_price_record = db.exec(select(DailyPrice).where(
                DailyPrice.ticker == selection.ticker,
                DailyPrice.date >= week.week_start
            ).order_by(DailyPrice.date.asc())).first()

            if not buy_price_record:
                continue

            buy_price = buy_price_record.open

            # Current price: latest available
            sell_price_record = db.exec(select(DailyPrice).where(
                DailyPrice.ticker == selection.ticker
            ).order_by(DailyPrice.date.desc())).first()

            if not sell_price_record:
                continue

            current_price = sell_price_record.close
            yield_pct = ((current_price - buy_price) / buy_price) * 100

            temp_results.append({
                "student_id": student.id,
                "yield": yield_pct,
                "current_price": current_price
            })

        # Sort by yield and assign ranks
        temp_results.sort(key=lambda x: x["yield"], reverse=True)

        for rank, result in enumerate(temp_results, start=1):
            # Check if already exists for today
            existing = db.exec(select(RankHistory).where(
                RankHistory.student_id == result["student_id"],
                RankHistory.week_id == week.id,
                RankHistory.date == today
            )).first()

            if not existing:
                rank_entry = RankHistory(
                    student_id=result["student_id"],
                    week_id=week.id,
                    date=today,
                    rank=rank,
                    yield_pct=result["yield"],
                    current_price=result["current_price"]
                )
                db.add(rank_entry)

    db.commit()

def backfill_rank_history(db: Session):
    """Backfill rank history for all dates in each week period."""
    weeks = db.exec(select(Week)).all()

    for week in weeks:
        # Get all available trading dates in this week
        all_dates = db.exec(select(DailyPrice.date).where(
            DailyPrice.ticker == "^KS11",
            DailyPrice.date >= week.week_start,
            DailyPrice.date <= week.week_end
        ).order_by(DailyPrice.date)).all()

        unique_dates = sorted(set(d for d in all_dates))

        if not unique_dates:
            continue

        # Get first trading day for this week (0일차)
        first_trading_day = unique_dates[0]

        for target_date in unique_dates:
            target_date_normalized = target_date.replace(hour=0, minute=0, second=0, microsecond=0)

            students = db.exec(select(Student)).all()
            temp_results = []

            for student in students:
                # Skip admin and KOSPI from rank history
                if "_admin" in student.name.lower() or student.student_id == "KOSPI_INDEX":
                    continue

                selection = db.exec(select(StockSelection).where(
                    StockSelection.student_id == student.id,
                    StockSelection.week_id == week.id
                )).first()

                if not selection:
                    continue

                # Buy price: FIRST TRADING DAY OPEN (0일차 시가)
                buy_price_record = db.exec(select(DailyPrice).where(
                    DailyPrice.ticker == selection.ticker,
                    DailyPrice.date == first_trading_day
                ).order_by(DailyPrice.date.asc())).first()

                if not buy_price_record:
                    continue

                buy_price = buy_price_record.open

                # Current price: close price at target_date
                if target_date == first_trading_day:
                    # 0일차: 시가 기준이므로 수익률은 0%
                    current_price = buy_price
                    yield_pct = 0.0
                else:
                    sell_price_record = db.exec(select(DailyPrice).where(
                        DailyPrice.ticker == selection.ticker,
                        DailyPrice.date == target_date
                    ).order_by(DailyPrice.date.desc())).first()

                    if not sell_price_record:
                        continue

                    current_price = sell_price_record.close
                    yield_pct = ((current_price - buy_price) / buy_price) * 100

                temp_results.append({
                    "student_id": student.id,
                    "yield": yield_pct,
                    "current_price": current_price
                })

            # Sort by yield and assign ranks
            temp_results.sort(key=lambda x: x["yield"], reverse=True)

            for rank, result in enumerate(temp_results, start=1):
                # Check if already exists for this date
                existing = db.exec(select(RankHistory).where(
                    RankHistory.student_id == result["student_id"],
                    RankHistory.week_id == week.id,
                    RankHistory.date == target_date_normalized
                )).first()

                if existing:
                    # Update existing record
                    existing.rank = rank
                    existing.yield_pct = result["yield"]
                    existing.current_price = result["current_price"]
                else:
                    rank_entry = RankHistory(
                        student_id=result["student_id"],
                        week_id=week.id,
                        date=target_date_normalized,
                        rank=rank,
                        yield_pct=result["yield"],
                        current_price=result["current_price"]
                    )
                    db.add(rank_entry)

        db.commit()

@app.get("/api/rank-history/{week_number}")
def get_rank_history(week_number: int, db: Session = Depends(get_db)):
    """Get historical rank data for a specific week."""
    week = db.exec(select(Week).where(Week.week_number == week_number)).first()
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")

    history_records = db.exec(select(RankHistory).where(
        RankHistory.week_id == week.id
    ).order_by(RankHistory.date)).all()

    # Group by student
    student_history = {}
    for record in history_records:
        student = db.get(Student, record.student_id)
        if student.id not in student_history:
            student_history[student.id] = {
                "student_id": student.id,
                "name": student.name,
                "student_number": student.student_id,
                "data": []
            }
        student_history[student.id]["data"].append({
            "date": record.date.isoformat(),
            "rank": record.rank,
            "yield": round(record.yield_pct, 2)
        })

    return list(student_history.values())

@app.get("/api/kospi/{week_number}")
def get_kospi_data(week_number: int, db: Session = Depends(get_db)):
    """Get KOSPI index performance for a specific week."""
    week = db.exec(select(Week).where(Week.week_number == week_number)).first()
    if not week:
        raise HTTPException(status_code=404, detail="Week not found")

    # Find KOSPI student
    kospi = db.exec(select(Student).where(Student.student_id == "KOSPI_INDEX")).first()
    if not kospi:
        return None

    # Buy price: week start open
    buy_price_record = db.exec(select(DailyPrice).where(
        DailyPrice.ticker == "^KS11",
        DailyPrice.date >= week.week_start
    ).order_by(DailyPrice.date.asc())).first()

    if not buy_price_record:
        return None

    buy_price = buy_price_record.open

    # Get all daily prices for this week for chart
    if datetime.now() > week.week_end:
        daily_prices = db.exec(select(DailyPrice).where(
            DailyPrice.ticker == "^KS11",
            DailyPrice.date >= week.week_start,
            DailyPrice.date <= week.week_end
        ).order_by(DailyPrice.date)).all()
    else:
        daily_prices = db.exec(select(DailyPrice).where(
            DailyPrice.ticker == "^KS11",
            DailyPrice.date >= week.week_start
        ).order_by(DailyPrice.date)).all()

    if not daily_prices:
        return None

    current_price = daily_prices[-1].close
    yield_pct = ((current_price - buy_price) / buy_price) * 100

    return {
        "buy_price": round(buy_price, 2),
        "current_price": round(current_price, 2),
        "yield": round(yield_pct, 2),
        "daily_data": [{
            "date": p.date.isoformat(),
            "price": round(p.close, 2)
        } for p in daily_prices]
    }

# Background Scheduler
def run_scheduler():
    def sync_and_save_ranks():
        """Update stock data and save daily ranks."""
        update_all_stocks()
        with Session(engine) as session:
            save_daily_ranks(session)

    schedule.every(5).minutes.do(update_all_stocks)
    schedule.every().day.at("18:00").do(sync_and_save_ranks)  # Daily at 6 PM

    while True:
        schedule.run_pending()
        time.sleep(1)

@app.on_event("startup")
def startup_event():
    create_db_and_tables()  # Ensure RankHistory table exists
    threading.Thread(target=run_scheduler, daemon=True).start()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
