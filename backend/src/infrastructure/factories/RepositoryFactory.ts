/**
 * Factory de Repositórios
 * Centraliza a criação de repositórios
 * Permite fácil troca entre Mock e implementações reais
 */

import { IRepositoryFactory } from '../../domain/contracts/IRepository';
import { MockAuditBatchRepository, MockAuditItemRepository } from '../repositories/MockAuditRepository';
import { MockPatientStatusRepository, MockPatientTimelineRepository } from '../repositories/MockPatientRepository';
import { MockDataConflictRepository, MockApprovalQueueRepository } from '../repositories/MockConflictAndApprovalRepository';

/**
 * Estratégia padrão: usar Mock Repositories
 * Quando pronto para integração real, criar TypeORMRepositoryFactory que estenda esta classe
 */
export class RepositoryFactory implements IRepositoryFactory {
  private static instance: RepositoryFactory;

  // Singleton para cache de repositórios
  private auditBatchRepo: MockAuditBatchRepository | null = null;
  private auditItemRepo: MockAuditItemRepository | null = null;
  private patientStatusRepo: MockPatientStatusRepository | null = null;
  private patientTimelineRepo: MockPatientTimelineRepository | null = null;
  private dataConflictRepo: MockDataConflictRepository | null = null;
  private approvalQueueRepo: MockApprovalQueueRepository | null = null;

  private constructor() {}

  static getInstance(): RepositoryFactory {
    if (!RepositoryFactory.instance) {
      RepositoryFactory.instance = new RepositoryFactory();
    }
    return RepositoryFactory.instance;
  }

  createAuditBatchRepository() {
    if (!this.auditBatchRepo) {
      this.auditBatchRepo = new MockAuditBatchRepository();
    }
    return this.auditBatchRepo;
  }

  createAuditItemRepository() {
    if (!this.auditItemRepo) {
      this.auditItemRepo = new MockAuditItemRepository();
    }
    return this.auditItemRepo;
  }

  createPatientStatusRepository() {
    if (!this.patientStatusRepo) {
      this.patientStatusRepo = new MockPatientStatusRepository();
    }
    return this.patientStatusRepo;
  }

  createPatientTimelineRepository() {
    if (!this.patientTimelineRepo) {
      this.patientTimelineRepo = new MockPatientTimelineRepository();
    }
    return this.patientTimelineRepo;
  }

  createDataConflictRepository() {
    if (!this.dataConflictRepo) {
      this.dataConflictRepo = new MockDataConflictRepository();
    }
    return this.dataConflictRepo;
  }

  createApprovalQueueRepository() {
    if (!this.approvalQueueRepo) {
      this.approvalQueueRepo = new MockApprovalQueueRepository();
    }
    return this.approvalQueueRepo;
  }

  /**
   * Resetar todos os repositórios (útil para testes)
   */
  reset(): void {
    this.auditBatchRepo = null;
    this.auditItemRepo = null;
    this.patientStatusRepo = null;
    this.patientTimelineRepo = null;
    this.dataConflictRepo = null;
    this.approvalQueueRepo = null;
  }
}

/**
 * Factory Alternativo: Não usar Singleton (para cada request)
 * Útil para testes e desenvolvimento
 */
export class FreshRepositoryFactory implements IRepositoryFactory {
  createAuditBatchRepository() {
    return new MockAuditBatchRepository();
  }

  createAuditItemRepository() {
    return new MockAuditItemRepository();
  }

  createPatientStatusRepository() {
    return new MockPatientStatusRepository();
  }

  createPatientTimelineRepository() {
    return new MockPatientTimelineRepository();
  }

  createDataConflictRepository() {
    return new MockDataConflictRepository();
  }

  createApprovalQueueRepository() {
    return new MockApprovalQueueRepository();
  }
}
