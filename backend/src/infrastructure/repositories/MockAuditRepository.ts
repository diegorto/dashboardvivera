/**
 * Mock Repository para Auditoria
 * Fornece dados simulados para desenvolvimento
 * Será substituído por implementação real com banco de dados
 */

import { IAuditBatchRepository, IAuditItemRepository } from '../../domain/contracts/IRepository';
import { AuditBatch } from '../../domain/entities/AuditBatch';
import { AuditItem, ChangeType, AuditStatus, ImpactLevel } from '../../domain/entities/AuditItem';

export class MockAuditBatchRepository implements IAuditBatchRepository {
  private batches: Map<string, AuditBatch> = new Map();

  constructor() {
    this.seedMockData();
  }

  private seedMockData(): void {
    // Criar 5 lotes de exemplo
    for (let i = 0; i < 5; i++) {
      const batch = AuditBatch.create(
        new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      );
      batch.totalChanges = Math.floor(Math.random() * 100) + 10;
      batch.approvedChanges = Math.floor(batch.totalChanges * 0.7);
      batch.rejectedChanges = Math.floor(batch.totalChanges * 0.1);
      batch.conflictsFound = Math.floor(Math.random() * 10);

      if (i === 0) {
        batch.status = 'processing';
      } else {
        batch.status = 'finalized';
        batch.finalizedAt = new Date(Date.now() - (i - 1) * 24 * 60 * 60 * 1000);
      }

      this.batches.set(batch.id, batch);
    }
  }

  async create(entity: AuditBatch): Promise<AuditBatch> {
    this.batches.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<AuditBatch | null> {
    return this.batches.get(id) || null;
  }

  async findAll(): Promise<AuditBatch[]> {
    return Array.from(this.batches.values()).sort((a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async update(id: string, entity: Partial<AuditBatch>): Promise<AuditBatch> {
    const existing = this.batches.get(id);
    if (!existing) throw new Error('Batch not found');

    const updated = { ...existing, ...entity, id };
    this.batches.set(id, updated as AuditBatch);
    return updated as AuditBatch;
  }

  async delete(id: string): Promise<boolean> {
    return this.batches.delete(id);
  }

  async count(): Promise<number> {
    return this.batches.size;
  }

  async exists(id: string): Promise<boolean> {
    return this.batches.has(id);
  }

  async findByDate(date: Date): Promise<AuditBatch | null> {
    const dateStr = date.toISOString().slice(0, 10);
    for (const batch of this.batches.values()) {
      const batchDateStr = batch.batchDate.toISOString().slice(0, 10);
      if (batchDateStr === dateStr) {
        return batch;
      }
    }
    return null;
  }

  async findRecent(days: number): Promise<AuditBatch[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return Array.from(this.batches.values())
      .filter(batch => batch.createdAt >= cutoff)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findPending(): Promise<AuditBatch[]> {
    return Array.from(this.batches.values())
      .filter(batch => batch.status === 'pending' || batch.status === 'processing');
  }
}

export class MockAuditItemRepository implements IAuditItemRepository {
  private items: Map<string, AuditItem> = new Map();

  constructor() {
    this.seedMockData();
  }

  private seedMockData(): void {
    const entityTypes = ['patient', 'appointment', 'deal', 'activity'];
    const changeTypes = [ChangeType.CREATED, ChangeType.UPDATED, ChangeType.DELETED];
    const sources = ['src_pipedrive', 'src_clairis', 'src_whatsapp'];

    // Criar 50 itens de auditoria de exemplo
    for (let i = 0; i < 50; i++) {
      const item = AuditItem.create(
        `batch_${Math.floor(i / 10)}`,
        entityTypes[Math.floor(Math.random() * entityTypes.length)],
        `entity_${i}`,
        changeTypes[Math.floor(Math.random() * changeTypes.length)],
        sources[Math.floor(Math.random() * sources.length)]
      );

      item.recordChange(
        `old_value_${i}`,
        `new_value_${i}`,
        `field_${Math.floor(Math.random() * 5)}`
      );

      // 70% pendente, 20% aprovado, 10% rejeitado
      const rand = Math.random();
      if (rand < 0.7) {
        item.status = AuditStatus.PENDING;
      } else if (rand < 0.9) {
        item.status = AuditStatus.APPROVED;
        item.approve(`user_${Math.floor(Math.random() * 5)}`);
      } else {
        item.status = AuditStatus.REJECTED;
        item.reject(`user_${Math.floor(Math.random() * 5)}`);
      }

      // Definir nível de impacto aleatório
      const impactRand = Math.random();
      if (impactRand < 0.05) {
        item.setImpactLevel(ImpactLevel.CRITICAL);
      } else if (impactRand < 0.15) {
        item.setImpactLevel(ImpactLevel.HIGH);
      } else if (impactRand < 0.5) {
        item.setImpactLevel(ImpactLevel.MEDIUM);
      } else {
        item.setImpactLevel(ImpactLevel.LOW);
      }

      this.items.set(item.id, item);
    }
  }

  async create(entity: AuditItem): Promise<AuditItem> {
    this.items.set(entity.id, entity);
    return entity;
  }

  async findById(id: string): Promise<AuditItem | null> {
    return this.items.get(id) || null;
  }

  async findAll(): Promise<AuditItem[]> {
    return Array.from(this.items.values());
  }

  async update(id: string, entity: Partial<AuditItem>): Promise<AuditItem> {
    const existing = this.items.get(id);
    if (!existing) throw new Error('Item not found');

    const updated = { ...existing, ...entity, id };
    this.items.set(id, updated as AuditItem);
    return updated as AuditItem;
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  async count(): Promise<number> {
    return this.items.size;
  }

  async exists(id: string): Promise<boolean> {
    return this.items.has(id);
  }

  async findByBatchId(batchId: string): Promise<AuditItem[]> {
    return Array.from(this.items.values())
      .filter(item => item.batchId === batchId);
  }

  async findPending(): Promise<AuditItem[]> {
    return Array.from(this.items.values())
      .filter(item => item.status === AuditStatus.PENDING);
  }

  async findByEntityType(entityType: string): Promise<AuditItem[]> {
    return Array.from(this.items.values())
      .filter(item => item.entityType === entityType);
  }

  async findByStatus(status: string): Promise<AuditItem[]> {
    return Array.from(this.items.values())
      .filter(item => item.status === status);
  }

  async countByStatus(status: string): Promise<number> {
    return Array.from(this.items.values())
      .filter(item => item.status === status).length;
  }
}
