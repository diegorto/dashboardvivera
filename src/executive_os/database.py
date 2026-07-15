from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Text, JSON, ForeignKey, Index, DECIMAL
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

ExecutiveOSBase = declarative_base()

class Patient(ExecutiveOSBase):
    """Tabela consolidada de pacientes (fonte única de verdade)"""
    __tablename__ = "patients"
    
    id = Column(Integer, primary_key=True)
    clairis_id = Column(String(50), unique=True, index=True)
    pipedrive_id = Column(Integer, unique=True, index=True, nullable=True)
    
    # Dados principais
    name = Column(String(255), index=True)
    phone = Column(String(20), unique=True, index=True)
    email = Column(String(255), index=True)
    cpf = Column(String(20), unique=True, index=True)
    birth_date = Column(DateTime)
    
    # Status
    status = Column(String(50), index=True)  # ATIVO, INATIVO
    clairis_status = Column(String(50))
    pipedrive_status = Column(String(50))
    
    # Relacionamento
    plan = Column(String(255))
    referred_by = Column(String(255))
    
    # Metadata
    last_sync = Column(DateTime, default=datetime.utcnow, index=True)
    sync_status = Column(String(50))  # OK, PENDING, CONFLICT
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ClairisPatientSnapshot(ExecutiveOSBase):
    """Snapshot de pacientes do Clairis (histórico)"""
    __tablename__ = "clairis_patients_snapshots"
    
    id = Column(Integer, primary_key=True)
    clairis_id = Column(String(50), index=True)
    snapshot_date = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Dados completos
    data = Column(JSON)
    
    # Metadata
    batch_id = Column(String(50), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class PipedrivePeopleSnapshot(ExecutiveOSBase):
    """Snapshot de pessoas do Pipedrive (histórico)"""
    __tablename__ = "pipedrive_people_snapshots"
    
    id = Column(Integer, primary_key=True)
    pipedrive_id = Column(Integer, index=True)
    snapshot_date = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Dados completos
    data = Column(JSON)
    
    # Metadata
    batch_id = Column(String(50), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class PipedriveDealsSnapshot(ExecutiveOSBase):
    """Snapshot de negócios (deals) do Pipedrive (histórico)"""
    __tablename__ = "pipedrive_deals_snapshots"
    
    id = Column(Integer, primary_key=True)
    pipedrive_id = Column(Integer, index=True)
    person_id = Column(Integer, index=True)
    snapshot_date = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Dados principais
    title = Column(String(255))
    value = Column(DECIMAL(15, 2), index=True)
    currency = Column(String(3))
    stage_id = Column(Integer)
    status = Column(String(50), index=True)  # OPEN, WON, LOST
    probability = Column(Integer)
    expected_close_date = Column(DateTime)
    
    # Dados completos
    data = Column(JSON)
    
    # Metadata
    batch_id = Column(String(50), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class SyncEvent(ExecutiveOSBase):
    """Registro de eventos de sincronização"""
    __tablename__ = "sync_events"
    
    id = Column(Integer, primary_key=True)
    batch_id = Column(String(50), unique=True, index=True)
    
    # Timing
    started_at = Column(DateTime, index=True)
    completed_at = Column(DateTime)
    duration_seconds = Column(Integer)
    
    # Status
    status = Column(String(50), index=True)  # SUCCESS, PARTIAL, ERROR
    
    # Contadores
    records_exported = Column(Integer)
    records_imported = Column(Integer)
    records_updated = Column(Integer)
    records_created = Column(Integer)
    records_failed = Column(Integer)
    
    # Detalhes
    details = Column(JSON)
    errors = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditLogArchive(ExecutiveOSBase):
    """Arquivo de logs de auditoria (histórico permanente)"""
    __tablename__ = "audit_logs_archive"
    
    id = Column(Integer, primary_key=True)
    batch_id = Column(String(50), index=True)
    
    # Informações da alteração
    entity_type = Column(String(50), index=True)
    entity_id = Column(String(50), index=True)
    field_name = Column(String(255))
    
    # Valores
    old_value = Column(Text)
    new_value = Column(Text)
    
    # Auditoria
    source = Column(String(50))  # clairis, pipedrive, manual
    status = Column(String(50), index=True)
    confidence_level = Column(Float)
    ai_suggestion = Column(Text)
    reason = Column(String(255))
    
    # Aprovação
    approved_by = Column(String(255))
    approved_at = Column(DateTime)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    metadata = Column(JSON)

class ApprovalQueueArchive(ExecutiveOSBase):
    """Arquivo de fila de aprovações (histórico)"""
    __tablename__ = "approval_queue_archive"
    
    id = Column(Integer, primary_key=True)
    batch_id = Column(String(50), index=True)
    
    # Item original
    audit_log_id = Column(Integer, index=True)
    
    # Ação
    action = Column(String(50))  # approve, reject, correct
    action_taken_at = Column(DateTime)
    action_by = Column(String(255))
    
    # Resultado
    status = Column(String(50), index=True)
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class ConflictQueue(ExecutiveOSBase):
    """Fila de conflitos (dados divergentes entre Clairis e Pipedrive)"""
    __tablename__ = "conflict_queue"
    
    id = Column(Integer, primary_key=True)
    batch_id = Column(String(50), index=True)
    
    # Identificação
    entity_type = Column(String(50))
    entity_id = Column(String(50), index=True)
    clairis_id = Column(String(50), index=True)
    pipedrive_id = Column(Integer, index=True)
    
    # Conflito
    conflict_field = Column(String(255))
    clairis_value = Column(Text)
    pipedrive_value = Column(Text)
    
    # Resolução
    status = Column(String(50), index=True)  # PENDING, RESOLVED, IGNORED
    resolution = Column(String(50))  # CLAIRIS_WINS, PIPEDRIVE_WINS, MANUAL
    resolved_value = Column(Text)
    resolved_by = Column(String(255))
    resolved_at = Column(DateTime)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ExecutionLog(ExecutiveOSBase):
    """Log de execuções (rastreamento de operações)"""
    __tablename__ = "execution_logs"
    
    id = Column(Integer, primary_key=True)
    batch_id = Column(String(50), index=True)
    
    # Execução
    step = Column(String(100))
    action = Column(String(255))
    
    # Resultado
    status = Column(String(50))  # STARTED, COMPLETED, FAILED, SKIPPED
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    duration_ms = Column(Integer)
    
    # Detalhes
    input_data = Column(JSON)
    output_data = Column(JSON)
    error_message = Column(Text)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class DataSnapshot(ExecutiveOSBase):
    """Snapshot versionado de dados (para auditoria e análise histórica)"""
    __tablename__ = "data_snapshots"
    
    id = Column(Integer, primary_key=True)
    batch_id = Column(String(50), index=True)
    
    # Versão
    version = Column(Integer, index=True)
    snapshot_type = Column(String(50))  # FULL, INCREMENTAL
    
    # Dados
    entity_type = Column(String(50), index=True)
    data = Column(JSON)
    
    # Metadata
    record_count = Column(Integer)
    checksum = Column(String(64))  # SHA256 para verificação
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

# ========== ÍNDICES PARA PERFORMANCE ==========

Index('idx_patients_clairis_id', Patient.clairis_id)
Index('idx_patients_pipedrive_id', Patient.pipedrive_id)
Index('idx_patients_phone', Patient.phone)
Index('idx_patients_sync_status', Patient.sync_status)

Index('idx_clairis_snapshots_date', ClairisPatientSnapshot.snapshot_date, ClairisPatientSnapshot.clairis_id)
Index('idx_pipedrive_people_snapshots_date', PipedrivePeopleSnapshot.snapshot_date, PipedrivePeopleSnapshot.pipedrive_id)
Index('idx_pipedrive_deals_snapshots_date', PipedriveDealsSnapshot.snapshot_date, PipedriveDealsSnapshot.pipedrive_id)

Index('idx_sync_events_date', SyncEvent.started_at)
Index('idx_sync_events_status', SyncEvent.status)

Index('idx_audit_archive_batch_date', AuditLogArchive.batch_id, AuditLogArchive.created_at)
Index('idx_audit_archive_entity', AuditLogArchive.entity_type, AuditLogArchive.entity_id)

Index('idx_approval_archive_batch_date', ApprovalQueueArchive.batch_id, ApprovalQueueArchive.created_at)

Index('idx_conflict_queue_status', ConflictQueue.status)
Index('idx_conflict_queue_entity', ConflictQueue.entity_type, ConflictQueue.entity_id)

Index('idx_execution_logs_batch', ExecutionLog.batch_id)
Index('idx_execution_logs_step', ExecutionLog.step, ExecutionLog.status)

Index('idx_snapshots_version', DataSnapshot.version)
Index('idx_snapshots_entity', DataSnapshot.entity_type, DataSnapshot.created_at)
