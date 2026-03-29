# Student Stock Dashboard - Vercel & Supabase 배포 가이드

이 프로젝트는 **Supabase (PostgreSQL 데이터베이스) + Vercel (프론트엔드 & Serverless Functions)**로 배포됩니다.

## 📋 사전 준비

### 1. 필요한 계정
- [Supabase](https://supabase.com) 계정 (무료)
- [Vercel](https://vercel.com) 계정 (무료)

### 2. 로컬 설정
프로젝트를 GitHub에 업로드하기 전에 dashboard 폴더의 의존성을 설치하세요:

```bash
cd dashboard

# 루트 package.json 의존성 설치
npm install

# 프론트엔드 의존성 설치
cd frontend
npm install
```

---

## 🗄️ 1단계: Supabase 데이터베이스 설정

### 1.1 Supabase 프로젝트 생성
1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. "New Project" 클릭
3. 프로젝트 이름 입력 (예: `stock-dashboard`)
4. 데이터베이스 비밀번호 설정 (안전한 곳에 저장!)
5. 리전 선택 (가장 가까운 지역 선택)
6. "Create new project" 클릭

### 1.2 데이터베이스 스키마 생성
1. Supabase Dashboard에서 프로젝트 선택
2. 왼쪽 메뉴에서 **"SQL Editor"** 클릭
3. 프로젝트 루트의 `supabase-schema.sql` 파일 내용 복사
4. SQL Editor에 붙여넣고 **"Run"** 클릭
5. 성공 메시지 확인

### 1.3 Supabase 연결 정보 저장
Supabase Dashboard에서 다음 정보를 복사해두세요:

1. **Project Settings** → **API**로 이동
2. 다음 값들을 복사:
   - `Project URL` (SUPABASE_URL)
   - `service_role` key (SUPABASE_SERVICE_KEY) - **중요: anon key가 아닌 service_role key를 사용하세요!**

---

## 🚀 2단계: Vercel 배포

### 2.1 GitHub에 프로젝트 업로드
1. GitHub에 새 저장소 생성
2. dashboard 폴더를 GitHub에 푸시:

```bash
cd dashboard
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2.2 Vercel에 프로젝트 연결
1. [Vercel Dashboard](https://vercel.com/dashboard)에 로그인
2. **"Add New..."** → **"Project"** 클릭
3. GitHub 저장소 선택 및 Import
4. **Root Directory**를 `dashboard`로 설정 (중요!)
5. **Framework Preset**은 "Other" 선택
6. **Build Command**: `cd frontend && npm install && npm run build`
7. **Output Directory**: `frontend/dist`

### 2.3 환경 변수 설정
Vercel 프로젝트 설정에서 **Environment Variables** 추가:

```
SUPABASE_URL=<Supabase Project URL>
SUPABASE_SERVICE_KEY=<Supabase service_role key>
CRON_SECRET=<임의의 안전한 문자열> (예: your-secret-token-123)
```

**주의**: `SUPABASE_SERVICE_KEY`는 `service_role` 키를 사용해야 합니다 (`anon` 키가 아님).

### 2.4 배포
1. **"Deploy"** 버튼 클릭
2. 배포가 완료될 때까지 대기 (2-3분)
3. 배포 완료 후 제공되는 URL로 접속

---

## ⏰ 3단계: Cron Job 설정 확인

Vercel Cron은 자동으로 설정됩니다 (vercel.json 참조).

- **스케줄**: 매일 18:00 (한국 시간 기준)
- **작업**: 모든 주식 데이터 업데이트 + 일일 랭크 히스토리 저장

### Cron Job 수동 테스트
배포 후 다음 URL에 접속하여 수동으로 트리거할 수 있습니다:

```
https://your-vercel-domain.vercel.app/api/cron/daily-update
```

**Authorization 헤더 필요**:
```
Authorization: Bearer <your-CRON_SECRET>
```

또는 관리자 페이지에서 "Update" 버튼을 클릭하면 수동으로 동기화할 수 있습니다.

---

## 🎯 4단계: 초기 데이터 입력

### 4.1 관리자 계정 생성
Supabase Dashboard → **Table Editor** → `student` 테이블로 이동하여 관리자 계정을 추가:

```sql
INSERT INTO student (name, student_id)
VALUES ('전현민_admin', 'admin');
```

### 4.2 로그인 및 설정
1. 배포된 URL에 접속
2. `전현민_admin`으로 로그인
3. 관리자 페이지에서:
   - 주차 추가 (Week 번호, 시작일, 종료일)
   - 학생 추가
   - 학생별 티커 입력
4. "Update" 버튼 클릭하여 주식 데이터 다운로드

---

## 🔧 로컬 개발 환경 설정

### 로컬에서 테스트하기
```bash
cd dashboard

# 환경 변수 설정
echo "SUPABASE_URL=your-supabase-url" > .env
echo "SUPABASE_SERVICE_KEY=your-service-key" >> .env

# Vercel Dev 서버 시작
npx vercel dev
```

프론트엔드는 `http://localhost:3000`에서 실행됩니다.

---

## 📝 주요 기능

### API 엔드포인트
- `GET /api/weeks` - 모든 주차 조회
- `POST /api/weeks` - 새 주차 추가
- `GET /api/leaderboard?week_number=1` - 리더보드 조회
- `GET /api/students` - 모든 학생 조회
- `POST /api/login` - 로그인
- `POST /api/sync` - 수동 데이터 동기화
- `GET /api/rank-history/:week_number` - 랭크 히스토리 조회
- `GET /api/kospi/:week_number` - KOSPI 데이터 조회

### 자동화
- **매일 18:00**: 주식 데이터 자동 업데이트 및 랭크 히스토리 저장
- **실시간 수익률 계산**: 각 주차별 학생 순위 자동 계산

---

## 🐛 트러블슈팅

### 문제: API 호출 실패
- Supabase 환경 변수가 올바르게 설정되었는지 확인
- Vercel 배포 로그 확인 (`https://vercel.com/<your-project>/deployments`)

### 문제: Cron Job이 실행되지 않음
- Vercel의 Cron Jobs 탭에서 실행 로그 확인
- `CRON_SECRET` 환경 변수가 설정되었는지 확인

### 문제: 주식 데이터가 업데이트되지 않음
- Yahoo Finance API가 정상 작동하는지 확인
- 티커 심볼이 올바른지 확인 (한국 주식: `.KS` 또는 `.KQ` 접미사 필요)

---

## 📦 프로젝트 구조

```
dashboard/
├── api/                      # Vercel Serverless Functions
│   ├── lib/
│   │   ├── supabase.js      # Supabase 클라이언트
│   │   └── fetcher.js       # 주식 데이터 fetcher
│   ├── weeks.js             # 주차 관리 API
│   ├── leaderboard.js       # 리더보드 API
│   ├── students.js          # 학생 관리 API
│   ├── login.js             # 로그인 API
│   ├── sync.js              # 수동 동기화 API
│   └── cron/
│       └── daily-update.js  # 일일 cron job
├── frontend/                 # React 프론트엔드
│   ├── src/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   └── Admin.jsx
│   └── dist/                # 빌드 결과물
├── supabase-schema.sql      # 데이터베이스 스키마
├── vercel.json              # Vercel 설정
├── package.json             # 루트 의존성
└── DEPLOYMENT.md            # 이 문서
```

---

## 🎓 사용 방법

### 학생 사용자
1. 이름으로 로그인
2. 대시보드에서 자신의 순위와 수익률 확인
3. 주차별 KOSPI 대비 성과 확인

### 관리자
1. `전현민_admin`으로 로그인
2. 관리자 페이지에서:
   - 주차 생성/수정/삭제
   - 학생 추가/삭제
   - 학생별 티커 입력
   - 주차 확정 (확정된 주차는 데이터 재다운로드 방지)
   - 수동 데이터 업데이트

---

## 💡 팁

1. **주차 확정**: 주차가 완료되면 "확정" 버튼을 클릭하여 해당 주차의 가격 데이터가 변경되지 않도록 하세요.
2. **KOSPI 추가**: 자동으로 KOSPI 지수가 리더보드에 추가됩니다.
3. **데이터 업데이트**: 관리자 페이지의 "Update" 버튼으로 언제든 수동 업데이트 가능합니다.

---

## ✅ 배포 완료!

축하합니다! 이제 Student Stock Dashboard가 Vercel과 Supabase에 배포되었습니다.

**접속 URL**: `https://your-project.vercel.app`

문제가 발생하면 Vercel 배포 로그와 Supabase 로그를 확인하세요.
