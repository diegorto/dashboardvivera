from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from src.core.logger import setup_logger
from src.models import (
    StagingPatient,
    StagingBudget,
    StagingBudgetRejected,
    StagingAppointment,
    AuditLog,
    ApprovalQueue
)

logger = setup_logger(__name__)


class StagingRepository:
    """Repositório centralizado de acesso a dados de staging"""

    def __init__(self, db: Session):
        self.db = db

    # ========== STAGING PATIENTS ==========

    def get_all_patients(self, limit: int = 500, offset: int = 0) -> List[StagingPatient]:
        """Retorna todos os pacientes de staging"""
        try:
            patients = self.db.query(StagingPatient)\
                .order_by(desc(StagingPatient.imported_at))\
                .limit(limit)\
                .offset(offset)\
                .all()
            logger.debug(f"Retornados {len(patients)} pacientes de staging")
            return patients
        except Exception as e:
            logger.error(f"Erro ao buscar pacientes: {str(e)}")
            return []

    def get_patient_by_clairis_id(self, clairis_id: str) -> Optional[StagingPatient]:
        """Busca paciente por ID Clairis"""
        try:
            patient = self.db.query(StagingPatient)\
                .filter(StagingPatient.clairis_id == clairis_id)\
                .first()
            if patient:
                logger.debug(f"Paciente encontrado: {clairis_id}")
            return patient
        except Exception as e:
            logger.error(f"Erro ao buscar paciente {clairis_id}: {str(e)}")
            return None

    def get_patient_by_phone(self, phone: str) -> Optional[StagingPatient]:
        """Busca paciente por telefone"""
        try:
            patient = self.db.query(StagingPatient)\
                .filter(StagingPatient.phone == phone)\
                .first()
            if patient:
                logger.debug(f"Paciente encontrado com telefone: {phone}")
            return patient
        except Exception as e:
            logger.error(f"Erro ao buscar paciente por telefone {phone}: {str(e)}")
            return None

    def get_patient_by_email(self, email: str) -> Optional[StagingPatient]:
        """Busca paciente por email"""
        try:
            patient = self.db.query(StagingPatient)\
                .filter(StagingPatient.email == email)\
                .first()
            if patient:
                logger.debug(f"Paciente encontrado com email: {email}")
            return patient
        except Exception as e:
            logger.error(f"Erro ao buscar paciente por email {email}: {str(e)}")
            return None

    def get_patients_by_status(self, status: str, limit: int = 500) -> List[StagingPatient]:
        """Retorna pacientes por status"""
        try:
            patients = self.db.query(StagingPatient)\
                .filter(StagingPatient.status == status)\
                .order_by(desc(StagingPatient.imported_at))\
                .limit(limit)\
                .all()
            logger.debug(f"Retornados {len(patients)} pacientes com status: {status}")
            return patients
        except Exception as e:
            logger.error(f"Erro ao buscar pacientes por status {status}: {str(e)}")
            return []

    def get_recent_patients(self, hours: int = 24) -> List[StagingPatient]:
        """Retorna pacientes importados nas últimas X horas"""
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)
            patients = self.db.query(StagingPatient)\
                .filter(StagingPatient.imported_at >= cutoff_time)\
                .order_by(desc(StagingPatient.imported_at))\
                .all()
            logger.debug(f"Retornados {len(patients)} pacientes dos últimos {hours}h")
            return patients
        except Exception as e:
            logger.error(f"Erro ao buscar pacientes recentes: {str(e)}")
            return []

    def count_patients(self) -> int:
        """Conta total de pacientes em staging"""
        try:
            count = self.db.query(StagingPatient).count()
            logger.debug(f"Total de pacientes em staging: {count}")
            return count
        except Exception as e:
            logger.error(f"Erro ao contar pacientes: {str(e)}")
            return 0

    def get_patients_with_phone(self) -> List[StagingPatient]:
        """Retorna pacientes que têm telefone (necessário para matching)"""
        try:
            patients = self.db.query(StagingPatient)\
                .filter(StagingPatient.phone.isnot(None))\
                .filter(StagingPatient.phone != "")\
                .all()
            logger.debug(f"Retornados {len(patients)} pacientes com telefone")
            return patients
        except Exception as e:
            logger.error(f"Erro ao buscar pacientes com telefone: {str(e)}")
            return []

    # ========== STAGING BUDGETS ==========

    def get_all_budgets(self, limit: int = 500, offset: int = 0) -> List[StagingBudget]:
        """Retorna todos os orçamentos de staging"""
        try:
            budgets = self.db.query(StagingBudget)\
                .order_by(desc(StagingBudget.imported_at))\
                .limit(limit)\
                .offset(offset)\
                .all()
            logger.debug(f"Retornados {len(budgets)} orçamentos de staging")
            return budgets
        except Exception as e:
            logger.error(f"Erro ao buscar orçamentos: {str(e)}")
            return []

    def get_budget_by_clairis_id(self, clairis_id: str) -> Optional[StagingBudget]:
        """Busca orçamento por ID Clairis"""
        try:
            budget = self.db.query(StagingBudget)\
                .filter(StagingBudget.clairis_id == clairis_id)\
                .first()
            if budget:
                logger.debug(f"Orçamento encontrado: {clairis_id}")
            return budget
        except Exception as e:
            logger.error(f"Erro ao buscar orçamento {clairis_id}: {str(e)}")
            return None

    def get_budgets_by_patient_id(self, patient_id: int) -> List[StagingBudget]:
        """Retorna orçamentos de um paciente"""
        try:
            budgets = self.db.query(StagingBudget)\
                .filter(StagingBudget.patient_id == patient_id)\
                .order_by(desc(StagingBudget.created_at))\
                .all()
            logger.debug(f"Retornados {len(budgets)} orçamentos para paciente {patient_id}")
            return budgets
        except Exception as e:
            logger.error(f"Erro ao buscar orçamentos do paciente {patient_id}: {str(e)}")
            return []

    def get_budgets_by_status(self, status: str, limit: int = 500) -> List[StagingBudget]:
        """Retorna orçamentos por status"""
        try:
            budgets = self.db.query(StagingBudget)\
                .filter(StagingBudget.status == status)\
                .order_by(desc(StagingBudget.created_at))\
                .limit(limit)\
                .all()
            logger.debug(f"Retornados {len(budgets)} orçamentos com status: {status}")
            return budgets
        except Exception as e:
            logger.error(f"Erro ao buscar orçamentos por status {status}: {str(e)}")
            return []

    def get_budgets_by_date_range(self, start_date: datetime, end_date: datetime) -> List[StagingBudget]:
        """Retorna orçamentos em um período"""
        try:
            budgets = self.db.query(StagingBudget)\
                .filter(and_(
                    StagingBudget.created_at >= start_date,
                    StagingBudget.created_at <= end_date
                ))\
                .order_by(desc(StagingBudget.created_at))\
                .all()
            logger.debug(f"Retornados {len(budgets)} orçamentos entre {start_date} e {end_date}")
            return budgets
        except Exception as e:
            logger.error(f"Erro ao buscar orçamentos por período: {str(e)}")
            return []

    def count_budgets(self) -> int:
        """Conta total de orçamentos em staging"""
        try:
            count = self.db.query(StagingBudget).count()
            logger.debug(f"Total de orçamentos em staging: {count}")
            return count
        except Exception as e:
            logger.error(f"Erro ao contar orçamentos: {str(e)}")
            return 0

    # ========== STAGING BUDGETS REJECTED ==========

    def get_all_rejected_budgets(self, limit: int = 500) -> List[StagingBudgetRejected]:
        """Retorna todos os orçamentos rejeitados"""
        try:
            budgets = self.db.query(StagingBudgetRejected)\
                .order_by(desc(StagingBudgetRejected.rejected_date))\
                .limit(limit)\
                .all()
            logger.debug(f"Retornados {len(budgets)} orçamentos rejeitados")
            return budgets
        except Exception as e:
            logger.error(f"Erro ao buscar orçamentos rejeitados: {str(e)}")
            return []

    def get_rejected_budget_by_clairis_id(self, clairis_id: str) -> Optional[StagingBudgetRejected]:
        """Busca orçamento rejeitado por ID Clairis"""
        try:
            budget = self.db.query(StagingBudgetRejected)\
                .filter(StagingBudgetRejected.clairis_id == clairis_id)\
                .first()
            if budget:
                logger.debug(f"Orçamento rejeitado encontrado: {clairis_id}")
            return budget
        except Exception as e:
            logger.error(f"Erro ao buscar orçamento rejeitado {clairis_id}: {str(e)}")
            return None

    def count_rejected_budgets(self) -> int:
        """Conta total de orçamentos rejeitados"""
        try:
            count = self.db.query(StagingBudgetRejected).count()
            logger.debug(f"Total de orçamentos rejeitados: {count}")
            return count
        except Exception as e:
            logger.error(f"Erro ao contar orçamentos rejeitados: {str(e)}")
            return 0

    # ========== STAGING APPOINTMENTS ==========

    def get_all_appointments(self, limit: int = 500, offset: int = 0) -> List[StagingAppointment]:
        """Retorna todos os agendamentos de staging"""
        try:
            appointments = self.db.query(StagingAppointment)\
                .order_by(desc(StagingAppointment.appointment_date))\
                .limit(limit)\
                .offset(offset)\
                .all()
            logger.debug(f"Retornados {len(appointments)} agendamentos de staging")
            return appointments
        except Exception as e:
            logger.error(f"Erro ao buscar agendamentos: {str(e)}")
            return []

    def get_appointment_by_clairis_id(self, clairis_id: str) -> Optional[StagingAppointment]:
        """Busca agendamento por ID Clairis"""
        try:
            appointment = self.db.query(StagingAppointment)\
                .filter(StagingAppointment.clairis_id == clairis_id)\
                .first()
            if appointment:
                logger.debug(f"Agendamento encontrado: {clairis_id}")
            return appointment
        except Exception as e:
            logger.error(f"Erro ao buscar agendamento {clairis_id}: {str(e)}")
            return None

    def get_appointments_by_patient_id(self, patient_id: int) -> List[StagingAppointment]:
        """Retorna agendamentos de um paciente"""
        try:
            appointments = self.db.query(StagingAppointment)\
                .filter(StagingAppointment.patient_id == patient_id)\
                .order_by(desc(StagingAppointment.appointment_date))\
                .all()
            logger.debug(f"Retornados {len(appointments)} agendamentos para paciente {patient_id}")
            return appointments
        except Exception as e:
            logger.error(f"Erro ao buscar agendamentos do paciente {patient_id}: {str(e)}")
            return []

    def get_appointments_by_date_range(self, start_date: datetime, end_date: datetime) -> List[StagingAppointment]:
        """Retorna agendamentos em um período"""
        try:
            appointments = self.db.query(StagingAppointment)\
                .filter(and_(
                    StagingAppointment.appointment_date >= start_date,
                    StagingAppointment.appointment_date <= end_date
                ))\
                .order_by(StagingAppointment.appointment_date)\
                .all()
            logger.debug(f"Retornados {len(appointments)} agendamentos entre {start_date} e {end_date}")
            return appointments
        except Exception as e:
            logger.error(f"Erro ao buscar agendamentos por período: {str(e)}")
            return []

    def get_appointments_by_status(self, status: str, limit: int = 500) -> List[StagingAppointment]:
        """Retorna agendamentos por status"""
        try:
            appointments = self.db.query(StagingAppointment)\
                .filter(StagingAppointment.status == status)\
                .order_by(desc(StagingAppointment.appointment_date))\
                .limit(limit)\
                .all()
            logger.debug(f"Retornados {len(appointments)} agendamentos com status: {status}")
            return appointments
        except Exception as e:
            logger.error(f"Erro ao buscar agendamentos por status {status}: {str(e)}")
            return []

    def get_upcoming_appointments(self, days_ahead: int = 7) -> List[StagingAppointment]:
        """Retorna agendamentos futuros (próximos X dias)"""
        try:
            now = datetime.utcnow()
            future = now + timedelta(days=days_ahead)
            appointments = self.db.query(StagingAppointment)\
                .filter(and_(
                    StagingAppointment.appointment_date >= now,
                    StagingAppointment.appointment_date <= future
                ))\
                .order_by(StagingAppointment.appointment_date)\
                .all()
            logger.debug(f"Retornados {len(appointments)} agendamentos dos próximos {days_ahead} dias")
            return appointments
        except Exception as e:
            logger.error(f"Erro ao buscar agendamentos futuros: {str(e)}")
            return []

    def count_appointments(self) -> int:
        """Conta total de agendamentos em staging"""
        try:
            count = self.db.query(StagingAppointment).count()
            logger.debug(f"Total de agendamentos em staging: {count}")
            return count
        except Exception as e:
            logger.error(f"Erro ao contar agendamentos: {str(e)}")
            return 0

    # ========== RELATED QUERIES (AUDIT LOGS) ==========

    def get_audit_logs_by_batch(self, batch_id: str, status: Optional[str] = None) -> List[AuditLog]:
        """Retorna audit logs de um batch"""
        try:
            query = self.db.query(AuditLog).filter(AuditLog.batch_id == batch_id)
            if status:
                query = query.filter(AuditLog.status == status)

            logs = query.order_by(desc(AuditLog.created_at)).all()
            logger.debug(f"Retornados {len(logs)} logs de auditoria do batch {batch_id}")
            return logs
        except Exception as e:
            logger.error(f"Erro ao buscar logs de auditoria: {str(e)}")
            return []

    def get_approval_queue_by_batch(self, batch_id: str, status: Optional[str] = None) -> List[ApprovalQueue]:
        """Retorna fila de aprovação de um batch"""
        try:
            query = self.db.query(ApprovalQueue).filter(ApprovalQueue.batch_id == batch_id)
            if status:
                query = query.filter(ApprovalQueue.status == status)

            items = query.order_by(desc(ApprovalQueue.created_at)).all()
            logger.debug(f"Retornados {len(items)} itens da fila de aprovação do batch {batch_id}")
            return items
        except Exception as e:
            logger.error(f"Erro ao buscar fila de aprovação: {str(e)}")
            return []

    # ========== STATISTICS ==========

    def get_staging_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas gerais de staging"""
        try:
            stats = {
                "patients": self.count_patients(),
                "budgets": self.count_budgets(),
                "budgets_rejected": self.count_rejected_budgets(),
                "appointments": self.count_appointments(),
                "patients_with_phone": len(self.get_patients_with_phone()),
                "recent_patients_24h": len(self.get_recent_patients(hours=24))
            }
            logger.info(f"Estatísticas de staging: {stats}")
            return stats
        except Exception as e:
            logger.error(f"Erro ao gerar estatísticas de staging: {str(e)}")
            return {}

    def get_budget_statistics(self) -> Dict[str, Any]:
        """Retorna estatísticas de orçamentos"""
        try:
            all_budgets = self.db.query(StagingBudget).all()
            if not all_budgets:
                return {
                    "total_budgets": 0,
                    "total_value": 0.0,
                    "average_value": 0.0,
                    "total_cost": 0.0,
                    "total_margin": 0.0
                }

            total_value = sum(b.sale_value or 0 for b in all_budgets)
            total_cost = sum(b.cost or 0 for b in all_budgets)
            total_margin = sum(b.net_value or 0 for b in all_budgets)

            stats = {
                "total_budgets": len(all_budgets),
                "total_value": total_value,
                "average_value": total_value / len(all_budgets) if all_budgets else 0,
                "total_cost": total_cost,
                "total_margin": total_margin
            }
            logger.info(f"Estatísticas de orçamentos: {stats}")
            return stats
        except Exception as e:
            logger.error(f"Erro ao gerar estatísticas de orçamentos: {str(e)}")
            return {}

    # ========== CLEANUP ==========

    def delete_staging_data(self, batch_id: str = None) -> Dict[str, int]:
        """Limpa dados de staging (opcionalmente por batch)"""
        try:
            deleted_counts = {
                "patients": 0,
                "budgets": 0,
                "budgets_rejected": 0,
                "appointments": 0
            }

            if batch_id:
                logger.warning(f"Limpando dados de staging do batch {batch_id}")
            else:
                logger.warning("Limpando TODOS os dados de staging")

            return deleted_counts
        except Exception as e:
            logger.error(f"Erro ao limpar staging: {str(e)}")
            return {}
