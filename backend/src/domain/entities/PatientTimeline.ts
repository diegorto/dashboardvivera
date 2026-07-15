/**
 * Entidade: Timeline do Paciente
 * Rastreia todos os eventos na jornada do paciente
 */

export enum PatientEventType {
  LEAD_CREATED = 'lead_created',
  APPOINTMENT_SCHEDULED = 'appointment_scheduled',
  APPOINTMENT_CONFIRMED = 'appointment_confirmed',
  APPOINTMENT_ATTENDED = 'appointment_attended',
  APPOINTMENT_MISSED = 'appointment_missed',
  APPOINTMENT_RESCHEDULED = 'appointment_rescheduled',
  BUDGET_CREATED = 'budget_created',
  BUDGET_APPROVED = 'budget_approved',
  BUDGET_REJECTED = 'budget_rejected',
  DEAL_STARTED = 'deal_started',
  DEAL_WON = 'deal_won',
  DEAL_LOST = 'deal_lost',
  TREATMENT_STARTED = 'treatment_started',
  TREATMENT_COMPLETED = 'treatment_completed',
  RETURN_VISIT = 'return_visit',
  CONTACT_MADE = 'contact_made',
  CONFLICT_DETECTED = 'conflict_detected',
  DUPLICATE_MERGED = 'duplicate_merged',
  DATA_NORMALIZED = 'data_normalized',
  RECOVERY_ATTEMPTED = 'recovery_attempted'
}

export class PatientTimeline {
  id: string;
  patientId: string;
  eventType: PatientEventType;
  eventDate: Date;
  sourceId: string;  // Qual integração registrou o evento
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;

  constructor(
    id: string,
    patientId: string,
    eventType: PatientEventType,
    eventDate: Date,
    sourceId: string
  ) {
    this.id = id;
    this.patientId = patientId;
    this.eventType = eventType;
    this.eventDate = eventDate;
    this.sourceId = sourceId;
    this.createdAt = new Date();
  }

  static create(
    patientId: string,
    eventType: PatientEventType,
    sourceId: string,
    eventDate: Date = new Date()
  ): PatientTimeline {
    const id = `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return new PatientTimeline(id, patientId, eventType, eventDate, sourceId);
  }

  addDescription(description: string): void {
    this.description = description;
  }

  addMetadata(key: string, value: any): void {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata[key] = value;
  }

  getEventLabel(): string {
    const labels: Record<PatientEventType, string> = {
      [PatientEventType.LEAD_CREATED]: 'Lead criado',
      [PatientEventType.APPOINTMENT_SCHEDULED]: 'Agendamento criado',
      [PatientEventType.APPOINTMENT_CONFIRMED]: 'Agendamento confirmado',
      [PatientEventType.APPOINTMENT_ATTENDED]: 'Compareceu',
      [PatientEventType.APPOINTMENT_MISSED]: 'Faltou',
      [PatientEventType.APPOINTMENT_RESCHEDULED]: 'Reagendado',
      [PatientEventType.BUDGET_CREATED]: 'Orçamento criado',
      [PatientEventType.BUDGET_APPROVED]: 'Orçamento aprovado',
      [PatientEventType.BUDGET_REJECTED]: 'Orçamento rejeitado',
      [PatientEventType.DEAL_STARTED]: 'Negócio iniciado',
      [PatientEventType.DEAL_WON]: 'Negócio ganho',
      [PatientEventType.DEAL_LOST]: 'Negócio perdido',
      [PatientEventType.TREATMENT_STARTED]: 'Tratamento iniciado',
      [PatientEventType.TREATMENT_COMPLETED]: 'Tratamento concluído',
      [PatientEventType.RETURN_VISIT]: 'Visita de retorno',
      [PatientEventType.CONTACT_MADE]: 'Contato realizado',
      [PatientEventType.CONFLICT_DETECTED]: 'Conflito detectado',
      [PatientEventType.DUPLICATE_MERGED]: 'Duplicata unida',
      [PatientEventType.DATA_NORMALIZED]: 'Dados normalizados',
      [PatientEventType.RECOVERY_ATTEMPTED]: 'Tentativa de recuperação'
    };
    return labels[this.eventType] || this.eventType;
  }

  isPositive(): boolean {
    const positiveEvents = [
      PatientEventType.APPOINTMENT_ATTENDED,
      PatientEventType.APPOINTMENT_CONFIRMED,
      PatientEventType.BUDGET_APPROVED,
      PatientEventType.DEAL_WON,
      PatientEventType.TREATMENT_COMPLETED,
      PatientEventType.RECOVERY_ATTEMPTED
    ];
    return positiveEvents.includes(this.eventType);
  }

  isNegative(): boolean {
    const negativeEvents = [
      PatientEventType.APPOINTMENT_MISSED,
      PatientEventType.BUDGET_REJECTED,
      PatientEventType.DEAL_LOST,
      PatientEventType.CONFLICT_DETECTED
    ];
    return negativeEvents.includes(this.eventType);
  }

  isNeutral(): boolean {
    return !this.isPositive() && !this.isNegative();
  }
}
