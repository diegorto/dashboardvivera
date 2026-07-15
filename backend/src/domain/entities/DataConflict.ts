/**
 * Entidade: Conflito de Dados
 * Representa divergências encontradas entre fontes de dados
 */

export enum ConflictType {
  MISMATCH = 'mismatch',              // Valores diferentes
  MISSING_IN_ONE = 'missing_in_one',  // Campo ausente em uma fonte
  INCONSISTENT_FORMAT = 'inconsistent_format'  // Formatos diferentes
}

export enum ResolutionStatus {
  UNRESOLVED = 'unresolved',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  AUTO_RESOLVED = 'auto_resolved'
}

export class DataConflict {
  id: string;
  entityType: string;  // "patient", "appointment", etc
  entityId: string;
  fieldName: string;
  source1Id: string;
  source1Value: string;
  source2Id: string;
  source2Value: string;
  confidenceScore: number;  // 0.00 a 1.00
  conflictType: ConflictType;
  resolutionStatus: ResolutionStatus;
  resolutionValue?: string;
  createdAt: Date;
  resolvedAt?: Date;

  constructor(
    id: string,
    entityType: string,
    entityId: string,
    fieldName: string,
    source1Id: string,
    source1Value: string,
    source2Id: string,
    source2Value: string,
    conflictType: ConflictType
  ) {
    this.id = id;
    this.entityType = entityType;
    this.entityId = entityId;
    this.fieldName = fieldName;
    this.source1Id = source1Id;
    this.source1Value = source1Value;
    this.source2Id = source2Id;
    this.source2Value = source2Value;
    this.conflictType = conflictType;
    this.confidenceScore = 0.85;
    this.resolutionStatus = ResolutionStatus.UNRESOLVED;
    this.createdAt = new Date();
  }

  static create(
    entityType: string,
    entityId: string,
    fieldName: string,
    source1Id: string,
    source1Value: string,
    source2Id: string,
    source2Value: string,
    conflictType: ConflictType
  ): DataConflict {
    const id = `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return new DataConflict(
      id,
      entityType,
      entityId,
      fieldName,
      source1Id,
      source1Value,
      source2Id,
      source2Value,
      conflictType
    );
  }

  approve(value?: string): void {
    this.resolutionStatus = ResolutionStatus.APPROVED;
    this.resolutionValue = value || this.source1Value;
    this.resolvedAt = new Date();
  }

  reject(): void {
    this.resolutionStatus = ResolutionStatus.REJECTED;
    this.resolutionValue = undefined;
    this.resolvedAt = new Date();
  }

  autoResolve(value: string): void {
    this.resolutionStatus = ResolutionStatus.AUTO_RESOLVED;
    this.resolutionValue = value;
    this.resolvedAt = new Date();
  }

  getSeverity(): 'high' | 'medium' | 'low' {
    if (this.conflictType === ConflictType.MISMATCH) {
      // Se os valores são completamente diferentes
      if (this.source1Value !== this.source2Value) {
        return 'high';
      }
    }
    if (this.conflictType === ConflictType.MISSING_IN_ONE) {
      return 'medium';
    }
    return 'low';
  }

  getSuggestion(): string {
    if (this.conflictType === ConflictType.MISMATCH) {
      return `Valores diferem: "${this.source1Value}" vs "${this.source2Value}"`;
    }
    if (this.conflictType === ConflictType.MISSING_IN_ONE) {
      const missingSource = this.source1Value ? this.source2Id : this.source1Id;
      return `Campo ausente em ${missingSource}`;
    }
    return `Formatos inconsistentes em ${this.fieldName}`;
  }

  isResolved(): boolean {
    return this.resolutionStatus !== ResolutionStatus.UNRESOLVED;
  }
}
