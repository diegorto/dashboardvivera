"""Connection pooling for database optimization"""
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool
from typing import Optional

from src.core.logger import setup_logger

logger = setup_logger(__name__)


class DatabaseConnectionPool:
    """Manages database connection pooling"""

    def __init__(
        self,
        database_url: str,
        pool_size: int = 20,
        max_overflow: int = 40,
        pool_recycle: int = 3600,
        echo: bool = False
    ):
        """
        Initialize connection pool

        Args:
            database_url: Database connection URL
            pool_size: Number of connections to maintain (default 20)
            max_overflow: Maximum connections to create beyond pool_size (default 40)
            pool_recycle: Recycle connections after N seconds (default 3600/1 hour)
            echo: Whether to log SQL statements (default False)
        """
        self.database_url = database_url
        self.pool_size = pool_size
        self.max_overflow = max_overflow
        self.pool_recycle = pool_recycle

        logger.info(
            f"Creating database connection pool: "
            f"pool_size={pool_size}, max_overflow={max_overflow}, recycle={pool_recycle}s"
        )

        self.engine = create_engine(
            database_url,
            poolclass=QueuePool,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_recycle=pool_recycle,
            pool_pre_ping=True,  # Test connections before using them
            echo=echo
        )

    def get_pool_stats(self) -> dict:
        """Get connection pool statistics"""
        pool = self.engine.pool
        return {
            "pool_type": pool.__class__.__name__,
            "pool_size": self.pool_size,
            "max_overflow": self.max_overflow,
            "checked_out_connections": pool.checkedout(),
            "total_connections": pool.size() if hasattr(pool, 'size') else None
        }

    def close(self):
        """Close all connections in pool"""
        self.engine.dispose()
        logger.info("Database connection pool closed")


# Global pool instance
_db_pool: Optional[DatabaseConnectionPool] = None


def get_db_pool(database_url: str = None, **kwargs) -> DatabaseConnectionPool:
    """Get or create global database connection pool"""
    global _db_pool

    if _db_pool is None:
        if not database_url:
            from src.core.config import settings
            database_url = settings.DATABASE_URL

        _db_pool = DatabaseConnectionPool(database_url, **kwargs)

    return _db_pool


def get_engine():
    """Get SQLAlchemy engine from pool"""
    return get_db_pool().engine
