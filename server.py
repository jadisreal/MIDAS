"""
MIDAS Voice Assistant
=====================
A fully offline voice assistant optimized for RTX 3050 4GB VRAM

Run with: python server.py
"""

import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Setup logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("MIDAS")

# Import and load models
from src.models import load_all_models
from src.routes import router

# Load all AI models
load_all_models()

# =============================================================================
# CREATE APP
# =============================================================================
app = FastAPI(title="MIDAS Voice Assistant")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Register routes
app.include_router(router)

# =============================================================================
# ENTRY POINT
# =============================================================================
if __name__ == "__main__":
    logger.info("🔒 Starting MIDAS on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
