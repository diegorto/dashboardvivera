from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.core.logger import setup_logger
from src.api.approval_routes import router as approval_router

logger = setup_logger(__name__)

# Create FastAPI application
app = FastAPI(
    title="Executive OS API",
    description="REST API para gerenciamento de sincronização Clairis ↔ Pipedrive",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(approval_router)


@app.get("/", tags=["health"])
async def root():
    """Health check - API is running"""
    return {
        "status": "ok",
        "service": "Executive OS",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health", tags=["health"])
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "timestamp": "2026-07-15T12:00:00Z",
        "service": "Executive OS API",
        "endpoints": {
            "approval": "/api/approval",
            "docs": "/docs"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
