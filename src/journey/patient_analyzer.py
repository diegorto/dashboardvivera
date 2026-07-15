from datetime import datetime, timedelta
import pandas as pd
from src.core.logger import setup_logger
from src.models import PatientJourney, PatientStatus, PatientPriority

logger = setup_logger(__name__)

class PatientJourneyAnalyzer:
    """Analisador de jornada do paciente com todas as regras de negócio"""
    
    def __init__(self):
        pass
    
    def analyze_patient_journey(self, patient_data: dict, 
                               appointments: list, 
                               budgets: list,
                               contacts: list) -> PatientJourney:
        """Analisa a jornada completa do paciente"""
        
        patient_id = patient_data.get("clairis_id")
        logger.info(f"Analisando jornada do paciente {patient_id}")
        
        # 1. O paciente agendou?
        latest_appointment = self._get_latest_appointment(appointments)
        if not latest_appointment:
            logger.info(f"Paciente {patient_id}: Sem agendamento")
            return self._create_journey(patient_id, PatientStatus.NO_FUTURE_APPOINTMENT)
        
        # 2. O paciente compareceu?
        if not self._attended_appointment(latest_appointment):
            # 3. O paciente faltou?
            if self._check_missed(latest_appointment):
                # 3.1 Verificar se existe reagendamento
                rescheduled = self._check_rescheduled(appointments, latest_appointment)
                if not rescheduled:
                    logger.info(f"Paciente {patient_id}: Faltou e sem reagendamento")
                    return self._create_journey(
                        patient_id, 
                        PatientStatus.MISSED,
                        priority=PatientPriority.HIGH
                    )
                else:
                    logger.info(f"Paciente {patient_id}: Reagendou")
                    return self._create_journey(patient_id, PatientStatus.RESCHEDULED)
        
        # 2.1 Paciente compareceu
        # 5. O paciente possui agendamento futuro?
        future_appointment = self._get_future_appointment(appointments, latest_appointment)
        if future_appointment:
            logger.info(f"Paciente {patient_id}: Possui agendamento futuro")
            return self._create_journey(patient_id, PatientStatus.SCHEDULED)
        
        # 5.1 Sem agendamento futuro
        # 6. O paciente realizou orçamento?
        budget = self._get_latest_budget(budgets)
        if not budget:
            logger.info(f"Paciente {patient_id}: Compareceu sem orçamento")
            return self._create_journey(
                patient_id,
                PatientStatus.ATTENDED,
                priority=PatientPriority.MEDIUM
            )
        
        # 7. O orçamento foi fechado?
        if not self._is_budget_closed(budget):
            logger.info(f"Paciente {patient_id}: Orçamento pendente")
            return self._create_journey(
                patient_id,
                PatientStatus.BUDGET_PENDING,
                priority=PatientPriority.MEDIUM,
                budget_value=budget.get("sale_value")
            )
        
        # 7.1 Orçamento fechado
        # 8. Existe follow-up futuro?
        followup = self._get_next_followup(contacts, latest_appointment)
        if not followup:
            logger.info(f"Paciente {patient_id}: Sem follow-up futuro")
            return self._create_journey(
                patient_id,
                PatientStatus.FOLLOWUP_PENDING,
                priority=PatientPriority.MEDIUM
            )
        
        logger.info(f"Paciente {patient_id}: Jornada em andamento")
        return self._create_journey(patient_id, PatientStatus.IN_TREATMENT)
    
    def analyze_all_patients(self, patients_df: pd.DataFrame,
                            appointments_df: pd.DataFrame,
                            budgets_df: pd.DataFrame,
                            contacts_df: pd.DataFrame) -> list:
        """Analisa jornada de múltiplos pacientes"""
        
        journeys = []
        
        for idx, patient in patients_df.iterrows():
            patient_id = patient.get("clairis_id")
            
            patient_appointments = appointments_df[
                appointments_df.get("patient_id") == patient_id
            ].to_list()
            
            patient_budgets = budgets_df[
                budgets_df.get("patient_id") == patient_id
            ].to_list()
            
            patient_contacts = contacts_df[
                contacts_df.get("patient_id") == patient_id
            ].to_list()
            
            journey = self.analyze_patient_journey(
                patient.to_dict(),
                patient_appointments,
                patient_budgets,
                patient_contacts
            )
            journeys.append(journey)
        
        return journeys
    
    # ========== Helper Methods ==========
    
    def _get_latest_appointment(self, appointments: list) -> dict:
        if not appointments:
            return None
        return max(appointments, key=lambda x: x.get("appointment_date", ""))
    
    def _attended_appointment(self, appointment: dict) -> bool:
        status = appointment.get("status", "").upper()
        return status in ["COMPARECEU", "ATTENDED", "REALIZADO"]
    
    def _check_missed(self, appointment: dict) -> bool:
        status = appointment.get("status", "").upper()
        return status in ["FALTOU", "MISSED", "FALTA"]
    
    def _check_rescheduled(self, appointments: list, original: dict) -> bool:
        original_date = original.get("appointment_date")
        for apt in appointments:
            if (apt.get("appointment_date") > original_date and
                not self._check_missed(apt)):
                return True
        return False
    
    def _get_future_appointment(self, appointments: list, after_date: dict) -> dict:
        after_date_val = after_date.get("appointment_date")
        future = [apt for apt in appointments if apt.get("appointment_date") > after_date_val]
        return future[0] if future else None
    
    def _get_latest_budget(self, budgets: list) -> dict:
        if not budgets:
            return None
        return max(budgets, key=lambda x: x.get("created_at", ""))
    
    def _is_budget_closed(self, budget: dict) -> bool:
        status = budget.get("status", "").upper()
        return status in ["PAGO", "APROVADO", "CLOSED", "PAID"]
    
    def _get_next_followup(self, contacts: list, appointment: dict) -> dict:
        apt_date = appointment.get("appointment_date")
        followups = [c for c in contacts if c.get("contact_date", "") > apt_date]
        return followups[0] if followups else None
    
    def _create_journey(self, patient_id: str, status: PatientStatus,
                       priority: PatientPriority = PatientPriority.LOW,
                       budget_value: float = None) -> PatientJourney:
        return PatientJourney(
            patient_id=patient_id,
            current_status=status,
            priority=priority,
            budget_value=budget_value,
            ai_analysis={
                "analyzed_at": datetime.utcnow().isoformat(),
                "status": status.value,
                "priority": priority.value
            }
        )
