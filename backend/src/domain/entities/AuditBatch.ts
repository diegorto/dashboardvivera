/**
 * Entidade: Lote de Auditoria
 * Agrupa mudanças de dados auditadas em um período (geralmente 1 dia)
 */

export class AuditBatch {
  id: string;
  batchDate: Date;
  status: 'pending' | 'processing' | 'finalized';
  totalChanges: number;
  approvedChanges: number;
  rejectedChanges: number;
  conflictsFound: number;
  createdBy?: string;
  createdAt: Date;
  finalizedAt?: Date;

  constructor(
    id: string,
    batchDate: Date
  ) {
    this.id = id;
    this.batchDate = batchDate;
    this.status = 'pending';
    this.totalChanges = 0;
    this.approvedChanges = 0;
    this.rejectedChanges = 0;
    this.conflictsFound = 0;
    this.createdAt = new Date();
  }

  static create(batchDate: Date = new Date()): AuditBatch {
    const id = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return new AuditBatch(id, batchDate);
  }

  addChange(): void {
    this.totalChanges++;
  }

  approveChange(): void {
    this.approvedChanges++;
  }

  rejectChange(): void {
    this.rejectedChanges++;
  }

  addConflict(): void {
    this.conflictsFound++;
  }

  process(): void {
    this.status = 'processing';
  }

  finalize(): void {
    this.status = 'finalized';
    this.finalizedAt = new Date();
  }

  getApprovalRate(): number {
    if (this.totalChanges === 0) return 0;
    return (this.approvedChanges / this.totalChanges) * 100;
  }
}
