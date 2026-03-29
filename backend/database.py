from datetime import datetime
from typing import List, Optional
from sqlmodel import Field, Relationship, SQLModel, create_engine, Session

class Student(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    student_id: str = Field(index=True, unique=True)
    selections: List["StockSelection"] = Relationship(back_populates="student")

class Week(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    week_number: int = Field(index=True, unique=True)  # 1, 2, 3, ...
    week_start: datetime  # Week start date
    week_end: datetime  # Week end date
    is_confirmed: bool = Field(default=False)  # If confirmed, don't re-download data
    selections: List["StockSelection"] = Relationship(back_populates="week")

class StockSelection(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int = Field(foreign_key="student.id")
    week_id: int = Field(foreign_key="week.id", index=True)
    ticker: str = Field(index=True)
    stock_name: str
    student: Student = Relationship(back_populates="selections")
    week: Week = Relationship(back_populates="selections")

class DailyPrice(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True)
    date: datetime = Field(index=True)
    open: float
    high: float
    low: float
    close: float
    volume: int

class IntradayPrice(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True)
    timestamp: datetime = Field(index=True)
    price: float
    volume: int

class RankHistory(SQLModel, table=True):
    """Stores daily rank snapshots for each student per week."""
    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int = Field(foreign_key="student.id", index=True)
    week_id: int = Field(foreign_key="week.id", index=True)
    date: datetime = Field(index=True)  # Date of the snapshot
    rank: int
    yield_pct: float
    current_price: float

sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

engine = create_engine(sqlite_url, echo=False)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
