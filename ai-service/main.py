import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from services.db import get_pool, close_pool
from middleware.auth import InternalKeyMiddleware
from routers import scorecard
from routers import resume
from routers import interview
from routers import jd
from routers import screening_test

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await get_pool()
        print("INFO: Database pool initialized")
    except Exception as e:
        print(f"WARNING: Could not connect to database at startup: {e}")
    yield
    await close_pool()

app = FastAPI(title="AI Recruiter Service", lifespan=lifespan)

# CORS — allow Vercel frontend + backend origins
_allowed_origins = [
    o.strip() for o in os.getenv("ALLOWED_ORIGIN", "http://localhost:3000,http://localhost:4000").split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(InternalKeyMiddleware)

app.include_router(scorecard.router)
app.include_router(resume.router)
app.include_router(interview.router)
app.include_router(jd.router)
app.include_router(screening_test.router)

@app.get("/health")
async def health():
    return {"status": "ok"}
