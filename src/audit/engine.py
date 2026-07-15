from datetime import datetime
from uuid import uuid4
from src.core.logger import setup_logger

logger = setup_logger(__name__)

class AuditEngine:
    """Motor de auditoria que gera registros de diferenças com análise de confiança"""
    
    def __init__(self):
        self.batch_id = str(uuid4())
        
    def generate_audit_log(self, comparison_results: dict) -> dict:
        """Gera log de auditoria a partir dos resultados de comparação"""
        logger.info(f"Gerando auditoria para batch {self.batch_id}...")
        
        audit_items = []
        
        # Process each match
        for match in comparison_results.get("matches", []):
            for difference in match.get("differences", []):
                audit_item = self._create_audit_item(
                    match, 
                    difference
                )
                audit_items.append(audit_item)
        
        # Process unmatched Clairis records (should be inserted)
        for unmatched in comparison_results.get("unmatched_clairis", []):
            audit_item = self._create_insert_audit_item(unmatched)
            audit_items.append(audit_item)
        
        return {
            "batch_id": self.batch_id,
            "timestamp": datetime.now().isoformat(),
            "total_items": len(audit_items),
            "items": audit_items
        }
    
    def _create_audit_item(self, match: dict, difference: dict) -> dict:
        """Cria um item de auditoria para uma diferença encontrada"""
        
        confidence = self._calculate_confidence(match, difference)
        ai_suggestion = self._generate_ai_suggestion(match, difference, confidence)
        
        return {
            "entity_type": "patient",
            "entity_id": match.get("clairis_id"),
            "field_name": difference.get("field"),
            "old_value": str(difference.get("pipedrive_value")),
            "new_value": str(difference.get("clairis_value")),
            "source": "clairis",
            "status": "PENDENTE",
            "confidence_level": confidence,
            "ai_suggestion": ai_suggestion,
            "reason": f"Atualização detectada via comparação ({match.get('match_method')})",
            "created_at": datetime.now().isoformat()
        }
    
    def _create_insert_audit_item(self, record: dict) -> dict:
        """Cria um item de auditoria para um registro não encontrado (inserção)"""
        
        return {
            "entity_type": "patient",
            "entity_id": record.get("clairis_id"),
            "field_name": "INSERT",
            "old_value": None,
            "new_value": str(record),
            "source": "clairis",
            "status": "PENDENTE",
            "confidence_level": 100.0,
            "ai_suggestion": "Novo paciente detectado no Clairis. Recomenda-se importar.",
            "reason": "Novo registro em Clairis não encontrado no Pipedrive",
            "created_at": datetime.now().isoformat()
        }
    
    def _calculate_confidence(self, match: dict, difference: dict) -> float:
        """Calcula nível de confiança da alteração"""
        
        base_confidence = match.get("match_score", 0)
        
        # Decrease confidence if field is commonly different
        field_name = difference.get("field", "")
        
        # Some fields have lower confidence
        if field_name in ["nome_normalizado"]:
            # Names can have legitimate variations
            base_confidence *= 0.95
        elif field_name in ["status_normalizado"]:
            # Status changes are common
            base_confidence *= 0.90
        
        return min(base_confidence, 100.0)
    
    def _generate_ai_suggestion(self, match: dict, difference: dict, confidence: float) -> str:
        """Gera sugestão da IA para ação a tomar"""
        
        field_name = difference.get("field", "")
        
        if confidence >= 95:
            return f"APROVAR AUTOMATICAMENTE: Atualizar {field_name} para '{difference.get('clairis_value')}'"
        elif confidence >= 85:
            return f"REVISAR: Diferença em {field_name}. Clairis: '{difference.get('clairis_value')}' vs Pipedrive: '{difference.get('pipedrive_value')}'"
        else:
            return f"ANÁLISE MANUAL: Possível conflito em {field_name}. Requer revisão humana."
    
    def generate_summary(self, audit_log: dict) -> dict:
        """Gera resumo da auditoria"""
        
        items = audit_log.get("items", [])
        
        summary = {
            "batch_id": audit_log.get("batch_id"),
            "total_items": len(items),
            "auto_approvable": len([i for i in items if "APROVAR AUTOMATICAMENTE" in i.get("ai_suggestion", "")]),
            "needs_review": len([i for i in items if "REVISAR" in i.get("ai_suggestion", "")]),
            "needs_manual": len([i for i in items if "ANÁLISE MANUAL" in i.get("ai_suggestion", "")]),
            "new_records": len([i for i in items if i.get("field_name") == "INSERT"]),
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"Auditoria resumida: {summary}")
        
        return summary
