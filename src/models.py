from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Text, JSON, Enum as SQLEnum, ForeignKey, Table, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum
import hashlib

Base = declarative_base()

class AuditLogStatus(str, Enum):
    PENDING = "PENDENTE"
    ANALYZING = "EM_ANÁLISE"
    APPROVED = "APROVADO"
    REJECTED = "REJEITADO"
    FIXED = "CORRIGIDO"
    IMPORTED = "IMPORTADO"

class PatientStatus(str, Enum):
    SCHEDULED = "Agendado"
    CONFIRMED = "Confirmado"
    ATTENDED = "Compareceu"
    MISSED = "Faltou"
    RESCHEDULED = "Reagendou"
    IN_TREATMENT = "Em tratamento"
    BUDGET_PENDING = "Orçamento pendente"
    BUDGET_CLOSED = "Orçamento fechado"
    NO_FUTURE_APPOINTMENT = "Sem agendamento futuro"
    FOLLOWUP_PENDING = "Follow-up pendente"
    RETURN_PENDING = "Retorno pendente"
    DELINQUENT = "Inadimplente"
    JOURNEY_COMPLETED = "Jornada concluída"

class PatientPriority(str, Enum):
    CRITICAL = "🔴 Crítico"
    HIGH = "🟠 Alto"
    MEDIUM = "🟡 Médio"
    LOW = "🟢 Baixo"

# ========== SECURITY MODELS ==========

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    role = Column(String(50), nullable=False)  # admin, reviewer, operator, analyst, api_service
    active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime)

class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(100), ForeignKey("users.user_id"), index=True, nullable=False)
    key_hash = Column(String(255), unique=True, index=True, nullable=False)  # SHA256 hash
    name = Column(String(255))
    requests_per_minute = Column(Integer, default=60)
    active = Column(Boolean, default=True, index=True)
    revoked_at = Column(DateTime)
    last_used_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    def set_key(self, key: str):
        """Hash the key for secure storage"""
        self.key_hash = hashlib.sha256(key.encode()).hexdigest()

    def verify_key(self, key: str) -> bool:
        """Verify key against stored hash"""
        return self.key_hash == hashlib.sha256(key.encode()).hexdigest()

# ========== STAGING TABLES ==========

class StagingPatient(Base):
    __tablename__ = "staging_patients"

    id = Column(Integer, primary_key=True)
    clairis_id = Column(String(50), unique=True, index=True, nullable=False)
    phone = Column(String(20), index=True)
    name = Column(String(255))
    email = Column(String(255), index=True)
    cpf = Column(String(20), index=True)
    birth_date = Column(DateTime)
    status = Column(String(50))
    plan = Column(String(255))
    referred_by = Column(String(255))
    imported_at = Column(DateTime, default=datetime.utcnow)
    raw_data = Column(JSON)
    source = Column(String(50), default="clairis")

class StagingBudget(Base):
    __tablename__ = "staging_budgets"
    
    id = Column(Integer, primary_key=True)
    clairis_id = Column(String(50), unique=True, index=True)
    patient_id = Column(Integer, ForeignKey("staging_patients.id"))
    status = Column(String(50), index=True)
    procedure = Column(String(255))
    professional = Column(String(255))
    sale_value = Column(Float)
    cost = Column(Float)
    net_value = Column(Float)
    margin_percent = Column(Float)
    created_at = Column(DateTime, index=True)
    imported_at = Column(DateTime, default=datetime.utcnow)
    raw_data = Column(JSON)

class StagingBudgetRejected(Base):
    __tablename__ = "staging_budgets_rejected"
    
    id = Column(Integer, primary_key=True)
    clairis_id = Column(String(50), unique=True, index=True)
    patient_id = Column(Integer, ForeignKey("staging_patients.id"))
    procedures = Column(String(255))
    total_value = Column(Float)
    status = Column(String(50))
    rejected_date = Column(DateTime)
    imported_at = Column(DateTime, default=datetime.utcnow)
    raw_data = Column(JSON)

class StagingAppointment(Base):
    __tablename__ = "staging_appointments"
    
    id = Column(Integer, primary_key=True)
    clairis_id = Column(String(50), unique=True, index=True)
    patient_id = Column(Integer, ForeignKey("staging_patients.id"))
    professional = Column(String(255))
    appointment_date = Column(DateTime, index=True)
    status = Column(String(50))
    imported_at = Column(DateTime, default=datetime.utcnow)
    raw_data = Column(JSON)

# ========== AUDIT TABLES ==========

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True)
    batch_id = Column(String(50), index=True)
    entity_type = Column(String(50))  # patient, budget, appointment, etc
    entity_id = Column(String(50), index=True)
    field_name = Column(String(255))
    old_value = Column(Text)
    new_value = Column(Text)
    source = Column(String(50))  # clairis, pipedrive, manual
    status = Column(SQLEnum(AuditLogStatus), default=AuditLogStatus.PENDING, index=True)
    confidence_level = Column(Float)  # 0-100
    ai_suggestion = Column(Text)
    reason = Column(String(255))
    approved_by = Column(String(255))
    approved_at = Column(DateTime)
    rejected_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    meta_data = Column(JSON)

# ========== PATIENT JOURNEY TABLES ==========

class PatientJourney(Base):
    __tablename__ = "patient_journey"
    
    id = Column(Integer, primary_key=True)
    patient_id = Column(String(50), unique=True, index=True)
    current_status = Column(SQLEnum(PatientStatus), index=True)
    priority = Column(SQLEnum(PatientPriority))
    
    # Journey tracking
    scheduled_date = Column(DateTime)
    attended_date = Column(DateTime)
    missed_count = Column(Integer, default=0)
    rescheduled_count = Column(Integer, default=0)
    
    # Budget tracking
    budget_value = Column(Float)
    budget_status = Column(String(50))
    budget_created_at = Column(DateTime)
    
    # Treatment tracking
    treatment_started_at = Column(DateTime)
    treatment_completed_at = Column(DateTime)
    
    # Follow-up tracking
    last_followup = Column(DateTime)
    next_followup = Column(DateTime)
    followup_pending = Column(Boolean, default=False)
    
    # CRC tracking (Central de Relacionamento ao Cliente)
    last_contact = Column(DateTime)
    contact_type = Column(String(50))
    
    # Delinquency
    delinquent = Column(Boolean, default=False)
    delinquency_amount = Column(Float)
    
    # AI Analysis
    ai_analysis = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ========== APPROVAL QUEUE ==========

class ApprovalQueue(Base):
    __tablename__ = "approval_queue"
    
    id = Column(Integer, primary_key=True)
    batch_id = Column(String(50), index=True)
    audit_log_id = Column(Integer, ForeignKey("audit_logs.id"))
    status = Column(String(50), default="pending", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    assigned_to = Column(String(255))
    action = Column(String(50))  # approve, reject, correct
    action_taken_at = Column(DateTime)
    notes = Column(Text)

# ========== SYNC STATUS ==========

class SyncExecution(Base):
    __tablename__ = "sync_execution"
    
    id = Column(Integer, primary_key=True)
    batch_id = Column(String(50), unique=True, index=True)
    started_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime)
    status = Column(String(50), index=True)  # running, success, error
    files_exported = Column(Integer)
    records_imported = Column(Integer)
    records_ignored = Column(Integer)
    errors = Column(Text)
    screenshots = Column(JSON)
    html_logs = Column(JSON)
    duration_seconds = Column(Integer)

class SyncLog(Base):
    __tablename__ = "sync_logs"
    
    id = Column(Integer, primary_key=True)
    batch_id = Column(String(50), index=True)
    step = Column(String(100))
    status = Column(String(50))
    message = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    details = Column(JSON)

# ========== INDEXES ==========

Index('idx_audit_logs_batch_id_status', AuditLog.batch_id, AuditLog.status)
Index('idx_audit_logs_entity_type_status', AuditLog.entity_type, AuditLog.status)
Index('idx_staging_patients_phone', StagingPatient.phone)
Index('idx_staging_budgets_status', StagingBudget.status)
Index('idx_patient_journey_status', PatientJourney.current_status)
Index('idx_approval_queue_status', ApprovalQueue.status)
Index('idx_api_keys_user_id_active', APIKey.user_id, APIKey.active)
Index('idx_users_active_role', User.active, User.role)
