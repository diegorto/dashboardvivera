/**
 * Entidade: Fila de Aprovação
 * Gerencia itens pendentes de revisão por usuário administrador
 */

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export enum ApprovAlPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export class ApprovalQueue {
  id: string;
  auditItemId: string;
  status: ApprovalStatus;
  priority: ApprovAlPriority;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewComment?: string;

  constructor(
    id: string,
    auditItemId: string,
    priority: ApprovAlPriority = ApprovAlPriority.MEDIUM
  ) {
    this.id = id;
    this.auditItemId = auditItemId;
    this.status = ApprovalStatus.PENDING;
    this.priority = priority;
    this.createdAt = new Date();
  }

  static create(
    auditItemId: string,
    priority?: ApprovAlPriority
  ): ApprovalQueue {
    const id = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return new ApprovalQueue(id, auditItemId, priority);
  }

  approve(reviewedBy: string, comment?: string): void {
    this.status = ApprovalStatus.APPROVED;
    this.reviewedBy = reviewedBy;
    this.reviewComment = comment;
    this.reviewedAt = new Date();
  }

  reject(reviewedBy: string, comment?: string): void {
    this.status = ApprovalStatus.REJECTED;
    this.reviewedBy = reviewedBy;
    this.reviewComment = comment;
    this.reviewedAt = new Date();
  }

  isPending(): boolean {
    return this.status === ApprovalStatus.PENDING;
  }

  getDaysWaiting(): number {
    const now = new Date();
    const diff = now.getTime() - this.createdAt.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  isOverdue(): boolean {
    // Considerado atrasado se está pendente há mais de 7 dias
    return this.isPending() && this.getDaysWaiting() > 7;
  }
}
