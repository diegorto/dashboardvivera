from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from src.core.logger import setup_logger
from src.executive_os.database import ConflictQueue, SyncEvent, AuditLogArchive
from src.models import AuditLog, AuditLogStatus
from src.reconciliation.engine import ReconciliationEngine

logger = setup_logger(__name__)


class ConflictQueueManager:
    """Gerenciador de fila de conflitos para resolução de divergências em quarentena"""

    RESOLUTION_STRATEGIES = {
        "CLAIRIS_WINS": "Usar valor do Clairis",
        "PIPEDRIVE_WINS": "Usar valor do Pipedrive",
        "MANUAL": "Usar valor manual fornecido",
        "REJECT": "Rejeitar alteração"
    }

    def __init__(self, db: Session):
        self.db = db
        self.reconciliation = ReconciliationEngine(db)

    # ========== CONFLICT RETRIEVAL ==========

    def get_pending_conflicts(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """Retorna todos os conflitos pendentes de resolução"""
        try:
            conflicts = self.db.query(ConflictQueue)\
                .filter(ConflictQueue.status == "PENDING")\
                .order_by(ConflictQueue.created_at.desc())\
                .limit(limit)\
                .offset(offset)\
                .all()

            result = [self._conflict_to_dict(c) for c in conflicts]
            logger.info(f"Retornados {len(result)} conflitos pendentes")
            return result

        except Exception as e:
            logger.error(f"Erro ao buscar conflitos pendentes: {str(e)}")
            return []

    def get_conflict_by_id(self, conflict_id: int) -> Optional[Dict[str, Any]]:
        """Retorna um conflito específico pelo ID"""
        try:
            conflict = self.db.query(ConflictQueue)\
                .filter(ConflictQueue.id == conflict_id)\
                .first()

            if conflict:
                logger.debug(f"Conflito encontrado: ID={conflict_id}")
                return self._conflict_to_dict(conflict)
            return None

        except Exception as e:
            logger.error(f"Erro ao buscar conflito {conflict_id}: {str(e)}")
            return None

    def get_conflicts_by_entity(self, entity_type: str, entity_id: str) -> List[Dict[str, Any]]:
        """Retorna todos os conflitos de uma entidade"""
        try:
            conflicts = self.db.query(ConflictQueue)\
                .filter(
                    ConflictQueue.entity_type == entity_type,
                    ConflictQueue.entity_id == entity_id
                )\
                .order_by(ConflictQueue.created_at.desc())\
                .all()

            result = [self._conflict_to_dict(c) for c in conflicts]
            logger.debug(f"Retornados {len(result)} conflitos para {entity_type}:{entity_id}")
            return result

        except Exception as e:
            logger.error(f"Erro ao buscar conflitos da entidade: {str(e)}")
            return []

    def get_conflicts_by_field(self, conflict_field: str) -> List[Dict[str, Any]]:
        """Retorna todos os conflitos de um campo específico"""
        try:
            conflicts = self.db.query(ConflictQueue)\
                .filter(ConflictQueue.conflict_field == conflict_field)\
                .order_by(ConflictQueue.created_at.desc())\
                .all()

            result = [self._conflict_to_dict(c) for c in conflicts]
            logger.info(f"Retornados {len(result)} conflitos no campo {conflict_field}")
            return result

        except Exception as e:
            logger.error(f"Erro ao buscar conflitos por campo: {str(e)}")
            return []

    def get_conflicts_by_batch(self, batch_id: str) -> List[Dict[str, Any]]:
        """Retorna todos os conflitos de um batch"""
        try:
            conflicts = self.db.query(ConflictQueue)\
                .filter(ConflictQueue.batch_id == batch_id)\
                .order_by(ConflictQueue.created_at.desc())\
                .all()

            result = [self._conflict_to_dict(c) for c in conflicts]
            logger.info(f"Retornados {len(result)} conflitos do batch {batch_id}")
            return result

        except Exception as e:
            logger.error(f"Erro ao buscar conflitos do batch: {str(e)}")
            return []

    # ========== CONFLICT RESOLUTION ==========

    def resolve_conflict(self,
                        conflict_id: int,
                        resolution: str,
                        resolved_value: Any,
                        resolved_by: str,
                        notes: str = "") -> Tuple[bool, str]:
        """
        Resolve um conflito usando uma das estratégias

        Args:
            conflict_id: ID do conflito
            resolution: Estratégia (CLAIRIS_WINS, PIPEDRIVE_WINS, MANUAL, REJECT)
            resolved_value: Valor a usar (ignorado se REJECT)
            resolved_by: Usuário que resolveu
            notes: Notas adicionais

        Returns:
            (sucesso: bool, mensagem: str)
        """
        try:
            conflict = self.db.query(ConflictQueue)\
                .filter(ConflictQueue.id == conflict_id)\
                .first()

            if not conflict:
                logger.error(f"Conflito não encontrado: {conflict_id}")
                return False, "Conflito não encontrado"

            if resolution not in self.RESOLUTION_STRATEGIES:
                logger.error(f"Estratégia de resolução inválida: {resolution}")
                return False, "Estratégia de resolução inválida"

            # Validar valor resolvido
            if resolution != "REJECT" and not resolved_value:
                logger.error("Valor resolvido necessário para estratégias não-REJECT")
                return False, "Valor resolvido necessário"

            # Atualizar conflito
            conflict.status = "RESOLVED"
            conflict.resolution = resolution
            conflict.resolved_value = str(resolved_value) if resolved_value else None
            conflict.resolved_by = resolved_by
            conflict.resolved_at = datetime.utcnow()

            # Registrar em auditoria
            self._audit_conflict_resolution(conflict, resolution, notes)

            self.db.add(conflict)
            self.db.commit()

            msg = f"Conflito {conflict_id} resolvido com {resolution}"
            logger.info(msg)
            return True, msg

        except Exception as e:
            logger.error(f"Erro ao resolver conflito: {str(e)}")
            self.db.rollback()
            return False, f"Erro: {str(e)}"

    def resolve_bulk_conflicts(self,
                              conflict_ids: List[int],
                              resolution: str,
                              resolved_by: str) -> Dict[str, Any]:
        """Resolve múltiplos conflitos com a mesma estratégia"""
        try:
            results = {
                "total": len(conflict_ids),
                "resolved": 0,
                "failed": 0,
                "errors": []
            }

            for conflict_id in conflict_ids:
                conflict = self.db.query(ConflictQueue)\
                    .filter(ConflictQueue.id == conflict_id)\
                    .first()

                if not conflict:
                    results["errors"].append(f"Conflito {conflict_id} não encontrado")
                    results["failed"] += 1
                    continue

                # Usar valor recomendado baseado na estratégia
                resolved_value = self._get_recommended_value(conflict, resolution)

                success, msg = self.resolve_conflict(
                    conflict_id,
                    resolution,
                    resolved_value,
                    resolved_by
                )

                if success:
                    results["resolved"] += 1
                else:
                    results["failed"] += 1
                    results["errors"].append(msg)

            logger.info(f"Bulk resolution: {results['resolved']}/{results['total']} resolvidos")
            return results

        except Exception as e:
            logger.error(f"Erro em resolução em lote: {str(e)}")
            return {"total": len(conflict_ids), "resolved": 0, "failed": len(conflict_ids)}

    def ignore_conflict(self, conflict_id: int, ignored_by: str) -> Tuple[bool, str]:
        """Marca um conflito como ignorado"""
        try:
            conflict = self.db.query(ConflictQueue)\
                .filter(ConflictQueue.id == conflict_id)\
                .first()

            if not conflict:
                return False, "Conflito não encontrado"

            conflict.status = "IGNORED"
            conflict.resolved_by = ignored_by
            conflict.resolved_at = datetime.utcnow()

            self.db.add(conflict)
            self.db.commit()

            msg = f"Conflito {conflict_id} marcado como ignorado"
            logger.info(msg)
            return True, msg

        except Exception as e:
            logger.error(f"Erro ao ignorar conflito: {str(e)}")
            self.db.rollback()
            return False, f"Erro: {str(e)}"

    def reopen_conflict(self, conflict_id: int) -> Tuple[bool, str]:
        """Reabre um conflito resolvido para revisão"""
        try:
            conflict = self.db.query(ConflictQueue)\
                .filter(ConflictQueue.id == conflict_id)\
                .first()

            if not conflict:
                return False, "Conflito não encontrado"

            if conflict.status == "PENDING":
                return False, "Conflito já está pendente"

            conflict.status = "PENDING"
            conflict.resolved_by = None
            conflict.resolved_at = None
            conflict.resolved_value = None
            conflict.resolution = None

            self.db.add(conflict)
            self.db.commit()

            msg = f"Conflito {conflict_id} reabertu para revisão"
            logger.info(msg)
            return True, msg

        except Exception as e:
            logger.error(f"Erro ao reabrir conflito: {str(e)}")
            self.db.rollback()
            return False, f"Erro: {str(e)}"

    # ========== RECONCILIATION INTEGRATION ==========

    def get_reconciliation_advice(self, conflict_id: int) -> Optional[Dict[str, Any]]:
        """Obtém recomendação de reconciliação para um conflito"""
        try:
            conflict = self.db.query(ConflictQueue)\
                .filter(ConflictQueue.id == conflict_id)\
                .first()

            if not conflict:
                return None

            # Executar reconciliação
            report = self.reconciliation.reconcile_person(
                conflict.clairis_id,
                conflict.pipedrive_id
            )

            # Encontrar divergência relacionada
            for divergence in report.divergences:
                if divergence.field_name == conflict.conflict_field:
                    return {
                        "field": divergence.field_name,
                        "clairis_value": divergence.clairis_value,
                        "pipedrive_value": divergence.pipedrive_value,
                        "recommended_value": divergence.recommended_value,
                        "confidence_level": divergence.confidence_level,
                        "reason": divergence.recommendation_reason,
                        "severity": divergence.severity,
                        "impact": divergence.impact
                    }

            return None

        except Exception as e:
            logger.error(f"Erro ao obter recomendação de reconciliação: {str(e)}")
            return None

    # ========== STATISTICS & REPORTING ==========

    def get_conflict_statistics(self, batch_id: Optional[str] = None) -> Dict[str, Any]:
        """Retorna estatísticas de conflitos"""
        try:
            query = self.db.query(ConflictQueue)
            if batch_id:
                query = query.filter(ConflictQueue.batch_id == batch_id)

            all_conflicts = query.all()

            stats = {
                "total_conflicts": len(all_conflicts),
                "pending": len([c for c in all_conflicts if c.status == "PENDING"]),
                "resolved": len([c for c in all_conflicts if c.status == "RESOLVED"]),
                "ignored": len([c for c in all_conflicts if c.status == "IGNORED"]),
                "by_entity_type": self._count_by_entity_type(all_conflicts),
                "by_field": self._count_by_field(all_conflicts),
                "by_resolution": self._count_by_resolution(all_conflicts),
                "oldest_conflict": self._get_oldest_conflict_date(all_conflicts),
                "resolution_rate": self._calculate_resolution_rate(all_conflicts)
            }

            logger.info(f"Estatísticas de conflitos: {stats}")
            return stats

        except Exception as e:
            logger.error(f"Erro ao gerar estatísticas: {str(e)}")
            return {}

    def get_conflict_report(self, batch_id: str) -> Dict[str, Any]:
        """Retorna relatório detalhado de conflitos de um batch"""
        try:
            conflicts = self.get_conflicts_by_batch(batch_id)

            if not conflicts:
                return {
                    "batch_id": batch_id,
                    "total_conflicts": 0,
                    "conflicts": [],
                    "summary": "Nenhum conflito encontrado"
                }

            # Agrupar por tipo de entidade
            by_entity = {}
            for conflict in conflicts:
                entity_type = conflict["entity_type"]
                if entity_type not in by_entity:
                    by_entity[entity_type] = []
                by_entity[entity_type].append(conflict)

            report = {
                "batch_id": batch_id,
                "total_conflicts": len(conflicts),
                "generated_at": datetime.utcnow().isoformat(),
                "by_entity_type": by_entity,
                "pending_count": len([c for c in conflicts if c["status"] == "PENDING"]),
                "resolved_count": len([c for c in conflicts if c["status"] == "RESOLVED"]),
                "ignored_count": len([c for c in conflicts if c["status"] == "IGNORED"])
            }

            logger.info(f"Relatório de conflitos gerado para batch {batch_id}")
            return report

        except Exception as e:
            logger.error(f"Erro ao gerar relatório: {str(e)}")
            return {}

    # ========== PRIVATE HELPER METHODS ==========

    def _conflict_to_dict(self, conflict: ConflictQueue) -> Dict[str, Any]:
        """Converte objeto ConflictQueue para dicionário"""
        return {
            "id": conflict.id,
            "batch_id": conflict.batch_id,
            "entity_type": conflict.entity_type,
            "entity_id": conflict.entity_id,
            "clairis_id": conflict.clairis_id,
            "pipedrive_id": conflict.pipedrive_id,
            "conflict_field": conflict.conflict_field,
            "clairis_value": conflict.clairis_value,
            "pipedrive_value": conflict.pipedrive_value,
            "status": conflict.status,
            "resolution": conflict.resolution,
            "resolved_value": conflict.resolved_value,
            "resolved_by": conflict.resolved_by,
            "resolved_at": conflict.resolved_at.isoformat() if conflict.resolved_at else None,
            "created_at": conflict.created_at.isoformat() if conflict.created_at else None,
            "updated_at": conflict.updated_at.isoformat() if conflict.updated_at else None
        }

    def _get_recommended_value(self, conflict: ConflictQueue, resolution: str) -> Any:
        """Retorna o valor recomendado baseado na estratégia de resolução"""
        if resolution == "CLAIRIS_WINS":
            return conflict.clairis_value
        elif resolution == "PIPEDRIVE_WINS":
            return conflict.pipedrive_value
        elif resolution == "REJECT":
            return None
        else:
            return conflict.clairis_value  # default

    def _audit_conflict_resolution(self, conflict: ConflictQueue, resolution: str, notes: str):
        """Registra resolução de conflito em auditoria"""
        try:
            audit_log = AuditLog(
                batch_id=conflict.batch_id,
                entity_type=conflict.entity_type,
                entity_id=conflict.entity_id,
                field_name=conflict.conflict_field,
                old_value=conflict.pipedrive_value,
                new_value=conflict.resolved_value or conflict.clairis_value,
                source="conflict_resolution",
                status=AuditLogStatus.APPROVED,
                confidence_level=90.0,
                reason=f"Conflict resolution: {resolution}. {notes}",
                metadata={
                    "resolution_strategy": resolution,
                    "notes": notes,
                    "conflict_id": conflict.id
                }
            )

            self.db.add(audit_log)
            self.db.commit()
            logger.debug(f"Audit log criado para resolução de conflito {conflict.id}")

        except Exception as e:
            logger.error(f"Erro ao criar audit log de resolução: {str(e)}")

    def _count_by_entity_type(self, conflicts: List[ConflictQueue]) -> Dict[str, int]:
        """Conta conflitos por tipo de entidade"""
        counts = {}
        for conflict in conflicts:
            entity_type = conflict.entity_type
            counts[entity_type] = counts.get(entity_type, 0) + 1
        return counts

    def _count_by_field(self, conflicts: List[ConflictQueue]) -> Dict[str, int]:
        """Conta conflitos por campo"""
        counts = {}
        for conflict in conflicts:
            field = conflict.conflict_field
            counts[field] = counts.get(field, 0) + 1
        return counts

    def _count_by_resolution(self, conflicts: List[ConflictQueue]) -> Dict[str, int]:
        """Conta conflitos por estratégia de resolução"""
        counts = {}
        for conflict in conflicts:
            if conflict.resolution:
                resolution = conflict.resolution
                counts[resolution] = counts.get(resolution, 0) + 1
        return counts

    def _get_oldest_conflict_date(self, conflicts: List[ConflictQueue]) -> Optional[str]:
        """Retorna data do conflito mais antigo"""
        if not conflicts:
            return None
        oldest = min(conflicts, key=lambda c: c.created_at)
        return oldest.created_at.isoformat() if oldest.created_at else None

    def _calculate_resolution_rate(self, conflicts: List[ConflictQueue]) -> float:
        """Calcula taxa de resolução (resolvidos / total)"""
        if not conflicts:
            return 0.0
        resolved = len([c for c in conflicts if c.status == "RESOLVED"])
        return (resolved / len(conflicts)) * 100.0
