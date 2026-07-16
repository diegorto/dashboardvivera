import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Lazy load all dashboards
const ExecutiveDashboard = React.lazy(() => import('../dashboards/ExecutiveDashboard'));
const MarketingDashboard = React.lazy(() => import('../dashboards/MarketingDashboard'));
const CommercialDashboard = React.lazy(() => import('../dashboards/CommercialDashboard'));
const CRMDashboard = React.lazy(() => import('../dashboards/CRMDashboard'));
const AgendaDashboard = React.lazy(() => import('../dashboards/AgendaDashboard'));
const CampaignsDashboard = React.lazy(() => import('../dashboards/CampaignsDashboard'));
const ConjuntosDashboard = React.lazy(() => import('../dashboards/ConjuntosDashboard'));
const CreativosDashboard = React.lazy(() => import('../dashboards/CreativosDashboard'));
const CreativeDetailPage = React.lazy(() => import('../dashboards/CreativeDetailPage'));
const PatientsDashboard = React.lazy(() => import('../dashboards/PatientsDashboard'));
const PatientProfilePage = React.lazy(() => import('../dashboards/PatientProfilePage'));
const PatientJourneyPage = React.lazy(() => import('../dashboards/PatientJourneyPage'));
const PipelineDashboard = React.lazy(() => import('../dashboards/PipelineDashboard'));
const ObjectionsDashboard = React.lazy(() => import('../dashboards/ObjectionsDashboard'));
const ProceduresDashboard = React.lazy(() => import('../dashboards/ProceduresDashboard'));
const ProfessionalsDashboard = React.lazy(() => import('../dashboards/ProfessionalsDashboard'));
const SDRsDashboard = React.lazy(() => import('../dashboards/SDRsDashboard'));
const ReceptionDashboard = React.lazy(() => import('../dashboards/ReceptionDashboard'));
const WhatsAppDashboard = React.lazy(() => import('../dashboards/WhatsAppDashboard'));
const FinancialDashboard = React.lazy(() => import('../dashboards/FinancialDashboard'));
const GoalsDashboard = React.lazy(() => import('../dashboards/GoalsDashboard'));
const AlertsDashboard = React.lazy(() => import('../dashboards/AlertsDashboard'));
const AIExecutiveDashboard = React.lazy(() => import('../dashboards/AIExecutiveDashboard'));
const SettingsDashboard = React.lazy(() => import('../dashboards/SettingsDashboard'));
const MeetingModePage = React.lazy(() => import('../dashboards/MeetingModePage'));
const ReportsDashboard = React.lazy(() => import('../dashboards/ReportsDashboard'));
const AuditDashboard = React.lazy(() => import('../dashboards/AuditDashboard'));
const ComparativesDashboard = React.lazy(() => import('../dashboards/ComparativesDashboard'));
const SearchPage = React.lazy(() => import('../dashboards/SearchPage'));
const UserProfilePage = React.lazy(() => import('../dashboards/UserProfilePage'));
const GoogleAdsDashboard = React.lazy(() => import('../dashboards/GoogleAdsDashboard'));

// Loading component
const LoadingFallback = () => (
  <div style={{ padding: '32px', textAlign: 'center' }}>
    <p>Carregando...</p>
  </div>
);

export interface Route {
  id: string;
  label: string;
  path: string;
  icon: string;
  component: React.ComponentType;
  category?: 'main' | 'detail';
}

export const routes: Route[] = [
  // Main dashboards (15 items)
  { id: 'executive', label: 'Executive', path: '/', icon: '📊', component: ExecutiveDashboard },
  { id: 'marketing', label: 'Marketing', path: '/marketing', icon: '📈', component: MarketingDashboard },
  { id: 'google-ads', label: 'Google Ads', path: '/google-ads', icon: '📱', component: GoogleAdsDashboard },
  { id: 'comercial', label: 'Comercial', path: '/comercial', icon: '🤝', component: CommercialDashboard },
  { id: 'crm', label: 'CRM', path: '/crm', icon: '👥', component: CRMDashboard },
  { id: 'agenda', label: 'Agenda', path: '/agenda', icon: '📅', component: AgendaDashboard },
  { id: 'campanhas', label: 'Campanhas', path: '/campanhas', icon: '📢', component: CampaignsDashboard },
  { id: 'conjuntos', label: 'Conjuntos', path: '/conjuntos', icon: '🎯', component: ConjuntosDashboard },
  { id: 'criativos', label: 'Criativos', path: '/criativos', icon: '🎨', component: CreativosDashboard },
  { id: 'pacientes', label: 'Pacientes', path: '/pacientes', icon: '👤', component: PatientsDashboard },
  { id: 'profissionais', label: 'Profissionais', path: '/profissionais', icon: '👨‍⚕️', component: ProfessionalsDashboard },
  { id: 'sdrs', label: 'SDRs', path: '/sdrs', icon: '📞', component: SDRsDashboard },
  { id: 'recepção', label: 'Recepção', path: '/recepcao', icon: '🔔', component: ReceptionDashboard },
  { id: 'whatsapp', label: 'WhatsApp', path: '/whatsapp', icon: '💬', component: WhatsAppDashboard },
  { id: 'financeiro', label: 'Financeiro', path: '/financeiro', icon: '💰', component: FinancialDashboard },
  { id: 'ia', label: 'IA', path: '/ia', icon: '🤖', component: AIExecutiveDashboard },
  { id: 'procedimentos', label: 'Procedimentos', path: '/procedimentos', icon: '🔧', component: ProceduresDashboard },
  { id: 'metas', label: 'Metas', path: '/metas', icon: '🎯', component: GoalsDashboard },
  { id: 'alertas', label: 'Alertas', path: '/alertas', icon: '⚠️', component: AlertsDashboard },
  { id: 'relatorios', label: 'Relatórios', path: '/relatorios', icon: '📋', component: ReportsDashboard },
  { id: 'auditoria', label: 'Auditoria', path: '/auditoria', icon: '🔍', component: AuditDashboard },
  { id: 'comparativos', label: 'Comparativos', path: '/comparativos', icon: '📊', component: ComparativesDashboard },
  { id: 'configuracoes', label: 'Configurações', path: '/configuracoes', icon: '⚙️', component: SettingsDashboard },

  // Detail pages (no sidebar)
  { id: 'creative-detail', label: 'Criativo Detalhe', path: '/criativos/:id', icon: '🎨', component: CreativeDetailPage, category: 'detail' },
  { id: 'patient-profile', label: 'Perfil Paciente', path: '/pacientes/:id', icon: '👤', component: PatientProfilePage, category: 'detail' },
  { id: 'patient-journey', label: 'Jornada Paciente', path: '/pacientes/:id/jornada', icon: '🗺️', component: PatientJourneyPage, category: 'detail' },
  { id: 'pipeline', label: 'Pipeline', path: '/pipeline', icon: '📊', component: PipelineDashboard },
  { id: 'objections', label: 'Objeções', path: '/objections', icon: '❌', component: ObjectionsDashboard },
  { id: 'meeting-mode', label: 'Modo Reunião', path: '/meeting-mode', icon: '🎬', component: MeetingModePage, category: 'detail' },
  { id: 'search', label: 'Pesquisa', path: '/search', icon: '🔍', component: SearchPage, category: 'detail' },
  { id: 'profile', label: 'Perfil', path: '/profile', icon: '👤', component: UserProfilePage, category: 'detail' },
];

export const Router: React.FC = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {routes.map((route) => (
          <Route key={route.id} path={route.path} element={<route.component />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default Router;
