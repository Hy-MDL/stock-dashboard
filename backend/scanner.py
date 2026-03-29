import os
import re
import pandas as pd
from database import Student, Week, StockSelection, Session, engine, create_db_and_tables
from datetime import datetime
from sqlmodel import select

# Path to the base directory
BASE_DIR = "/Users/jeonhyeonmin/Downloads/금융공학 (IIE3111.01-00)-금융공학 종목추천_1주차-4354765"

# Hand-coded list from original script as fallback/initial seed
INITIAL_DATA = [
    {"name": "전현민_admin", "student_id": "ADMIN001", "stock": "삼성전자", "ticker": "005930.KS"},
    {"name": "이진형", "student_id": "2020147016", "stock": "바이오솔루션", "ticker": "086820.KQ"},
    {"name": "장시연", "student_id": "2023147050", "stock": "LG이노텍", "ticker": "011070.KS"},
    {"name": "이제우", "student_id": "2022147032", "stock": "XOM", "ticker": "XOM"},
    {"name": "허우석", "student_id": "2022147020", "stock": "CTRA", "ticker": "CTRA"},
    {"name": "이준회", "student_id": "2021147031", "stock": "네오펙트", "ticker": "290660.KQ"},
    {"name": "구본석", "student_id": "2022147021", "stock": "대덕전자", "ticker": "008060.KS"},
    {"name": "장선아", "student_id": "2023195104", "stock": "피에스케이홀딩스", "ticker": "031980.KS"},
    {"name": "유지환", "student_id": "2021134013", "stock": "인스코비", "ticker": "499110.KQ"},
    {"name": "구범서", "student_id": "2022147036", "stock": "한화에어로스페이스", "ticker": "012450.KS"},
    {"name": "김동엽", "student_id": "2020147504", "stock": "LSelectronic", "ticker": "089140.KS"},
    {"name": "조재우", "student_id": "2022116010", "stock": "피에스케이", "ticker": "319660.KS"},
    {"name": "송성철", "student_id": "2020147022", "stock": "삼성전자", "ticker": "005930.KS"},
    {"name": "박상혁", "student_id": "2021147013", "stock": "MNST", "ticker": "MNST"},
    {"name": "김성민", "student_id": "2021144011", "stock": "SK하이닉스", "ticker": "000660.KS"},
    {"name": "이지원", "student_id": "2025136002", "stock": "한화에어로스페이스", "ticker": "012450.KS"},
    {"name": "한서희", "student_id": "2022144044", "stock": "우리기술", "ticker": "032820.KQ"},
    {"name": "신은교", "student_id": "2024147021", "stock": "대우건설", "ticker": "047040.KS"},
    {"name": "박태훈", "student_id": "2021147003", "stock": "세아철강지주", "ticker": "003030.KS"},
    {"name": "김시형", "student_id": "2022147014", "stock": "신성이엔지", "ticker": "011930.KS"},
    {"name": "박세원", "student_id": "2025147046", "stock": "한화솔루션", "ticker": "009830.KS"},
    {"name": "박정현", "student_id": "2022147034", "stock": "이수페타시스", "ticker": "007660.KS"},
    {"name": "설재형", "student_id": "2021147045", "stock": "CJ", "ticker": "001040.KS"},
    {"name": "진영웅", "student_id": "2020125090", "stock": "디아이", "ticker": "003160.KS"},
    {"name": "문승재", "student_id": "2021245118", "stock": "SK스퀘어", "ticker": "402340.KS"},
    {"name": "장현주", "student_id": "2022121169", "stock": "LG이노텍", "ticker": "011070.KS"},
    {"name": "한묘희", "student_id": "2023113022", "stock": "대우건설", "ticker": "047040.KS"},
    {"name": "권창한", "student_id": "2021145049", "stock": "GS건설", "ticker": "006360.KS"},
    {"name": "이태주", "student_id": "2020147009", "stock": "한국항공우주", "ticker": "047810.KS"},
    {"name": "남승민", "student_id": "2021246003", "stock": "한미반도체", "ticker": "042700.KQ"},
    {"name": "최동락", "student_id": "2022147040", "stock": "SK하이닉스", "ticker": "000660.KS"},
    {"name": "이도연", "student_id": "2020147034", "stock": "삼성전자", "ticker": "005930.KS"},
]

def sync_students():
    create_db_and_tables()
    with Session(engine) as session:
        # Create Week 1 if not exists
        week1 = session.exec(select(Week).where(Week.week_number == 1)).first()
        if not week1:
            week1 = Week(
                week_number=1,
                week_start=datetime(2026, 2, 27),
                week_end=datetime(2026, 3, 5)
            )
            session.add(week1)
            session.commit()
            session.refresh(week1)

        # Add KOSPI as a benchmark student
        kospi_student = session.exec(select(Student).where(Student.student_id == "KOSPI_INDEX")).first()
        if not kospi_student:
            kospi_student = Student(name="KOSPI", student_id="KOSPI_INDEX")
            session.add(kospi_student)
            session.commit()
            session.refresh(kospi_student)

        # Add KOSPI ticker for Week 1
        kospi_selection = session.exec(select(StockSelection).where(
            StockSelection.student_id == kospi_student.id,
            StockSelection.week_id == week1.id
        )).first()

        if not kospi_selection:
            kospi_selection = StockSelection(
                student_id=kospi_student.id,
                week_id=week1.id,
                ticker="^KS11",
                stock_name="KOSPI"
            )
            session.add(kospi_selection)
            session.commit()

        for item in INITIAL_DATA:
            # Add student if not exists
            student = session.exec(select(Student).where(Student.student_id == item["student_id"])).first()
            if not student:
                student = Student(name=item["name"], student_id=item["student_id"])
                session.add(student)
                session.commit()
                session.refresh(student)

            # Add selection for Week 1
            selection = session.exec(select(StockSelection).where(
                StockSelection.student_id == student.id,
                StockSelection.week_id == week1.id
            )).first()

            if not selection:
                selection = StockSelection(
                    student_id=student.id,
                    week_id=week1.id,
                    ticker=item["ticker"],
                    stock_name=item["stock"]
                )
                session.add(selection)

        session.commit()

if __name__ == "__main__":
    sync_students()
    print("Student sync complete.")
