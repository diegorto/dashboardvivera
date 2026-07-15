from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from src.core.config import settings
from src.core.logger import setup_logger

logger = setup_logger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@event.listens_for(engine, "connect")
def set_timezone(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("SET timezone='America/Sao_Paulo'")
    cursor.close()

def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from src.models import Base
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialized")

if __name__ == "__main__":
    init_db()
