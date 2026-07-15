/**
 * Mock Repository para Status e Timeline do Paciente
 * Fornece dados simulados para desenvolvimento
 */

import {
  IPatientStatusRepository,
  IPatientTimelineRepository
} from '../../domain/contracts/IRepository';
import { PatientStatus, JourneyStage, PriorityLevel } from '../../domain/entities/PatientStatus';
import { PatientTimeline, PatientEventType } from '../../domain/entities/PatientTimeline';

export class MockPatientStatusRepository implements IPatientStatusRepository {
  private statuses: Map<string, PatientStatus> = new Map();

  constructor() {
    this.seedMockData();
  }

  private seedMockData(): void {
    const stages = Object.values(JourneyStage);
    const priorities = Object.values(PriorityLevel);

    // Criar 100 pacientes com status variados
    for (let i = 1; i <= 100; i++) {
      const status = PatientStatus.create(`patient_${i}`);
      status.changeStage(
        stages[Math.floor(Math.random() * stages.length)] as JourneyStage
      );

      // 5% com duplicatas
      if (Math.random() < 0.05) {
        status.markAsDuplicate();
      }

      // 10% com conflitos
      if (Math.random() < 0.1) {
        status.markWithConflicts();
      }

      // Definir último contato aleatório
      if (Math.random() < 0.8) {
        const daysAgo = Math.floor(Math.random() * 60);
        status.recordContact(
          new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
        );
        status.updateDaysWithoutContact();
      }

      status.calculatePriority();
      this.statuses.set(status.id, status);
    }
  }

  async create(entity: PatientStatus): Promise<PatientStatus> {
    this.statuses.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<PatientStatus | null> {
    return this.statuses.get(id) || null;
  }

  async findAll(): Promise<PatientStatus[]> {
    return Array.from(this.statuses.values());
  }

  async update(id: string, entity: Partial<PatientStatus>): Promise<PatientStatus> {
    const existing = this.statuses.get(id);
    if (!existing) throw new Error('Status not found');

    const updated = { ...existing, ...entity, id };
    this.statuses.set(id, updated as PatientStatus);
    return updated as PatientStatus;
  }

  async delete(id: string): Promise<boolean> {
    return this.statuses.delete(id);
  }

  async count(): Promise<number> {
    return this.statuses.size;
  }

  async exists(id: string): Promise<boolean> {
    return this.statuses.has(id);
  }

  async findByPatientId(patientId: string): Promise<PatientStatus | null> {
    for (const status of this.statuses.values()) {
      if (status.patientId === patientId) {
        return status;
      }
    }
    return null;
  }

  async findByStage(stage: string): Promise<PatientStatus[]> {
    return Array.from(this.statuses.values())
      .filter(status => status.currentStage === stage);
  }

  async findByPriority(priority: string): Promise<PatientStatus[]> {
    return Array.from(this.statuses.values())
      .filter(status => status.priorityLevel === priority);
  }

  async findDuplicates(): Promise<PatientStatus[]> {
    return Array.from(this.statuses.values())
      .filter(status => status.isDuplicate);
  }
}

export class MockPatientTimelineRepository implements IPatientTimelineRepository {
  private events: Map<string, PatientTimeline> = new Map();

  constructor() {
    this.seedMockData();
  }

  private seedMockData(): void {
    const eventTypes = Object.values(PatientEventType);
    const sources = ['src_pipedrive', 'src_clairis', 'src_whatsapp'];

    // Criar 500 eventos de timeline para 100 pacientes
    for (let p = 1; p <= 100; p++) {
      const numEvents = Math.floor(Math.random() * 7) + 1;

      for (let e = 0; e < numEvents; e++) {
        const event = PatientTimeline.create(
          `patient_${p}`,
          eventTypes[Math.floor(Math.random() * eventTypes.length)] as PatientEventType,
          sources[Math.floor(Math.random() * sources.length)],
          new Date(Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000)
        );

        event.addDescription(`Evento #${e + 1} para paciente ${p}`);
        event.addMetadata('source_record_id', `ext_${Math.random().toString(36).substr(2, 9)}`);

        this.events.set(event.id, event);
      }
    }
  }

  async create(entity: PatientTimeline): Promise<PatientTimeline> {
    this.events.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<PatientTimeline | null> {
    return this.events.get(id) || null;
  }

  async findAll(): Promise<PatientTimeline[]> {
    return Array.from(this.events.values());
  }

  async update(id: string, entity: Partial<PatientTimeline>): Promise<PatientTimeline> {
    const existing = this.events.get(id);
    if (!existing) throw new Error('Timeline not found');

    const updated = { ...existing, ...entity, id };
    this.events.set(id, updated as PatientTimeline);
    return updated as PatientTimeline;
  }

  async delete(id: string): Promise<boolean> {
    return this.events.delete(id);
  }

  async count(): Promise<number> {
    return this.events.size;
  }

  async exists(id: string): Promise<boolean> {
    return this.events.has(id);
  }

  async findByPatientId(patientId: string): Promise<PatientTimeline[]> {
    return Array.from(this.events.values())
      .filter(event => event.patientId === patientId)
      .sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
  }

  async findByEventType(eventType: string): Promise<PatientTimeline[]> {
    return Array.from(this.events.values())
      .filter(event => event.eventType === eventType);
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<PatientTimeline[]> {
    return Array.from(this.events.values())
      .filter(event => event.eventDate >= startDate && event.eventDate <= endDate)
      .sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
  }

  async findBySource(sourceId: string): Promise<PatientTimeline[]> {
    return Array.from(this.events.values())
      .filter(event => event.sourceId === sourceId);
  }
}
