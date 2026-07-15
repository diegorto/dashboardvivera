/**
 * Serviço de Governança de Dados
 * Camada de aplicação que expõe funcionalidades de auditoria, conformidade e jornada
 */

import { RepositoryFactory } from '../../infrastructure/factories/RepositoryFactory';

export interface AuditDashboardKPIs {
  totalRecordsAnalyzed: number;
  newRecords: number;
  modifiedRecords: number;
  deletedRecords: number;
  conflictsFound: number;
  possibleDuplicates: number;
  pendingApprovals: number;
  approvedChanges: number;
  rejectedChanges: number;
  executedSyncs: number;
  failedSyncs: number;
  avgSyncTime: number;
  connectedSources: number;
  dataIntegrity: number;
  approvalRate: number;
}

export interface PatientJourneyDTO {
  patientId: string;
  currentStage: string;
  priority: string;
  isDuplicate: boolean;
  hasConflicts: boolean;
  lastContactDays: number;
  totalEvents: number;
  stageDuration: number;
  recentEvents: any[];
}

export interface ConflictDTO {
  id: string;
  entityType: string;
  fieldName: string;
  source1: string;
  value1: string;
  source2: string;
  value2: string;
  severity: string;
  suggestion: string;
  status: string;
}

export interface ApprovalItemDTO {
  id: string;
  auditItemId: string;
  priority: string;
  status: string;
  createdAt: Date;
  daysWaiting: number;
  isOverdue: boolean;
}

export class GovernanceService {
  private factory = RepositoryFactory.getInstance();

  // ============ DASHBOARD DE AUDITORIA ============

  async getAuditDashboardKPIs(): Promise<AuditDashboardKPIs> {
    const auditItemRepo = this.factory.createAuditItemRepository();
    const auditBatchRepo = this.factory.createAuditBatchRepository();
    const conflictRepo = this.factory.createDataConflictRepository();
    const approvalRepo = this.factory.createApprovalQueueRepository();

    const allItems = await auditItemRepo.findAll();
    const allBatches = await auditBatchRepo.findAll();
    const pendingApprovals = await approvalRepo.findPending();
    const allConflicts = await conflictRepo.findAll();

    // Calcular estatísticas
    const pendingItems = allItems.filter(i => i.status === 'pending');
    const approvedItems = allItems.filter(i => i.status === 'approved');
    const rejectedItems = allItems.filter(i => i.status === 'rejected');

    const createdItems = allItems.filter(i => i.changeType === 'created');
    const updatedItems = allItems.filter(i => i.changeType === 'updated');
    const deletedItems = allItems.filter(i => i.changeType === 'deleted');

    const totalRecords = createdItems.length + updatedItems.length + deletedItems.length;

    return {
      totalRecordsAnalyzed: totalRecords,
      newRecords: createdItems.length,
      modifiedRecords: updatedItems.length,
      deletedRecords: deletedItems.length,
      conflictsFound: allConflicts.length,
      possibleDuplicates: allConflicts.filter(c => c.conflictType === 'mismatch').length,
      pendingApprovals: pendingItems.length,
      approvedChanges: approvedItems.length,
      rejectedChanges: rejectedItems.length,
      executedSyncs: allBatches.filter(b => b.status === 'finalized').length,
      failedSyncs: 0, // Seria calculado a partir de logs
      avgSyncTime: 180, // ms, mockado por enquanto
      connectedSources: 3,
      dataIntegrity: 95,
      approvalRate: totalRecords > 0 ? (approvedItems.length / totalRecords) * 100 : 0
    };
  }

  // ============ JORNADA DO PACIENTE ============

  async getPatientJourney(patientId: string): Promise<PatientJourneyDTO | null> {
    const statusRepo = this.factory.createPatientStatusRepository();
    const timelineRepo = this.factory.createPatientTimelineRepository();

    const status = await statusRepo.findByPatientId(patientId);
    if (!status) return null;

    const events = await timelineRepo.findByPatientId(patientId);
    const recentEvents = events.slice(0, 5);

    return {
      patientId: status.patientId,
      currentStage: status.currentStage,
      priority: status.priorityLevel,
      isDuplicate: status.isDuplicate,
      hasConflicts: status.hasConflicts,
      lastContactDays: status.daysWithoutContact,
      totalEvents: events.length,
      stageDuration: status.getStageDuration(),
      recentEvents: recentEvents.map(e => ({
        type: e.eventType,
        date: e.eventDate,
        description: e.description
      }))
    };
  }

  async listPatientsByStage(stage: string): Promise<PatientJourneyDTO[]> {
    const statusRepo = this.factory.createPatientStatusRepository();
    const timelineRepo = this.factory.createPatientTimelineRepository();

    const statuses = await statusRepo.findByStage(stage);

    const journeys: PatientJourneyDTO[] = [];
    for (const status of statuses) {
      const events = await timelineRepo.findByPatientId(status.patientId);
      journeys.push({
        patientId: status.patientId,
        currentStage: status.currentStage,
        priority: status.priorityLevel,
        isDuplicate: status.isDuplicate,
        hasConflicts: status.hasConflicts,
        lastContactDays: status.daysWithoutContact,
        totalEvents: events.length,
        stageDuration: status.getStageDuration(),
        recentEvents: []
      });
    }

    return journeys;
  }

  async getHighPriorityPatients(limit: number = 10): Promise<PatientJourneyDTO[]> {
    const statusRepo = this.factory.createPatientStatusRepository();
    const timelineRepo = this.factory.createPatientTimelineRepository();

    const allStatuses = await statusRepo.findAll();

    // Ordenar por prioridade (CRITICAL > HIGH > MEDIUM > LOW)
    const priorityOrder = { '🔴 Crítico': 0, '🟠 Alto': 1, '🟡 Médio': 2, '🟢 Baixo': 3 };
    const sorted = allStatuses.sort((a, b) =>
      priorityOrder[a.priorityLevel] - priorityOrder[b.priorityLevel]
    );

    const journeys: PatientJourneyDTO[] = [];
    for (const status of sorted.slice(0, limit)) {
      const events = await timelineRepo.findByPatientId(status.patientId);
      journeys.push({
        patientId: status.patientId,
        currentStage: status.currentStage,
        priority: status.priorityLevel,
        isDuplicate: status.isDuplicate,
        hasConflicts: status.hasConflicts,
        lastContactDays: status.daysWithoutContact,
        totalEvents: events.length,
        stageDuration: status.getStageDuration(),
        recentEvents: []
      });
    }

    return journeys;
  }

  // ============ CONFLITOS ============

  async getUnresolvedConflicts(): Promise<ConflictDTO[]> {
    const conflictRepo = this.factory.createDataConflictRepository();
    const conflicts = await conflictRepo.findUnresolved();

    return conflicts.map(c => ({
      id: c.id,
      entityType: c.entityType,
      fieldName: c.fieldName,
      source1: c.source1Id,
      value1: c.source1Value,
      source2: c.source2Id,
      value2: c.source2Value,
      severity: c.getSeverity(),
      suggestion: c.getSuggestion(),
      status: c.resolutionStatus
    }));
  }

  async resolveConflict(conflictId: string, resolutionValue: string): Promise<void> {
    const conflictRepo = this.factory.createDataConflictRepository();
    const conflict = await conflictRepo.findById(conflictId);

    if (!conflict) throw new Error('Conflict not found');

    conflict.approve(resolutionValue);
    await conflictRepo.update(conflictId, conflict);
  }

  // ============ APROVAÇÕES ============

  async getPendingApprovals(): Promise<ApprovalItemDTO[]> {
    const approvalRepo = this.factory.createApprovalQueueRepository();
    const pending = await approvalRepo.findPending();

    return pending.map(a => ({
      id: a.id,
      auditItemId: a.auditItemId,
      priority: a.priority,
      status: a.status,
      createdAt: a.createdAt,
      daysWaiting: a.getDaysWaiting(),
      isOverdue: a.isOverdue()
    }));
  }

  async approveItem(approvalId: string, userId: string): Promise<void> {
    const approvalRepo = this.factory.createApprovalQueueRepository();
    const approval = await approvalRepo.findById(approvalId);

    if (!approval) throw new Error('Approval not found');

    approval.approve(userId);
    await approvalRepo.update(approvalId, approval);
  }

  async rejectItem(approvalId: string, userId: string): Promise<void> {
    const approvalRepo = this.factory.createApprovalQueueRepository();
    const approval = await approvalRepo.findById(approvalId);

    if (!approval) throw new Error('Approval not found');

    approval.reject(userId);
    await approvalRepo.update(approvalId, approval);
  }

  // ============ ESTATÍSTICAS ============

  async getAuditStats(days: number = 30) {
    const auditBatchRepo = this.factory.createAuditBatchRepository();
    const batches = await auditBatchRepo.findRecent(days);

    return {
      totalBatches: batches.length,
      totalChanges: batches.reduce((sum, b) => sum + b.totalChanges, 0),
      avgChangesPerBatch: batches.length > 0
        ? batches.reduce((sum, b) => sum + b.totalChanges, 0) / batches.length
        : 0,
      approvalRate: this.calculateAggregateApprovalRate(batches),
      conflictRate: this.calculateConflictRate(batches),
      batchesByStatus: {
        pending: batches.filter(b => b.status === 'pending').length,
        processing: batches.filter(b => b.status === 'processing').length,
        finalized: batches.filter(b => b.status === 'finalized').length
      }
    };
  }

  private calculateAggregateApprovalRate(batches: any[]): number {
    const totalChanges = batches.reduce((sum, b) => sum + b.totalChanges, 0);
    const totalApproved = batches.reduce((sum, b) => sum + b.approvedChanges, 0);

    if (totalChanges === 0) return 0;
    return (totalApproved / totalChanges) * 100;
  }

  private calculateConflictRate(batches: any[]): number {
    const totalChanges = batches.reduce((sum, b) => sum + b.totalChanges, 0);
    const totalConflicts = batches.reduce((sum, b) => sum + b.conflictsFound, 0);

    if (totalChanges === 0) return 0;
    return (totalConflicts / totalChanges) * 100;
  }
}

export const governanceService = new GovernanceService();
