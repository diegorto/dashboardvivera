from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from datetime import datetime
from sqlalchemy.orm import Session
from difflib import SequenceMatcher
from src.core.logger import setup_logger
from src.models import StagingPatient, AuditLog
from src.executive_os.database import Patient, PipedrivePeopleSnapshot
from src.staging.repository import StagingRepository

logger = setup_logger(__name__)


@dataclass
class FieldDivergence:
    """Representa uma divergência de campo entre fontes"""
    field_name: str
    clairis_value: Any
    pipedrive_value: Any
    executive_os_value: Optional[Any]
    confidence_level: float  # 0-100, quão confiante somos na recomendação
    recommended_value: Any
    recommendation_reason: str
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    impact: str  # Descrição do impacto da divergência


@dataclass
class ReconciliationReport:
    """Relatório completo de reconciliação"""
    entity_type: str  # person, budget, appointment
    entity_id: str
    reconciliation_date: datetime
    source_clairis_id: Optional[str]
    source_pipedrive_id: Optional[int]
    divergences: List[FieldDivergence]
    total_divergences: int
    critical_divergences: int
    confidence_score: float  # média de confidence_level
    recommendation: str  # SYNC, MANUAL_REVIEW, CONFLICT, OK
    next_steps: List[str]


class ReconciliationEngine:
    """Motor de reconciliação para análise de divergências campo-a-campo"""

    FIELD_PRIORITY = {
        "phone": 10,      # Muito importante para matching
        "cpf": 9,         # Identificador único
        "email": 8,       # Importante para contato
        "name": 7,        # Importante para identificação
        "birth_date": 6,  # Confirmação de identidade
        "status": 5,      # Importante para workflow
        "plan": 4,        # Menos crítico
        "referred_by": 3  # Informação auxiliar
    }

    FIELD_WEIGHTS = {
        "phone": 0.25,
        "cpf": 0.25,
        "email": 0.15,
        "name": 0.15,
        "birth_date": 0.10,
        "status": 0.05,
        "plan": 0.03,
        "referred_by": 0.02
    }

    def __init__(self, db: Session):
        self.db = db
        self.repo = StagingRepository(db)

    # ========== PERSON RECONCILIATION ==========

    def reconcile_person(self,
                        clairis_id: str,
                        pipedrive_id: Optional[int] = None) -> ReconciliationReport:
        """
        Reconcilia dados de uma pessoa entre Clairis, Pipedrive e Executive OS

        Args:
            clairis_id: ID do paciente no Clairis
            pipedrive_id: ID da pessoa no Pipedrive (opcional)

        Returns:
            ReconciliationReport com análise completa
        """
        logger.info(f"Iniciando reconciliação: Clairis {clairis_id}, Pipedrive {pipedrive_id}")

        # 1. Buscar dados das 3 fontes
        clairis_data = self._get_clairis_person_data(clairis_id)
        pipedrive_data = self._get_pipedrive_person_data(pipedrive_id) if pipedrive_id else None
        executive_os_data = self._get_executive_os_person_data(clairis_id)

        if not clairis_data:
            logger.error(f"Paciente Clairis não encontrado: {clairis_id}")
            return self._create_empty_report("person", clairis_id, clairis_id, pipedrive_id)

        # 2. Detectar divergências
        divergences = self._detect_person_divergences(
            clairis_data,
            pipedrive_data,
            executive_os_data
        )

        # 3. Gerar recomendações para cada divergência
        for divergence in divergences:
            self._recommend_field_value(divergence)

        # 4. Calcular confiança geral
        confidence_score = self._calculate_confidence(divergences)

        # 5. Determinar recomendação final
        recommendation = self._determine_recommendation(divergences, confidence_score)

        # 6. Gerar próximos passos
        next_steps = self._generate_next_steps(divergences, recommendation)

        # 7. Montar relatório
        report = ReconciliationReport(
            entity_type="person",
            entity_id=clairis_id,
            reconciliation_date=datetime.utcnow(),
            source_clairis_id=clairis_id,
            source_pipedrive_id=pipedrive_id,
            divergences=divergences,
            total_divergences=len(divergences),
            critical_divergences=len([d for d in divergences if d.severity == "CRITICAL"]),
            confidence_score=confidence_score,
            recommendation=recommendation,
            next_steps=next_steps
        )

        logger.info(f"Reconciliação concluída: {len(divergences)} divergências, "
                   f"confiança {confidence_score:.1f}%, recomendação: {recommendation}")

        return report

    def _get_clairis_person_data(self, clairis_id: str) -> Optional[Dict]:
        """Obtém dados de pessoa do Clairis (staging)"""
        try:
            patient = self.repo.get_patient_by_clairis_id(clairis_id)
            if not patient:
                return None

            return {
                "id": patient.id,
                "clairis_id": patient.clairis_id,
                "name": patient.name,
                "phone": patient.phone,
                "email": patient.email,
                "cpf": patient.cpf,
                "birth_date": patient.birth_date,
                "status": patient.status,
                "plan": patient.plan,
                "referred_by": patient.referred_by,
                "source": "clairis"
            }
        except Exception as e:
            logger.error(f"Erro ao buscar dados Clairis {clairis_id}: {str(e)}")
            return None

    def _get_pipedrive_person_data(self, pipedrive_id: int) -> Optional[Dict]:
        """Obtém dados mais recentes de pessoa do Pipedrive"""
        try:
            snapshot = self.db.query(PipedrivePeopleSnapshot)\
                .filter(PipedrivePeopleSnapshot.pipedrive_id == pipedrive_id)\
                .order_by(PipedrivePeopleSnapshot.snapshot_date.desc())\
                .first()

            if not snapshot or not snapshot.data:
                return None

            data = snapshot.data
            return {
                "id": data.get("id"),
                "pipedrive_id": pipedrive_id,
                "name": data.get("name"),
                "phone": data.get("phone"),
                "email": data.get("email"),
                "cpf": data.get("cpf"),
                "birth_date": data.get("birth_date"),
                "status": data.get("status"),
                "plan": data.get("custom_fields", {}).get("plan"),
                "referred_by": data.get("custom_fields", {}).get("referred_by"),
                "source": "pipedrive",
                "snapshot_date": snapshot.snapshot_date
            }
        except Exception as e:
            logger.error(f"Erro ao buscar dados Pipedrive {pipedrive_id}: {str(e)}")
            return None

    def _get_executive_os_person_data(self, clairis_id: str) -> Optional[Dict]:
        """Obtém dados consolidados de pessoa do Executive OS"""
        try:
            patient = self.db.query(Patient)\
                .filter(Patient.clairis_id == clairis_id)\
                .first()

            if not patient:
                return None

            return {
                "id": patient.id,
                "clairis_id": patient.clairis_id,
                "pipedrive_id": patient.pipedrive_id,
                "name": patient.name,
                "phone": patient.phone,
                "email": patient.email,
                "cpf": patient.cpf,
                "birth_date": patient.birth_date,
                "status": patient.status,
                "plan": patient.plan,
                "referred_by": patient.referred_by,
                "sync_status": patient.sync_status,
                "source": "executive_os"
            }
        except Exception as e:
            logger.error(f"Erro ao buscar dados Executive OS {clairis_id}: {str(e)}")
            return None

    def _detect_person_divergences(self,
                                   clairis_data: Dict,
                                   pipedrive_data: Optional[Dict],
                                   executive_os_data: Optional[Dict]) -> List[FieldDivergence]:
        """Detecta divergências entre fontes de dados"""
        divergences = []
        fields_to_check = ["name", "phone", "email", "cpf", "birth_date", "status", "plan", "referred_by"]

        for field in fields_to_check:
            clairis_value = clairis_data.get(field)
            pipedrive_value = pipedrive_data.get(field) if pipedrive_data else None
            executive_os_value = executive_os_data.get(field) if executive_os_data else None

            # Normalizar valores para comparação
            clairis_norm = self._normalize_value(clairis_value, field)
            pipedrive_norm = self._normalize_value(pipedrive_value, field)
            eos_norm = self._normalize_value(executive_os_value, field)

            # Detectar divergências
            if pipedrive_norm and clairis_norm != pipedrive_norm:
                divergence = FieldDivergence(
                    field_name=field,
                    clairis_value=clairis_value,
                    pipedrive_value=pipedrive_value,
                    executive_os_value=executive_os_value,
                    confidence_level=0.0,
                    recommended_value=None,
                    recommendation_reason="",
                    severity=self._assess_severity(field, clairis_norm, pipedrive_norm),
                    impact=self._assess_impact(field, clairis_norm, pipedrive_norm)
                )
                divergences.append(divergence)
                logger.warning(f"Divergência detectada em {field}: "
                             f"Clairis={clairis_norm} vs Pipedrive={pipedrive_norm}")

        return divergences

    def _normalize_value(self, value: Any, field: str) -> str:
        """Normaliza valor para comparação"""
        if value is None:
            return ""

        value_str = str(value).strip().lower()

        if field in ["phone", "cpf"]:
            # Remove caracteres especiais
            value_str = "".join(c for c in value_str if c.isdigit())

        return value_str

    def _assess_severity(self, field: str, value1: str, value2: str) -> str:
        """Avalia severidade da divergência"""
        if field in ["phone", "cpf", "email"]:
            return "CRITICAL" if value1 and value2 else "HIGH"
        elif field in ["name", "birth_date"]:
            return "HIGH"
        elif field == "status":
            return "MEDIUM"
        else:
            return "LOW"

    def _assess_impact(self, field: str, value1: str, value2: str) -> str:
        """Descreve impacto da divergência"""
        impacts = {
            "phone": "Pode afetar matching de pacientes e comunicação",
            "cpf": "Pode impedir identificação correta de pacientes",
            "email": "Pode afetar notificações e contato",
            "name": "Pode causar confusão na identificação",
            "birth_date": "Afeta confirmação de identidade",
            "status": "Pode afetar workflow e decisões",
            "plan": "Afeta oferecimento de serviços",
            "referred_by": "Informação histórica, impacto baixo"
        }
        return impacts.get(field, "Impacto não categorizado")

    def _recommend_field_value(self, divergence: FieldDivergence):
        """Recomenda qual valor usar para um campo divergente"""
        field = divergence.field_name
        clairis = divergence.clairis_value
        pipedrive = divergence.pipedrive_value

        # Regras de recomendação por campo
        if field == "phone":
            # Usar o que não é vazio
            if clairis and pipedrive:
                # Ambos preenchidos - compare qual é mais recente ou completo
                divergence.recommended_value = clairis
                divergence.recommendation_reason = "Clairis é fonte primária"
                divergence.confidence_level = 85.0
            elif clairis:
                divergence.recommended_value = clairis
                divergence.recommendation_reason = "Clairis preenchido, Pipedrive vazio"
                divergence.confidence_level = 90.0
            else:
                divergence.recommended_value = pipedrive
                divergence.recommendation_reason = "Pipedrive preenchido, Clairis vazio"
                divergence.confidence_level = 75.0

        elif field == "cpf":
            divergence.recommended_value = clairis
            divergence.recommendation_reason = "CPF Clairis é fonte primária (documento)"
            divergence.confidence_level = 95.0

        elif field == "email":
            similarity = self._calculate_similarity(str(clairis or ""), str(pipedrive or ""))
            if similarity > 0.8:
                divergence.recommended_value = clairis
                divergence.recommendation_reason = "Valores similares, usando Clairis"
                divergence.confidence_level = 80.0
            else:
                divergence.recommended_value = clairis
                divergence.recommendation_reason = "Clairis é fonte primária"
                divergence.confidence_level = 75.0

        elif field == "name":
            similarity = self._calculate_similarity(str(clairis or ""), str(pipedrive or ""))
            if similarity > 0.85:
                divergence.recommended_value = clairis
                divergence.recommendation_reason = "Nomes similares, usando Clairis"
                divergence.confidence_level = 85.0
            else:
                divergence.recommended_value = clairis
                divergence.recommendation_reason = "Clairis é fonte primária"
                divergence.confidence_level = 70.0

        else:
            # Padrão: usar Clairis como fonte primária
            divergence.recommended_value = clairis
            divergence.recommendation_reason = f"Clairis é fonte primária para {field}"
            divergence.confidence_level = 70.0

    def _calculate_similarity(self, str1: str, str2: str) -> float:
        """Calcula similaridade entre duas strings (0-1)"""
        return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()

    def _calculate_confidence(self, divergences: List[FieldDivergence]) -> float:
        """Calcula confiança geral da reconciliação"""
        if not divergences:
            return 100.0

        # Ponderar por importância do campo
        total_weight = 0.0
        weighted_confidence = 0.0

        for divergence in divergences:
            weight = self.FIELD_WEIGHTS.get(divergence.field_name, 0.01)
            weighted_confidence += divergence.confidence_level * weight
            total_weight += weight

        return weighted_confidence / total_weight if total_weight > 0 else 0.0

    def _determine_recommendation(self, divergences: List[FieldDivergence], confidence: float) -> str:
        """Determina recomendação final"""
        if not divergences:
            return "OK"

        critical_count = len([d for d in divergences if d.severity == "CRITICAL"])
        high_count = len([d for d in divergences if d.severity == "HIGH"])

        if critical_count > 0:
            return "CONFLICT"
        elif high_count > 1:
            return "MANUAL_REVIEW"
        elif confidence >= 80:
            return "SYNC"
        else:
            return "MANUAL_REVIEW"

    def _generate_next_steps(self, divergences: List[FieldDivergence], recommendation: str) -> List[str]:
        """Gera próximos passos baseado na análise"""
        steps = []

        if recommendation == "CONFLICT":
            steps.append("Revisar manualmente divergências críticas")
            steps.append("Entrar em contato com usuário para confirmar dados corretos")
            critical_fields = [d.field_name for d in divergences if d.severity == "CRITICAL"]
            steps.append(f"Conflitos críticos em: {', '.join(critical_fields)}")

        elif recommendation == "MANUAL_REVIEW":
            steps.append("Aguardar revisão manual de divergências de alta prioridade")
            steps.append("Especialista deve validar dados antes de sincronizar")

        elif recommendation == "SYNC":
            steps.append("Proceder com sincronização automática")
            if divergences:
                steps.append(f"Aplicar {len(divergences)} recomendações de reconciliação")

        else:  # OK
            steps.append("Nenhuma ação necessária")

        return steps

    def _create_empty_report(self, entity_type: str, entity_id: str,
                            clairis_id: str, pipedrive_id: Optional[int]) -> ReconciliationReport:
        """Cria relatório vazio para casos de erro"""
        return ReconciliationReport(
            entity_type=entity_type,
            entity_id=entity_id,
            reconciliation_date=datetime.utcnow(),
            source_clairis_id=clairis_id,
            source_pipedrive_id=pipedrive_id,
            divergences=[],
            total_divergences=0,
            critical_divergences=0,
            confidence_score=0.0,
            recommendation="CONFLICT",
            next_steps=["Dados não disponíveis para reconciliação"]
        )

    # ========== RECONCILIATION ANALYSIS ==========

    def get_reconciliation_summary(self, batch_id: Optional[str] = None) -> Dict[str, Any]:
        """Retorna resumo de reconciliações realizadas"""
        try:
            audit_logs = self.db.query(AuditLog).all()
            if batch_id:
                audit_logs = [log for log in audit_logs if log.batch_id == batch_id]

            summary = {
                "total_entities": len(audit_logs),
                "entities_with_conflicts": len([log for log in audit_logs if log.status == "CONFLICT"]),
                "entities_approved": len([log for log in audit_logs if log.status == "APPROVED"]),
                "entities_rejected": len([log for log in audit_logs if log.status == "REJECTED"]),
                "average_confidence": self._calculate_average_confidence(audit_logs),
                "timestamp": datetime.utcnow()
            }

            logger.info(f"Resumo de reconciliação: {summary}")
            return summary
        except Exception as e:
            logger.error(f"Erro ao gerar resumo de reconciliação: {str(e)}")
            return {}

    def _calculate_average_confidence(self, audit_logs: List[AuditLog]) -> float:
        """Calcula confiança média dos logs"""
        if not audit_logs:
            return 0.0

        confidences = [log.confidence_level for log in audit_logs if log.confidence_level]
        return sum(confidences) / len(confidences) if confidences else 0.0
