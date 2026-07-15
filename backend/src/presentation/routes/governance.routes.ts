/**
 * Rotas da Camada de Governança de Dados
 * Endpoints para Auditoria, Jornada, Conflitos e Aprovações
 *
 * Padrão: GET /api/governance/*
 */

import { Router, Request, Response } from 'express';
import { governanceService } from '../../application/services/GovernanceService';

const router = Router();

// ============ DASHBOARD DE AUDITORIA ============

/**
 * GET /api/governance/audit/kpis
 * Retorna KPIs agregados do dashboard de auditoria
 */
router.get('/audit/kpis', async (req: Request, res: Response) => {
  try {
    const kpis = await governanceService.getAuditDashboardKPIs();
    res.json({
      success: true,
      data: kpis,
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/governance/audit/stats?days=30
 * Retorna estatísticas de auditoria para período
 */
router.get('/audit/stats', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = await governanceService.getAuditStats(days);

    res.json({
      success: true,
      data: stats,
      period: { days },
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ JORNADA DO PACIENTE ============

/**
 * GET /api/governance/patient-journey/:patientId
 * Retorna jornada completa de um paciente
 */
router.get('/patient-journey/:patientId', async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const journey = await governanceService.getPatientJourney(patientId);

    if (!journey) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    res.json({
      success: true,
      data: journey,
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/governance/patient-journey/stage/:stage
 * Lista pacientes em um estágio específico da jornada
 */
router.get('/patient-journey/stage/:stage', async (req: Request, res: Response) => {
  try {
    const { stage } = req.params;
    const patients = await governanceService.listPatientsByStage(stage);

    res.json({
      success: true,
      data: patients,
      count: patients.length,
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/governance/patient-journey/priority-high
 * Lista pacientes com alta prioridade
 */
router.get('/patient-journey/priority-high', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const patients = await governanceService.getHighPriorityPatients(limit);

    res.json({
      success: true,
      data: patients,
      count: patients.length,
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ CONFLITOS ============

/**
 * GET /api/governance/conflicts/unresolved
 * Lista todos os conflitos não resolvidos
 */
router.get('/conflicts/unresolved', async (req: Request, res: Response) => {
  try {
    const conflicts = await governanceService.getUnresolvedConflicts();

    res.json({
      success: true,
      data: conflicts,
      count: conflicts.length,
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/governance/conflicts/:conflictId/resolve
 * Resolve um conflito com valor sugerido
 */
router.post('/conflicts/:conflictId/resolve', async (req: Request, res: Response) => {
  try {
    const { conflictId } = req.params;
    const { resolutionValue } = req.body;

    if (!resolutionValue) {
      return res.status(400).json({
        success: false,
        error: 'resolutionValue is required'
      });
    }

    await governanceService.resolveConflict(conflictId, resolutionValue);

    res.json({
      success: true,
      message: 'Conflict resolved',
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ FILA DE APROVAÇÃO ============

/**
 * GET /api/governance/approvals/pending
 * Lista itens pendentes de aprovação
 */
router.get('/approvals/pending', async (req: Request, res: Response) => {
  try {
    const approvals = await governanceService.getPendingApprovals();

    res.json({
      success: true,
      data: approvals,
      count: approvals.length,
      overdue: approvals.filter(a => a.isOverdue).length,
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/governance/approvals/:approvalId/approve
 * Aprova um item da fila
 */
router.post('/approvals/:approvalId/approve', async (req: Request, res: Response) => {
  try {
    const { approvalId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    await governanceService.approveItem(approvalId, userId);

    res.json({
      success: true,
      message: 'Item approved',
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/governance/approvals/:approvalId/reject
 * Rejeita um item da fila
 */
router.post('/approvals/:approvalId/reject', async (req: Request, res: Response) => {
  try {
    const { approvalId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    await governanceService.rejectItem(approvalId, userId);

    res.json({
      success: true,
      message: 'Item rejected',
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ HEALTH CHECK ============

/**
 * GET /api/governance/health
 * Verifica se o serviço de governança está disponível
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'Governance service is running',
    timestamp: new Date()
  });
});

export default router;
