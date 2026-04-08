# Travel App

Single-repo travel app with:
- Frontend: React + Vite
- Backend: FastAPI
- APIs: Skyscanner, Booking.com, OpenWeather via RapidAPI
- Deployment: Railway

## Structure
- `backend/` FastAPI service
- `frontend/` React app

## Local run
### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8001
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Railway
Deploy backend and frontend as two services from the same GitHub repo.
- Backend root directory: `backend`
- Frontend root directory: `frontend`
