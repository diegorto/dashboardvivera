/**
 * Entidade: Item de Auditoria
 * Representa uma mudança individual auditada
 */

export enum ChangeType {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  CONFLICT = 'conflict'
}

export enum AuditStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  IGNORED = 'ignored'
}

export enum ImpactLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export class AuditItem {
  id: string;
  batchId: string;
  entityType: string;  // "patient", "appointment", "deal", etc
  entityId: string;    // ID do registro
  changeType: ChangeType;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  sourceId: string;    // Qual integração causou a mudança
  confidenceScore: number;  // 0.00 a 1.00
  status: AuditStatus;
  impactLevel: ImpactLevel;
  suggestedAction?: string;
  requiresApproval: boolean;
  userResponsible?: string;
  approverId?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    id: string,
    batchId: string,
    entityType: string,
    entityId: string,
    changeType: ChangeType,
    sourceId: string
  ) {
    this.id = id;
    this.batchId = batchId;
    this.entityType = entityType;
    this.entityId = entityId;
    this.changeType = changeType;
    this.sourceId = sourceId;
    this.confidenceScore = 0.95;
    this.status = AuditStatus.PENDING;
    this.impactLevel = ImpactLevel.MEDIUM;
    this.requiresApproval = false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static create(
    batchId: string,
    entityType: string,
    entityId: string,
    changeType: ChangeType,
    sourceId: string
  ): AuditItem {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return new AuditItem(id, batchId, entityType, entityId, changeType, sourceId);
  }

  recordChange(oldValue: string | undefined, newValue: string | undefined, fieldName: string): void {
    this.oldValue = oldValue;
    this.newValue = newValue;
    this.fieldName = fieldName;
  }

  setImpactLevel(level: ImpactLevel): void {
    this.impactLevel = level;
    if (level === ImpactLevel.CRITICAL || level === ImpactLevel.HIGH) {
      this.requiresApproval = true;
    }
  }

  approve(approverId: string, comment?: string): void {
    this.status = AuditStatus.APPROVED;
    this.approverId = approverId;
    this.approvedAt = new Date();
    if (comment) {
      this.suggestedAction = comment;
    }
    this.updatedAt = new Date();
  }

  reject(approverId: string): void {
    this.status = AuditStatus.REJECTED;
    this.approverId = approverId;
    this.approvedAt = new Date();
    this.updatedAt = new Date();
  }

  ignore(): void {
    this.status = AuditStatus.IGNORED;
    this.updatedAt = new Date();
  }

  isPending(): boolean {
    return this.status === AuditStatus.PENDING;
  }

  isApproved(): boolean {
    return this.status === AuditStatus.APPROVED;
  }
}
