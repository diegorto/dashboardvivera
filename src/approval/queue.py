from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from src.models import ApprovalQueue, AuditLog, AuditLogStatus
from src.core.logger import setup_logger
from src.core.config import settings

logger = setup_logger(__name__)

class ApprovalQueueManager:
    """Gerencia a fila de aprovação de alterações"""
    
    def __init__(self, db: Session):
        self.db = db
        
    def add_to_queue(self, batch_id: str, audit_items: list):
        """Adiciona itens à fila de aprovação"""
        logger.info(f"Adicionando {len(audit_items)} itens à fila de aprovação...")
        
        for item in audit_items:
            queue_entry = ApprovalQueue(
                batch_id=batch_id,
                status="pending",
                created_at=datetime.utcnow(),
                action="approve"
            )
            self.db.add(queue_entry)
        
        self.db.commit()
        logger.info(f"Fila atualizada com {len(audit_items)} itens")
    
    def get_pending_items(self, batch_id: str = None) -> list:
        """Retorna itens pendentes na fila"""
        query = self.db.query(ApprovalQueue).filter(
            ApprovalQueue.status == "pending"
        )
        
        if batch_id:
            query = query.filter(ApprovalQueue.batch_id == batch_id)
        
        return query.all()
    
    def approve_item(self, queue_id: int, approved_by: str, notes: str = None):
        """Aprova um item da fila"""
        queue_item = self.db.query(ApprovalQueue).filter(
            ApprovalQueue.id == queue_id
        ).first()
        
        if queue_item:
            queue_item.status = "approved"
            queue_item.action_taken_at = datetime.utcnow()
            queue_item.notes = notes
            self.db.commit()
            logger.info(f"Item {queue_id} aprovado por {approved_by}")
    
    def reject_item(self, queue_id: int, rejected_by: str, reason: str):
        """Rejeita um item da fila"""
        queue_item = self.db.query(ApprovalQueue).filter(
            ApprovalQueue.id == queue_id
        ).first()
        
        if queue_item:
            queue_item.status = "rejected"
            queue_item.action_taken_at = datetime.utcnow()
            queue_item.notes = reason
            self.db.commit()
            logger.info(f"Item {queue_id} rejeitado por {rejected_by}")
    
    def get_queue_status(self, batch_id: str) -> dict:
        """Retorna status da fila para um batch"""
        items = self.db.query(ApprovalQueue).filter(
            ApprovalQueue.batch_id == batch_id
        ).all()
        
        return {
            "batch_id": batch_id,
            "total": len(items),
            "pending": len([i for i in items if i.status == "pending"]),
            "approved": len([i for i in items if i.status == "approved"]),
            "rejected": len([i for i in items if i.status == "rejected"])
        }
    
    def auto_approve_eligible_items(self, batch_id: str):
        """Aprova automaticamente itens elegíveis"""
        if not settings.AUTO_APPROVE_ENABLED:
            logger.info("Auto-aprovação desabilitada")
            return
        
        logger.info("Iniciando auto-aprovação de itens elegíveis...")
        
        # Get audit items with high confidence
        eligible_items = self.db.query(ApprovalQueue).filter(
            ApprovalQueue.batch_id == batch_id,
            ApprovalQueue.status == "pending"
        ).all()
        
        for item in eligible_items:
            self.approve_item(item.id, "system", "Auto-aprovado por confiança alta")
        
        logger.info(f"{len(eligible_items)} itens auto-aprovados")
