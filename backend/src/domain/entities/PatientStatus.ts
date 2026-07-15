/**
 * Entidade: Status do Paciente
 * Rastreia o estágio atual e status geral de um paciente
 */

export enum JourneyStage {
  NEW_LEAD = 'Novo Lead',
  SCHEDULED = 'Agendado',
  CONFIRMED = 'Confirmado',
  ATTENDED = 'Compareceu',
  MISSED = 'Faltou',
  RESCHEDULED = 'Reagendado',
  PENDING_BUDGET = 'Orçamento Pendente',
  NEGOTIATING = 'Em Negociação',
  BUDGET_CLOSED = 'Orçamento Fechado',
  IN_TREATMENT = 'Em Tratamento',
  RETURN_PENDING = 'Retorno Pendente',
  FOLLOWUP_PENDING = 'Follow-up Pendente',
  NO_FUTURE_APPOINTMENT = 'Sem Agendamento Futuro',
  DEFAULTER = 'Inadimplente',
  LOST_PATIENT = 'Paciente Perdido',
  RECOVERED_PATIENT = 'Paciente Recuperado',
  JOURNEY_COMPLETE = 'Jornada Concluída'
}

export enum PriorityLevel {
  CRITICAL = '🔴 Crítico',
  HIGH = '🟠 Alto',
  MEDIUM = '🟡 Médio',
  LOW = '🟢 Baixo'
}

export class PatientStatus {
  id: string;
  patientId: string;
  currentStage: JourneyStage;
  subStage?: string;
  isDuplicate: boolean;
  hasConflicts: boolean;
  priorityLevel: PriorityLevel;
  lastContactDate?: Date;
  daysWithoutContact: number;
  statusChangedAt: Date;
  updatedAt: Date;

  constructor(
    id: string,
    patientId: string,
    currentStage: JourneyStage = JourneyStage.NEW_LEAD
  ) {
    this.id = id;
    this.patientId = patientId;
    this.currentStage = currentStage;
    this.isDuplicate = false;
    this.hasConflicts = false;
    this.priorityLevel = PriorityLevel.MEDIUM;
    this.daysWithoutContact = -1;
    this.statusChangedAt = new Date();
    this.updatedAt = new Date();
  }

  static create(patientId: string): PatientStatus {
    const id = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return new PatientStatus(id, patientId);
  }

  changeStage(newStage: JourneyStage, subStage?: string): void {
    this.currentStage = newStage;
    this.subStage = subStage;
    this.statusChangedAt = new Date();
    this.updatedAt = new Date();
  }

  markAsDuplicate(): void {
    this.isDuplicate = true;
    this.priorityLevel = PriorityLevel.HIGH;
    this.updatedAt = new Date();
  }

  markWithConflicts(): void {
    this.hasConflicts = true;
    this.priorityLevel = PriorityLevel.HIGH;
    this.updatedAt = new Date();
  }

  recordContact(date: Date = new Date()): void {
    this.lastContactDate = date;
    this.daysWithoutContact = 0;
    this.updatedAt = new Date();
  }

  updateDaysWithoutContact(): void {
    if (!this.lastContactDate) {
      this.daysWithoutContact = -1;
      return;
    }

    const now = new Date();
    const diff = now.getTime() - this.lastContactDate.getTime();
    this.daysWithoutContact = Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  calculatePriority(): void {
    if (this.currentStage === JourneyStage.DEFAULTER) {
      this.priorityLevel = PriorityLevel.CRITICAL;
    } else if (this.currentStage === JourneyStage.LOST_PATIENT ||
               this.daysWithoutContact > 30 ||
               this.isDuplicate) {
      this.priorityLevel = PriorityLevel.HIGH;
    } else if (this.hasConflicts ||
               this.currentStage === JourneyStage.PENDING_BUDGET ||
               this.daysWithoutContact > 14) {
      this.priorityLevel = PriorityLevel.MEDIUM;
    } else {
      this.priorityLevel = PriorityLevel.LOW;
    }
  }

  getStageDuration(): number {
    const now = new Date();
    const diff = now.getTime() - this.statusChangedAt.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}
