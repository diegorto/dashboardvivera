/**
 * Interfaces base para Repositórios
 * Permite trocar entre implementações Mock, In-Memory, TypeORM, etc
 */

export interface IRepository<T> {
  // CRUD básico
  create(entity: T): Promise<T>;
  findById(id: string): Promise<T | null>;
  findAll(filters?: any): Promise<T[]>;
  update(id: string, entity: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;

  // Utilitários
  count(filters?: any): Promise<number>;
  exists(id: string): Promise<boolean>;
}

/**
 * Repositório de Fontes de Integração
 */
export interface IIntegrationSourceRepository extends IRepository<any> {
  findByName(name: string): Promise<any | null>;
  findByType(type: string): Promise<any[]>;
  findEnabled(): Promise<any[]>;
}

/**
 * Repositório de Lotes de Auditoria
 */
export interface IAuditBatchRepository extends IRepository<any> {
  findByDate(date: Date): Promise<any | null>;
  findRecent(days: number): Promise<any[]>;
  findPending(): Promise<any[]>;
}

/**
 * Repositório de Itens de Auditoria
 */
export interface IAuditItemRepository extends IRepository<any> {
  findByBatchId(batchId: string): Promise<any[]>;
  findPending(): Promise<any[]>;
  findByEntityType(entityType: string): Promise<any[]>;
  findByStatus(status: string): Promise<any[]>;
  countByStatus(status: string): Promise<number>;
}

/**
 * Repositório de Status do Paciente
 */
export interface IPatientStatusRepository extends IRepository<any> {
  findByPatientId(patientId: string): Promise<any | null>;
  findByStage(stage: string): Promise<any[]>;
  findByPriority(priority: string): Promise<any[]>;
  findDuplicates(): Promise<any[]>;
}

/**
 * Repositório de Timeline do Paciente
 */
export interface IPatientTimelineRepository extends IRepository<any> {
  findByPatientId(patientId: string): Promise<any[]>;
  findByEventType(eventType: string): Promise<any[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<any[]>;
  findBySource(sourceId: string): Promise<any[]>;
}

/**
 * Repositório de Conflitos de Dados
 */
export interface IDataConflictRepository extends IRepository<any> {
  findUnresolved(): Promise<any[]>;
  findByEntityType(entityType: string): Promise<any[]>;
  findBySourcePair(source1Id: string, source2Id: string): Promise<any[]>;
  countByStatus(status: string): Promise<number>;
}

/**
 * Repositório de Fila de Aprovação
 */
export interface IApprovalQueueRepository extends IRepository<any> {
  findPending(): Promise<any[]>;
  findByPriority(priority: string): Promise<any[]>;
  findOverdue(): Promise<any[]>;
  countPending(): Promise<number>;
}

/**
 * Factory para criar repositórios
 * Permite trocar implementação facilmente
 */
export interface IRepositoryFactory {
  createIntegrationSourceRepository(): IIntegrationSourceRepository;
  createAuditBatchRepository(): IAuditBatchRepository;
  createAuditItemRepository(): IAuditItemRepository;
  createPatientStatusRepository(): IPatientStatusRepository;
  createPatientTimelineRepository(): IPatientTimelineRepository;
  createDataConflictRepository(): IDataConflictRepository;
  createApprovalQueueRepository(): IApprovalQueueRepository;
}
