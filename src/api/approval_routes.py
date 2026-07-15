from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session
from src.core.database import SessionLocal
from src.core.logger import setup_logger
from src.approval.queue import ApprovalQueueManager
from src.models import ApprovalQueue, AuditLog, AuditLogStatus
from src.staging.repository import StagingRepository

logger = setup_logger(__name__)

# ========== PYDANTIC MODELS ==========

class ApprovalItemResponse(BaseModel):
    """Modelo de resposta para item de aprovação"""
    id: int
    batch_id: str
    audit_log_id: int
    status: str
    entity_type: Optional[str]
    entity_id: Optional[str]
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    confidence_level: Optional[float]
    reason: Optional[str]
    created_at: datetime
    assigned_to: Optional[str]
    action: Optional[str]
    action_taken_at: Optional[datetime]
    notes: Optional[str]

    class Config:
        from_attributes = True


class ApprovalActionRequest(BaseModel):
    """Modelo para ação de aprovação/rejeição"""
    action: str = Field(..., description="approve, reject, correct")
    notes: Optional[str] = Field(None, description="Notas adicionais")
    corrected_value: Optional[str] = Field(None, description="Valor corrigido (apenas para correct)")
    assigned_to: Optional[str] = Field(None, description="Usuário responsável")

    class Config:
        json_schema_extra = {
            "example": {
                "action": "approve",
                "notes": "Dados validados",
                "assigned_to": "ana.silva@vivera.com.br"
            }
        }


class BulkApprovalRequest(BaseModel):
    """Modelo para ação em massa"""
    action: str = Field(..., description="approve, reject")
    item_ids: List[int]
    notes: Optional[str] = None


class ApprovalQueueFilter(BaseModel):
    """Modelo para filtros de fila de aprovação"""
    status: Optional[str] = None
    batch_id: Optional[str] = None
    assigned_to: Optional[str] = None
    entity_type: Optional[str] = None


class ApprovalStatistics(BaseModel):
    """Estatísticas da fila de aprovação"""
    total_items: int
    pending: int
    approved: int
    rejected: int
    average_processing_time_hours: float
    oldest_item_hours: int
    newest_item_hours: int


# ========== DEPENDENCY ==========

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ========== ROUTER ==========

router = APIRouter(prefix="/api/approval", tags=["approval"])


# ========== ENDPOINTS ==========

@router.get("/queue", response_model=List[ApprovalItemResponse])
async def list_approval_queue(
    status: Optional[str] = Query(None, description="Filter by status (pending, approved, rejected)"),
    batch_id: Optional[str] = Query(None, description="Filter by batch_id"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Retorna itens da fila de aprovação com filtros opcionais

    **Filtros:**
    - status: pending, approved, rejected
    - batch_id: ID do batch de sincronização
    - limit: Quantidade de itens (max 500)
    - offset: Paginação

    **Exemplo:**
    ```
    GET /api/approval/queue?status=pending&limit=50&offset=0
    ```
    """
    try:
        query = db.query(ApprovalQueue)

        if status:
            query = query.filter(ApprovalQueue.status == status)
        if batch_id:
            query = query.filter(ApprovalQueue.batch_id == batch_id)

        items = query.order_by(ApprovalQueue.created_at.desc())\
            .limit(limit)\
            .offset(offset)\
            .all()

        logger.info(f"Retornados {len(items)} itens da fila de aprovação")
        return items

    except Exception as e:
        logger.error(f"Erro ao listar fila de aprovação: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/queue/{item_id}", response_model=ApprovalItemResponse)
async def get_approval_item(
    item_id: int = Path(..., gt=0),
    db: Session = Depends(get_db)
):
    """
    Retorna detalhes de um item da fila de aprovação

    **Exemplo:**
    ```
    GET /api/approval/queue/42
    ```
    """
    try:
        item = db.query(ApprovalQueue)\
            .filter(ApprovalQueue.id == item_id)\
            .first()

        if not item:
            raise HTTPException(status_code=404, detail="Item não encontrado")

        # Enriquecer com dados do audit log
        audit_log = db.query(AuditLog)\
            .filter(AuditLog.id == item.audit_log_id)\
            .first()

        if audit_log:
            item.entity_type = audit_log.entity_type
            item.entity_id = audit_log.entity_id
            item.field_name = audit_log.field_name
            item.old_value = audit_log.old_value
            item.new_value = audit_log.new_value
            item.confidence_level = audit_log.confidence_level
            item.reason = audit_log.reason

        logger.info(f"Item de aprovação retornado: ID={item_id}")
        return item

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar item {item_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/queue/{item_id}/approve")
async def approve_item(
    item_id: int = Path(..., gt=0),
    request: ApprovalActionRequest = None,
    db: Session = Depends(get_db)
):
    """
    Aprova um item da fila de aprovação

    **Exemplo:**
    ```json
    POST /api/approval/queue/42/approve
    {
      "action": "approve",
      "notes": "Dados validados e OK",
      "assigned_to": "ana.silva@vivera.com.br"
    }
    ```
    """
    try:
        item = db.query(ApprovalQueue)\
            .filter(ApprovalQueue.id == item_id)\
            .first()

        if not item:
            raise HTTPException(status_code=404, detail="Item não encontrado")

        if item.status != "pending":
            raise HTTPException(
                status_code=400,
                detail=f"Item já foi {item.status}"
            )

        # Atualizar item
        item.status = "approved"
        item.action = "approve"
        item.action_taken_at = datetime.utcnow()
        item.assigned_to = request.assigned_to if request else None
        item.notes = request.notes if request else None

        # Atualizar audit log associado
        audit_log = db.query(AuditLog)\
            .filter(AuditLog.id == item.audit_log_id)\
            .first()

        if audit_log:
            audit_log.status = AuditLogStatus.APPROVED
            audit_log.approved_by = request.assigned_to if request else "system"
            audit_log.approved_at = datetime.utcnow()
            db.add(audit_log)

        db.add(item)
        db.commit()

        logger.info(f"Item {item_id} aprovado")
        return {
            "success": True,
            "item_id": item_id,
            "status": "approved",
            "message": "Item aprovado com sucesso"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao aprovar item {item_id}: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/queue/{item_id}/reject")
async def reject_item(
    item_id: int = Path(..., gt=0),
    request: ApprovalActionRequest = None,
    db: Session = Depends(get_db)
):
    """
    Rejeita um item da fila de aprovação

    **Exemplo:**
    ```json
    POST /api/approval/queue/42/reject
    {
      "action": "reject",
      "notes": "Dados inconsistentes, necessário revisar",
      "assigned_to": "ana.silva@vivera.com.br"
    }
    ```
    """
    try:
        item = db.query(ApprovalQueue)\
            .filter(ApprovalQueue.id == item_id)\
            .first()

        if not item:
            raise HTTPException(status_code=404, detail="Item não encontrado")

        if item.status != "pending":
            raise HTTPException(
                status_code=400,
                detail=f"Item já foi {item.status}"
            )

        # Atualizar item
        item.status = "rejected"
        item.action = "reject"
        item.action_taken_at = datetime.utcnow()
        item.assigned_to = request.assigned_to if request else None
        item.notes = request.notes if request else None

        # Atualizar audit log associado
        audit_log = db.query(AuditLog)\
            .filter(AuditLog.id == item.audit_log_id)\
            .first()

        if audit_log:
            audit_log.status = AuditLogStatus.REJECTED
            audit_log.rejected_reason = request.notes if request else "Rejeitado pelo usuário"
            db.add(audit_log)

        db.add(item)
        db.commit()

        logger.warning(f"Item {item_id} rejeitado: {request.notes if request else ''}")
        return {
            "success": True,
            "item_id": item_id,
            "status": "rejected",
            "message": "Item rejeitado com sucesso"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao rejeitar item {item_id}: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/queue/{item_id}/correct")
async def correct_item(
    item_id: int = Path(..., gt=0),
    request: ApprovalActionRequest = None,
    db: Session = Depends(get_db)
):
    """
    Corrige um item com valor customizado e aprova

    **Exemplo:**
    ```json
    POST /api/approval/queue/42/correct
    {
      "action": "correct",
      "corrected_value": "11987654321",
      "notes": "Telefone corrigido manualmente",
      "assigned_to": "ana.silva@vivera.com.br"
    }
    ```
    """
    try:
        if not request or not request.corrected_value:
            raise HTTPException(
                status_code=400,
                detail="corrected_value é obrigatório"
            )

        item = db.query(ApprovalQueue)\
            .filter(ApprovalQueue.id == item_id)\
            .first()

        if not item:
            raise HTTPException(status_code=404, detail="Item não encontrado")

        if item.status != "pending":
            raise HTTPException(
                status_code=400,
                detail=f"Item já foi {item.status}"
            )

        # Atualizar item
        item.status = "approved"
        item.action = "correct"
        item.action_taken_at = datetime.utcnow()
        item.assigned_to = request.assigned_to if request else None
        item.notes = request.notes if request else None

        # Atualizar audit log com valor corrigido
        audit_log = db.query(AuditLog)\
            .filter(AuditLog.id == item.audit_log_id)\
            .first()

        if audit_log:
            audit_log.status = AuditLogStatus.FIXED
            audit_log.new_value = request.corrected_value
            audit_log.approved_by = request.assigned_to if request else "system"
            audit_log.approved_at = datetime.utcnow()
            audit_log.reason = f"Correção manual: {request.notes}"
            db.add(audit_log)

        db.add(item)
        db.commit()

        logger.info(f"Item {item_id} corrigido e aprovado")
        return {
            "success": True,
            "item_id": item_id,
            "status": "approved",
            "action": "correct",
            "corrected_value": request.corrected_value,
            "message": "Item corrigido e aprovado com sucesso"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao corrigir item {item_id}: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/queue/bulk/approve")
async def bulk_approve(
    request: BulkApprovalRequest,
    db: Session = Depends(get_db)
):
    """
    Aprova múltiplos itens em lote

    **Exemplo:**
    ```json
    POST /api/approval/queue/bulk/approve
    {
      "action": "approve",
      "item_ids": [1, 2, 3, 4, 5],
      "notes": "Batch de aprovação em massa"
    }
    ```
    """
    try:
        results = {
            "total": len(request.item_ids),
            "approved": 0,
            "failed": 0,
            "errors": []
        }

        for item_id in request.item_ids:
            try:
                item = db.query(ApprovalQueue)\
                    .filter(ApprovalQueue.id == item_id)\
                    .first()

                if not item or item.status != "pending":
                    results["failed"] += 1
                    continue

                item.status = "approved"
                item.action = "approve"
                item.action_taken_at = datetime.utcnow()
                item.notes = request.notes

                audit_log = db.query(AuditLog)\
                    .filter(AuditLog.id == item.audit_log_id)\
                    .first()

                if audit_log:
                    audit_log.status = AuditLogStatus.APPROVED
                    audit_log.approved_at = datetime.utcnow()
                    db.add(audit_log)

                db.add(item)
                results["approved"] += 1

            except Exception as e:
                results["failed"] += 1
                results["errors"].append(f"Item {item_id}: {str(e)}")
                logger.error(f"Erro em bulk approve item {item_id}: {str(e)}")

        db.commit()
        logger.info(f"Bulk approve: {results['approved']}/{results['total']} aprovados")
        return results

    except Exception as e:
        logger.error(f"Erro em bulk approve: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics", response_model=ApprovalStatistics)
async def get_statistics(
    batch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Retorna estatísticas da fila de aprovação

    **Exemplo:**
    ```
    GET /api/approval/statistics
    GET /api/approval/statistics?batch_id=abc-123
    ```
    """
    try:
        query = db.query(ApprovalQueue)
        if batch_id:
            query = query.filter(ApprovalQueue.batch_id == batch_id)

        all_items = query.all()

        pending_items = [i for i in all_items if i.status == "pending"]
        approved_items = [i for i in all_items if i.status == "approved"]
        rejected_items = [i for i in all_items if i.status == "rejected"]

        # Calcular tempos
        oldest_item = min(all_items, key=lambda x: x.created_at) if all_items else None
        oldest_hours = int((datetime.utcnow() - oldest_item.created_at).total_seconds() / 3600) if oldest_item else 0
        newest_hours = int((datetime.utcnow() - all_items[-1].created_at).total_seconds() / 3600) if all_items else 0

        # Tempo médio de processamento
        processed_items = [i for i in all_items if i.action_taken_at]
        if processed_items:
            total_time = sum((i.action_taken_at - i.created_at).total_seconds() for i in processed_items)
            avg_hours = total_time / len(processed_items) / 3600
        else:
            avg_hours = 0.0

        stats = ApprovalStatistics(
            total_items=len(all_items),
            pending=len(pending_items),
            approved=len(approved_items),
            rejected=len(rejected_items),
            average_processing_time_hours=avg_hours,
            oldest_item_hours=oldest_hours,
            newest_item_hours=newest_hours
        )

        logger.info(f"Estatísticas de aprovação: {stats.total_items} total, {stats.pending} pendentes")
        return stats

    except Exception as e:
        logger.error(f"Erro ao gerar estatísticas: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/batch/{batch_id}/summary")
async def get_batch_summary(
    batch_id: str = Path(...),
    db: Session = Depends(get_db)
):
    """
    Retorna resumo da fila de aprovação para um batch específico

    **Exemplo:**
    ```
    GET /api/approval/batch/abc-123-def/summary
    ```
    """
    try:
        items = db.query(ApprovalQueue)\
            .filter(ApprovalQueue.batch_id == batch_id)\
            .all()

        if not items:
            raise HTTPException(status_code=404, detail="Batch não encontrado")

        summary = {
            "batch_id": batch_id,
            "total_items": len(items),
            "pending": len([i for i in items if i.status == "pending"]),
            "approved": len([i for i in items if i.status == "approved"]),
            "rejected": len([i for i in items if i.status == "rejected"]),
            "completion_percentage": int((len([i for i in items if i.status != "pending"]) / len(items)) * 100),
            "created_at": min(i.created_at for i in items).isoformat(),
            "last_updated": max(i.action_taken_at or i.created_at for i in items).isoformat()
        }

        logger.info(f"Resumo do batch {batch_id}: {summary['pending']} pendentes")
        return summary

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao gerar resumo de batch: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
