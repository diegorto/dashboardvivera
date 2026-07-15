/**
 * Mock Repositories para Conflitos e Aprovações
 */

import {
  IDataConflictRepository,
  IApprovalQueueRepository
} from '../../domain/contracts/IRepository';
import { DataConflict, ConflictType, ResolutionStatus } from '../../domain/entities/DataConflict';
import { ApprovalQueue, ApprovalStatus, ApprovAlPriority } from '../../domain/entities/ApprovalQueue';

export class MockDataConflictRepository implements IDataConflictRepository {
  private conflicts: Map<string, DataConflict> = new Map();

  constructor() {
    this.seedMockData();
  }

  private seedMockData(): void {
    const entityTypes = ['patient', 'appointment', 'deal'];
    const sources = ['src_pipedrive', 'src_clairis', 'src_whatsapp'];
    const fieldNames = ['phone', 'email', 'name', 'cpf', 'birthDate', 'status'];
    const conflictTypes = [ConflictType.MISMATCH, ConflictType.MISSING_IN_ONE, ConflictType.INCONSISTENT_FORMAT];

    // Criar 30 conflitos de exemplo
    for (let i = 0; i < 30; i++) {
      const conflict = DataConflict.create(
        entityTypes[Math.floor(Math.random() * entityTypes.length)],
        `entity_${Math.floor(Math.random() * 100)}`,
        fieldNames[Math.floor(Math.random() * fieldNames.length)],
        sources[0],
        `value_source1_${i}`,
        sources[1],
        `value_source2_${i}`,
        conflictTypes[Math.floor(Math.random() * conflictTypes.length)]
      );

      // 60% não resolvido, 30% aprovado, 10% rejeitado
      const rand = Math.random();
      if (rand < 0.3) {
        conflict.approve(`value_${i}`);
      } else if (rand < 0.4) {
        conflict.reject();
      }

      this.conflicts.set(conflict.id, conflict);
    }
  }

  async create(entity: DataConflict): Promise<DataConflict> {
    this.conflicts.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<DataConflict | null> {
    return this.conflicts.get(id) || null;
  }

  async findAll(): Promise<DataConflict[]> {
    return Array.from(this.conflicts.values());
  }

  async update(id: string, entity: Partial<DataConflict>): Promise<DataConflict> {
    const existing = this.conflicts.get(id);
    if (!existing) throw new Error('Conflict not found');

    const updated = { ...existing, ...entity, id };
    this.conflicts.set(id, updated as DataConflict);
    return updated as DataConflict;
  }

  async delete(id: string): Promise<boolean> {
    return this.conflicts.delete(id);
  }

  async count(): Promise<number> {
    return this.conflicts.size;
  }

  async exists(id: string): Promise<boolean> {
    return this.conflicts.has(id);
  }

  async findUnresolved(): Promise<DataConflict[]> {
    return Array.from(this.conflicts.values())
      .filter(conflict => !conflict.isResolved());
  }

  async findByEntityType(entityType: string): Promise<DataConflict[]> {
    return Array.from(this.conflicts.values())
      .filter(conflict => conflict.entityType === entityType);
  }

  async findBySourcePair(source1Id: string, source2Id: string): Promise<DataConflict[]> {
    return Array.from(this.conflicts.values())
      .filter(conflict =>
        (conflict.source1Id === source1Id && conflict.source2Id === source2Id) ||
        (conflict.source1Id === source2Id && conflict.source2Id === source1Id)
      );
  }

  async countByStatus(status: string): Promise<number> {
    return Array.from(this.conflicts.values())
      .filter(conflict => conflict.resolutionStatus === status).length;
  }
}

export class MockApprovalQueueRepository implements IApprovalQueueRepository {
  private queue: Map<string, ApprovalQueue> = new Map();

  constructor() {
    this.seedMockData();
  }

  private seedMockData(): void {
    const priorities = [ApprovAlPriority.CRITICAL, ApprovAlPriority.HIGH, ApprovAlPriority.MEDIUM, ApprovAlPriority.LOW];

    // Criar 20 itens de aprovação
    for (let i = 0; i < 20; i++) {
      const approval = ApprovalQueue.create(
        `audit_item_${i}`,
        priorities[Math.floor(Math.random() * priorities.length)]
      );

      // 75% pendente, 20% aprovado, 5% rejeitado
      const rand = Math.random();
      if (rand < 0.2) {
        approval.approve(`user_approver_${Math.floor(Math.random() * 5)}`, 'Aprovado automaticamente');
      } else if (rand < 0.25) {
        approval.reject(`user_approver_${Math.floor(Math.random() * 5)}`, 'Informação inconsistente');
      }

      // Definir data de criação realista (alguns dias atrás)
      const daysAgo = Math.floor(Math.random() * 15);
      approval.createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      this.queue.set(approval.id, approval);
    }
  }

  async create(entity: ApprovalQueue): Promise<ApprovalQueue> {
    this.queue.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<ApprovalQueue | null> {
    return this.queue.get(id) || null;
  }

  async findAll(): Promise<ApprovalQueue[]> {
    return Array.from(this.queue.values());
  }

  async update(id: string, entity: Partial<ApprovalQueue>): Promise<ApprovalQueue> {
    const existing = this.queue.get(id);
    if (!existing) throw new Error('Approval not found');

    const updated = { ...existing, ...entity, id };
    this.queue.set(id, updated as ApprovalQueue);
    return updated as ApprovalQueue;
  }

  async delete(id: string): Promise<boolean> {
    return this.queue.delete(id);
  }

  async count(): Promise<number> {
    return this.queue.size;
  }

  async exists(id: string): Promise<boolean> {
    return this.queue.has(id);
  }

  async findPending(): Promise<ApprovalQueue[]> {
    return Array.from(this.queue.values())
      .filter(item => item.status === ApprovalStatus.PENDING)
      .sort((a, b) => {
        // Ordenar por prioridade: HIGH > MEDIUM > LOW
        const priorityOrder: Record<string, number> = {
          [ApprovAlPriority.HIGH]: 0,
          [ApprovAlPriority.MEDIUM]: 1,
          [ApprovAlPriority.LOW]: 2
        };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  async findByPriority(priority: string): Promise<ApprovalQueue[]> {
    return Array.from(this.queue.values())
      .filter(item => item.priority === priority);
  }

  async findOverdue(): Promise<ApprovalQueue[]> {
    return Array.from(this.queue.values())
      .filter(item => item.isOverdue());
  }

  async countPending(): Promise<number> {
    return Array.from(this.queue.values())
      .filter(item => item.status === ApprovalStatus.PENDING).length;
  }
}
