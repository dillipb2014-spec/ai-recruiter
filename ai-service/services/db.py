import asyncio
import asyncpg
import os
from typing import Optional

_pool: Optional[asyncpg.Pool] = None
_lock: Optional[asyncio.Lock] = None


async def get_pool() -> asyncpg.Pool:
    global _pool, _lock
    if _lock is None:
        _lock = asyncio.Lock()
    async with _lock:
        if _pool is None:
            try:
                _pool = await asyncpg.create_pool(
                    dsn=os.getenv("DATABASE_URL"),
                    min_size=2,
                    max_size=10,
                )
            except Exception:
                raise  # don't cache a broken pool — next call will retry
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
