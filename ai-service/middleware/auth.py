import os
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

INTERNAL_KEY = os.getenv("INTERNAL_API_KEY", "")
PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc", "/favicon.ico"}
PUBLIC_PREFIXES = ("/screening-test/",)


class InternalKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in PUBLIC_PATHS or request.url.path.startswith(PUBLIC_PREFIXES):
            return await call_next(request)
        if not INTERNAL_KEY:
            return await call_next(request)  # skip in dev if not configured
        if request.headers.get("X-Internal-Key", "") != INTERNAL_KEY:
            return JSONResponse(status_code=403, content={"detail": "Forbidden"})
        return await call_next(request)
