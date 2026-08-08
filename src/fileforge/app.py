"""FastAPI Application Factory for FileForge."""

from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from fileforge import __version__
from fileforge.config import settings
from fileforge.routes.files import router as files_router
from fileforge.routes.auth import router as auth_router
from fileforge.routes.shares import router as shares_router
from fileforge.routes.storage import router as storage_router
from fileforge.routes.watch import router as watch_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="FileForge",
        version=__version__,
        description="Modern, lightweight HTTP file server."
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Global Exception Handler for friendly error messages (never dump raw tracebacks to user)
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        if isinstance(exc, HTTPException):
            return JSONResponse(
                status_code=exc.status_code,
                content={"error": exc.detail}
            )
        return JSONResponse(
            status_code=500,
            content={"error": f"Internal Server Error: {str(exc)}"}
        )

    # Include API Routers
    app.include_router(files_router)
    app.include_router(auth_router)
    app.include_router(shares_router)
    app.include_router(storage_router)
    app.include_router(watch_router)

    # Static files directory
    static_dir = Path(__file__).parent / "static"

    # Mount static assets if static directory exists
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

        @app.get("/")
        @app.get("/browse/{full_path:path}")
        @app.get("/watch")
        @app.get("/watch/{full_path:path}")
        async def serve_index(full_path: str = ""):
            index_path = static_dir / "index.html"
            if index_path.exists():
                return FileResponse(str(index_path))
            return JSONResponse({"status": "FileForge backend running", "version": __version__})

    return app


app = create_app()
