import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from unittest.mock import Mock, MagicMock, patch

from src.core.database import Base
from src.models import (
    StagingPatient, AuditLog, AuditLogStatus, ApprovalQueue,
    SyncExecution, SyncLog
)
from src.executive_os.database import (
    ExecutiveOSBase, Patient, ConflictQueue, SyncEvent
)


@pytest.fixture
def test_db():
    """Cria database em memória para testes"""
    engine = create_engine("sqlite:///:memory:")

    # Criar schemas
    Base.metadata.create_all(engine)
    ExecutiveOSBase.metadata.create_all(engine)

    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    yield session

    session.close()
    engine.dispose()


@pytest.fixture
def mock_pipedrive_api():
    """Mock do PipedriveAPIClient"""
    api = MagicMock()
    api.verify_connection = pytest.mark.asyncio
    api.get_persons_by_phone = pytest.mark.asyncio
    api.update_person = pytest.mark.asyncio
    api.create_person = pytest.mark.asyncio
    return api


@pytest.fixture
def sample_patient():
    """Dados de amostra de paciente"""
    return {
        "id": 1,
        "clairis_id": "CLR-12345",
        "name": "João Silva",
        "phone": "5548999999999",
        "email": "joao@example.com",
        "cpf": "12345678900",
        "birth_date": datetime(1990, 1, 15),
        "status": "ATIVO",
        "plan": "Premium",
        "referred_by": "Indicação",
        "imported_at": datetime.utcnow(),
        "source": "clairis"
    }


@pytest.fixture
def sample_pipedrive_person():
    """Dados de amostra de pessoa Pipedrive"""
    return {
        "id": 42,
        "name": "João Silva",
        "phone": "5548999999999",
        "email": "joao@example.com",
        "cpf": None,
        "status": None
    }


@pytest.fixture
def sample_divergence():
    """Dados de amostra de divergência"""
    from src.reconciliation.engine import FieldDivergence

    return FieldDivergence(
        field_name="phone",
        clairis_value="5548999999999",
        pipedrive_value="5548988888888",
        executive_os_value="5548999999999",
        confidence_level=85.0,
        recommended_value="5548999999999",
        recommendation_reason="Clairis é fonte primária",
        severity="HIGH",
        impact="Pode afetar matching de pacientes"
    )


@pytest.fixture
def staging_patient_db(test_db, sample_patient):
    """Cria StagingPatient no banco de testes"""
    patient = StagingPatient(**sample_patient)
    test_db.add(patient)
    test_db.commit()
    return patient


@pytest.fixture
def audit_log_db(test_db):
    """Cria AuditLog no banco de testes"""
    log = AuditLog(
        batch_id="batch-123",
        entity_type="person",
        entity_id="CLR-12345",
        field_name="phone",
        old_value="5548988888888",
        new_value="5548999999999",
        source="clairis",
        status=AuditLogStatus.PENDING,
        confidence_level=85.0,
        reason="Sincronização automática",
        created_at=datetime.utcnow()
    )
    test_db.add(log)
    test_db.commit()
    return log


@pytest.fixture
def approval_queue_item_db(test_db, audit_log_db):
    """Cria ApprovalQueue no banco de testes"""
    item = ApprovalQueue(
        batch_id="batch-123",
        audit_log_id=audit_log_db.id,
        status="pending",
        created_at=datetime.utcnow()
    )
    test_db.add(item)
    test_db.commit()
    return item


@pytest.fixture
def sync_execution_db(test_db):
    """Cria SyncExecution no banco de testes"""
    sync = SyncExecution(
        batch_id="batch-123",
        started_at=datetime.utcnow(),
        status="running"
    )
    test_db.add(sync)
    test_db.commit()
    return sync


@pytest.fixture
def conflict_db(test_db):
    """Cria ConflictQueue no banco de testes"""
    conflict = ConflictQueue(
        batch_id="batch-123",
        entity_type="person",
        entity_id="CLR-12345",
        clairis_id="CLR-12345",
        pipedrive_id=42,
        conflict_field="phone",
        clairis_value="5548999999999",
        pipedrive_value="5548988888888",
        status="PENDING",
        created_at=datetime.utcnow()
    )
    test_db.add(conflict)
    test_db.commit()
    return conflict


@pytest.fixture
def mock_logger():
    """Mock para logger"""
    return MagicMock()
