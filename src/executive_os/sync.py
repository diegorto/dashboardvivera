import hashlib
import pandas as pd
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from src.core.logger import setup_logger
from src.core.database import SessionLocal
from src.executive_os.database import (
    Patient, ClairisPatientSnapshot, PipedrivePeopleSnapshot,
    PipedriveDealsSnapshot, SyncEvent, AuditLogArchive,
    ApprovalQueueArchive, ConflictQueue, ExecutionLog, DataSnapshot
)
from src.models import StagingPatient, AuditLog

logger = setup_logger(__name__)

class ExecutiveOSSyncEngine:
    """Motor de sincronização para o banco Executive OS com histórico e versionamento"""
    
    def __init__(self, db: Session, batch_id: str):
        self.db = db
        self.batch_id = batch_id
        self.sync_stats = {
            "imported": 0,
            "updated": 0,
            "created": 0,
            "failed": 0,
            "conflicts": 0
        }
        logger.info(f"ExecutiveOSSyncEngine inicializado para batch {batch_id}")
    
    async def sync_patients(self, 
                           clairis_data: List[Dict],
                           pipedrive_data: Optional[List[Dict]] = None) -> Dict:
        """
        Sincroniza pacientes de Clairis para Executive OS
        
        Fluxo:
        1. Criar snapshot do Clairis
        2. Atualizar tabela consolidada
        3. Detectar conflitos
        4. Registrar eventos
        
        Args:
            clairis_data: Dados normalizados do Clairis
            pipedrive_data: Dados do Pipedrive (opcional)
        
        Returns:
            Dicionário com estatísticas de sincronização
        """
        logger.info(f"Iniciando sincronização de {len(clairis_data)} pacientes")
        
        start_time = datetime.utcnow()
        
        try:
            # 1. Criar snapshot Clairis
            await self._create_clairis_snapshot(clairis_data)
            
            # 2. Sincronizar cada paciente
            for patient_data in clairis_data:
                await self._sync_patient(patient_data, pipedrive_data)
            
            # 3. Registrar evento de sincronização
            self._record_sync_event(start_time, "SUCCESS")
            
            logger.info(f"Sincronização concluída: {self.sync_stats}")
            return self.sync_stats
            
        except Exception as e:
            logger.error(f"Erro na sincronização: {str(e)}", exc_info=True)
            self._record_sync_event(start_time, "ERROR")
            raise
    
    async def _sync_patient(self, 
                           clairis_patient: Dict,
                           pipedrive_data: Optional[List[Dict]]):
        """Sincroniza um paciente individual"""
        
        clairis_id = clairis_patient.get("clairis_id")
        
        try:
            # 1. Buscar paciente existente
            existing_patient = self.db.query(Patient).filter(
                Patient.clairis_id == clairis_id
            ).first()
            
            if existing_patient:
                # 2. Atualizar paciente existente
                await self._update_patient(existing_patient, clairis_patient, pipedrive_data)
                self.sync_stats["updated"] += 1
            else:
                # 2. Criar novo paciente
                await self._create_patient(clairis_patient, pipedrive_data)
                self.sync_stats["created"] += 1
            
            self.sync_stats["imported"] += 1
            
        except Exception as e:
            logger.error(f"Erro ao sincronizar paciente {clairis_id}: {str(e)}")
            self.sync_stats["failed"] += 1
    
    async def _create_patient(self, 
                             clairis_data: Dict,
                             pipedrive_data: Optional[List[Dict]] = None):
        """Cria novo paciente no Executive OS"""
        
        # Encontrar correspondência no Pipedrive se houver
        pipedrive_id = None
        if pipedrive_data:
            for pv_person in pipedrive_data:
                if pv_person.get("phone") == clairis_data.get("phone"):
                    pipedrive_id = pv_person.get("id")
                    break
        
        patient = Patient(
            clairis_id=clairis_data.get("clairis_id"),
            pipedrive_id=pipedrive_id,
            name=clairis_data.get("name"),
            phone=clairis_data.get("phone"),
            email=clairis_data.get("email"),
            cpf=clairis_data.get("cpf"),
            birth_date=clairis_data.get("birth_date"),
            status=clairis_data.get("status"),
            clairis_status=clairis_data.get("status"),
            plan=clairis_data.get("plan"),
            referred_by=clairis_data.get("referred_by"),
            sync_status="OK"
        )
        
        self.db.add(patient)
        self.db.commit()
        
        logger.info(f"Paciente criado: {patient.clairis_id}")
    
    async def _update_patient(self,
                             existing: Patient,
                             clairis_data: Dict,
                             pipedrive_data: Optional[List[Dict]] = None):
        """Atualiza paciente existente (com detecção de conflito)"""
        
        # Detectar conflitos se há dados Pipedrive
        conflicts = {}
        if pipedrive_data:
            conflicts = await self._detect_conflicts(existing, clairis_data)
        
        if conflicts:
            self.sync_stats["conflicts"] += len(conflicts)
            
            # Registrar conflitos
            for field, (old_val, new_val) in conflicts.items():
                self._register_conflict(existing.clairis_id, field, old_val, new_val)
        
        # Atualizar com dados Clairis (Clairis prevalece)
        existing.name = clairis_data.get("name", existing.name)
        existing.phone = clairis_data.get("phone", existing.phone)
        existing.email = clairis_data.get("email", existing.email)
        existing.status = clairis_data.get("status", existing.status)
        existing.clairis_status = clairis_data.get("status")
        existing.plan = clairis_data.get("plan", existing.plan)
        existing.referred_by = clairis_data.get("referred_by", existing.referred_by)
        existing.last_sync = datetime.utcnow()
        existing.sync_status = "CONFLICT" if conflicts else "OK"
        
        self.db.commit()
        
        logger.info(f"Paciente atualizado: {existing.clairis_id}")
    
    async def _detect_conflicts(self, 
                               patient: Patient,
                               clairis_data: Dict) -> Dict[str, Tuple]:
        """Detecta conflitos entre dados Clairis e Pipedrive"""
        
        conflicts = {}
        
        # Comparar campos principais
        fields_to_compare = ["name", "email", "phone"]
        
        for field in fields_to_compare:
            clairis_value = clairis_data.get(field)
            patient_value = getattr(patient, f"pipedrive_{field}", None) if field != "phone" else patient.phone
            
            if clairis_value and patient_value and str(clairis_value) != str(patient_value):
                conflicts[field] = (patient_value, clairis_value)
        
        return conflicts
    
    async def _create_clairis_snapshot(self, clairis_data: List[Dict]):
        """Cria snapshot dos dados do Clairis para histórico"""
        
        for patient_data in clairis_data:
            snapshot = ClairisPatientSnapshot(
                clairis_id=patient_data.get("clairis_id"),
                data=patient_data,
                batch_id=self.batch_id
            )
            self.db.add(snapshot)
        
        self.db.commit()
        logger.info(f"Snapshot Clairis criado com {len(clairis_data)} registros")
    
    async def sync_pipedrive_snapshots(self, pipedrive_people: List[Dict]):
        """Cria snapshots dos dados Pipedrive para histórico"""
        
        for person in pipedrive_people:
            snapshot = PipedrivePeopleSnapshot(
                pipedrive_id=person.get("id"),
                data=person,
                batch_id=self.batch_id
            )
            self.db.add(snapshot)
        
        self.db.commit()
        logger.info(f"Snapshot Pipedrive People criado com {len(pipedrive_people)} registros")
    
    async def archive_audit_logs(self):
        """Arquiva logs de auditoria do batch atual para histórico permanente"""
        
        # Buscar logs não arquivados do batch atual
        audit_logs = self.db.query(AuditLog).filter(
            AuditLog.batch_id == self.batch_id
        ).all()
        
        logger.info(f"Arquivando {len(audit_logs)} logs de auditoria")
        
        for log in audit_logs:
            archive = AuditLogArchive(
                batch_id=log.batch_id,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                field_name=log.field_name,
                old_value=log.old_value,
                new_value=log.new_value,
                source=log.source,
                status=log.status.value if log.status else None,
                confidence_level=log.confidence_level,
                ai_suggestion=log.ai_suggestion,
                reason=log.reason,
                approved_by=log.approved_by,
                approved_at=log.approved_at,
                metadata=log.metadata
            )
            self.db.add(archive)
        
        self.db.commit()
    
    def _register_conflict(self, clairis_id: str, field: str, old_value: Any, new_value: Any):
        """Registra um conflito na fila"""
        
        conflict = ConflictQueue(
            batch_id=self.batch_id,
            entity_type="patient",
            entity_id=clairis_id,
            clairis_id=clairis_id,
            conflict_field=field,
            clairis_value=str(new_value),
            pipedrive_value=str(old_value),
            status="PENDING"
        )
        
        self.db.add(conflict)
        self.db.commit()
        
        logger.warning(f"Conflito registrado: {clairis_id}:{field}")
    
    def _record_sync_event(self, start_time: datetime, status: str):
        """Registra evento de sincronização"""
        
        end_time = datetime.utcnow()
        duration = int((end_time - start_time).total_seconds())
        
        sync_event = SyncEvent(
            batch_id=self.batch_id,
            started_at=start_time,
            completed_at=end_time,
            duration_seconds=duration,
            status=status,
            records_exported=sum(self.sync_stats.values()),
            records_imported=self.sync_stats["imported"],
            records_updated=self.sync_stats["updated"],
            records_created=self.sync_stats["created"],
            records_failed=self.sync_stats["failed"],
            details=self.sync_stats
        )
        
        self.db.add(sync_event)
        self.db.commit()
        
        logger.info(f"Evento de sincronização registrado: {status}")
    
    def create_data_snapshot(self, entity_type: str, data: List[Dict]) -> str:
        """Cria snapshot versionado dos dados"""
        
        # Calcular versão
        latest_version = self.db.query(func.max(DataSnapshot.version)).filter(
            DataSnapshot.entity_type == entity_type
        ).scalar() or 0
        
        version = latest_version + 1
        
        # Calcular checksum
        data_str = str(data)
        checksum = hashlib.sha256(data_str.encode()).hexdigest()
        
        snapshot = DataSnapshot(
            batch_id=self.batch_id,
            version=version,
            snapshot_type="FULL",
            entity_type=entity_type,
            data=data,
            record_count=len(data),
            checksum=checksum
        )
        
        self.db.add(snapshot)
        self.db.commit()
        
        logger.info(f"Snapshot versionado criado: {entity_type} v{version}")
        
        return checksum
    
    def get_sync_report(self) -> Dict:
        """Gera relatório de sincronização do batch"""
        
        sync_event = self.db.query(SyncEvent).filter(
            SyncEvent.batch_id == self.batch_id
        ).first()
        
        if not sync_event:
            return {"error": "Evento não encontrado"}
        
        conflicts = self.db.query(ConflictQueue).filter(
            ConflictQueue.batch_id == self.batch_id
        ).all()
        
        return {
            "batch_id": self.batch_id,
            "status": sync_event.status,
            "duration_seconds": sync_event.duration_seconds,
            "records": {
                "imported": sync_event.records_imported,
                "updated": sync_event.records_updated,
                "created": sync_event.records_created,
                "failed": sync_event.records_failed
            },
            "conflicts": {
                "total": len(conflicts),
                "pending": len([c for c in conflicts if c.status == "PENDING"]),
                "resolved": len([c for c in conflicts if c.status == "RESOLVED"])
            },
            "timestamp": sync_event.started_at.isoformat()
        }
