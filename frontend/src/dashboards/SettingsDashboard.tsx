import React, { useEffect, useState } from 'react';
import { Layout } from '../components';
import settingsService, { AppSettings, ConnectionTestResult } from '../services/settingsService';
import { useAppStore } from '../stores/appStore';

const SettingsDashboard: React.FC = () => {
  const { addNotification } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const [form, setForm] = useState({
    pipedriveToken: '',
    fbAccessToken: '',
    fbAdAccountIds: '',
    tintimApiKey: '',
    tintimWorkspaceId: '',
    googleAdsCustomerId: '',
    googleAdsDeveloperToken: '',
    openaiApiKey: '',
    inboundPipelineId: 1,
    monthlyGoal: 0
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsService.getSettings();
      setSettings(data);
      setForm({
        pipedriveToken: data.pipedriveToken,
        fbAccessToken: data.fbAccessToken,
        fbAdAccountIds: data.fbAdAccountIds,
        tintimApiKey: data.tintimApiKey || '',
        tintimWorkspaceId: data.tintimWorkspaceId || '',
        googleAdsCustomerId: data.googleAdsCustomerId || '',
        googleAdsDeveloperToken: data.googleAdsDeveloperToken || '',
        openaiApiKey: data.openaiApiKey,
        inboundPipelineId: data.inboundPipelineId,
        monthlyGoal: data.monthlyGoal
      });
    } catch (err) {
      addNotification('error', err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const message = await settingsService.saveSettings(form);
      addNotification('success', message);
      await loadSettings();
    } catch (err) {
      addNotification('error', err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const result = await settingsService.testConnections();
      setTestResult(result);
    } catch (err) {
      addNotification('error', err instanceof Error ? err.message : 'Erro ao testar');
    } finally {
      setTesting(false);
    }
  };

  const setField = (key: keyof typeof form, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Layout title="Configurações">
        <div className="flex items-center justify-center h-full">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  const statusBadge = (ok: boolean) => (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: ok ? '#10b981' : '#ef4444', backgroundColor: ok ? '#dcfce7' : '#fee2e2' }}
    >
      {ok ? 'Configurado' : 'Não configurado'}
    </span>
  );

  return (
    <Layout title="Configurações" breadcrumb={['Dashboard', 'Configurações']}>
      <div className="max-w-3xl">
        {/* Status geral */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Pipedrive</div>
            {statusBadge(!!settings?.configured.pipedrive)}
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Meta Ads</div>
            {statusBadge(!!settings?.configured.meta)}
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Google Ads</div>
            {statusBadge(!!settings?.configured.googleAds)}
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">Tintim</div>
            {statusBadge(!!settings?.configured.tintim)}
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-2">IA (OpenAI)</div>
            {statusBadge(!!settings?.configured.openai)}
          </div>
        </div>

        {/* Integrações */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 mb-6">
          <h3 className="text-[13px] font-semibold text-[#0f172a] mb-1">Integrações</h3>
          <p className="text-[11px] text-[#64748b] mb-4">
            Tokens são armazenados no servidor e aplicados imediatamente, sem reiniciar.
            Valores exibidos com •••• estão salvos — deixe como está para manter, ou cole um novo valor para substituir.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-1.5">
                Pipedrive API Token
              </label>
              <input
                type="text"
                value={form.pipedriveToken}
                onChange={(e) => setField('pipedriveToken', e.target.value)}
                placeholder="Cole o token do Pipedrive"
                className="w-full text-[12px] font-mono border border-[#e2e8f0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#6366f1]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-1.5">
                Meta (Facebook) Access Token
              </label>
              <input
                type="text"
                value={form.fbAccessToken}
                onChange={(e) => setField('fbAccessToken', e.target.value)}
                placeholder="Cole o access token do Meta"
                className="w-full text-[12px] font-mono border border-[#e2e8f0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#6366f1]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-1.5">
                Meta Ad Account IDs <span className="normal-case font-normal">(separados por vírgula, sem "act_")</span>
              </label>
              <input
                type="text"
                value={form.fbAdAccountIds}
                onChange={(e) => setField('fbAdAccountIds', e.target.value)}
                placeholder="123456789, 987654321"
                className="w-full text-[12px] font-mono border border-[#e2e8f0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#6366f1]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-1.5">
                Tintim API Key
              </label>
              <input
                type="text"
                value={form.tintimApiKey}
                onChange={(e) => setField('tintimApiKey', e.target.value)}
                placeholder="Cole a API Key do Tintim"
                className="w-full text-[12px] font-mono border border-[#e2e8f0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#6366f1]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-1.5">
                Tintim Workspace ID
              </label>
              <input
                type="text"
                value={form.tintimWorkspaceId}
                onChange={(e) => setField('tintimWorkspaceId', e.target.value)}
                placeholder="ID do workspace do Tintim"
                className="w-full text-[12px] font-mono border border-[#e2e8f0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#6366f1]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-1.5">
                Google Ads Customer ID
              </label>
              <input
                type="text"
                value={form.googleAdsCustomerId}
                onChange={(e) => setField('googleAdsCustomerId', e.target.value)}
                placeholder="XXX-XXX-XXXX"
                className="w-full text-[12px] font-mono border border-[#e2e8f0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#6366f1]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-1.5">
                Google Ads Developer Token
              </label>
              <input
                type="text"
                value={form.googleAdsDeveloperToken}
                onChange={(e) => setField('googleAdsDeveloperToken', e.target.value)}
                placeholder="Cole o developer token do Google Ads"
                className="w-full text-[12px] font-mono border border-[#e2e8f0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#6366f1]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-1.5">
                OpenAI API Key <span className="normal-case font-normal">(opcional — habilita o resumo narrativo da IA · platform.openai.com)</span>
              </label>
              <input
                type="text"
                value={form.openaiApiKey}
                onChange={(e) => setField('openaiApiKey', e.target.value)}
                placeholder="sk-..."
                className="w-full text-[12px] font-mono border border-[#e2e8f0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#6366f1]"
              />
            </div>
          </div>
        </div>

        {/* Parâmetros de negócio */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 mb-6">
          <h3 className="text-[13px] font-semibold text-[#0f172a] mb-4">Parâmetros de Negócio</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-1.5">
                Meta de Receita Mensal (R$)
              </label>
              <input
                type="number"
                value={form.monthlyGoal}
                onChange={(e) => setField('monthlyGoal', parseFloat(e.target.value) || 0)}
                className="w-full text-[12px] font-mono border border-[#e2e8f0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#6366f1]"
              />
              <p className="text-[10px] text-[#94a3b8] mt-1">Usada nos KPIs Meta e % Meta do Executive. 0 = automático (receita +15%).</p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8] mb-1.5">
                ID do Pipeline Inbound (Pipedrive)
              </label>
              <input
                type="number"
                value={form.inboundPipelineId}
                onChange={(e) => setField('inboundPipelineId', parseInt(e.target.value, 10) || 1)}
                className="w-full text-[12px] font-mono border border-[#e2e8f0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#6366f1]"
              />
              <p className="text-[10px] text-[#94a3b8] mt-1">Pipeline onde entram os leads de tráfego pago.</p>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-[#6366f1] text-white text-[12px] font-semibold rounded-lg hover:bg-[#4f46e5] disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-5 py-2.5 bg-white border border-[#e2e8f0] text-[#334155] text-[12px] font-semibold rounded-lg hover:bg-[#f8fafc] disabled:opacity-50"
          >
            {testing ? 'Testando...' : 'Testar Conexões'}
          </button>
        </div>

        {/* Resultado do teste */}
        {testResult && (
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
            <h3 className="text-[13px] font-semibold text-[#0f172a] mb-3">Resultado do Teste</h3>
            <div className="space-y-2">
              {(['pipedrive', 'meta', 'googleAds', 'tintim', 'openai'] as const).map(service => (
                <div key={service} className="flex items-center gap-2">
                  <span className="text-[14px]">{testResult[service].ok ? '✅' : '❌'}</span>
                  <span className="text-[12px] font-semibold text-[#0f172a] capitalize w-20">
                    {service === 'googleAds' ? 'Google Ads' : service}
                  </span>
                  <span className="text-[12px] text-[#64748b]">{testResult[service].message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SettingsDashboard;
