import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface LeadsCardProps {
  title: string;
  period: string;
  totalLeads: number;
  qualifiedLeads: number;
  qualificationRate: number;
  changeVsPreviousMonth: number;
  leadsPerDay: number;
  dailyEvolutionData: Array<{ date: string; total: number; qualified: number }>;
  leadsBySource: Array<{
    source: string;
    leads: number;
    percentage: number;
    qualified: number;
    qualificationRate: number;
    color: string;
  }>;
}

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6'];

const LeadsCard: React.FC<LeadsCardProps> = ({
  title,
  period,
  totalLeads,
  qualifiedLeads,
  qualificationRate,
  changeVsPreviousMonth,
  leadsPerDay,
  dailyEvolutionData,
  leadsBySource,
}) => {
  const changeColor = changeVsPreviousMonth >= 0 ? '#10b981' : '#ef4444';
  const changePrefix = changeVsPreviousMonth >= 0 ? '+' : '';

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #f0f4f8',
        borderRadius: '8px',
        padding: '24px',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '4px' }}>
          {title}
        </h2>
        <p style={{ fontSize: '12px', color: '#94a3b8' }}>{period}</p>
      </div>

      {/* KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '16px',
          marginBottom: '24px',
          paddingBottom: '24px',
          borderBottom: '1px solid #f0f4f8',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
            Leads totais
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>
            {totalLeads}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
            Qualificados
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
            {qualifiedLeads}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
            Taxa qualif.
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#6366f1' }}>
            {qualificationRate.toFixed(1)}%
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
            vs. mês anterior
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: changeColor }}>
            {changePrefix}{changeVsPreviousMonth}%
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
            Leads/dia (média)
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
            {leadsPerDay.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Daily Evolution Chart */}
        <div>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '12px' }}>
            Evolução diária de leads
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={dailyEvolutionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3, fill: '#6366f1' }}
                name="Leads totais"
              />
              <Line
                type="monotone"
                dataKey="qualified"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, fill: '#10b981' }}
                name="Qualificados"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Leads by Source Table */}
        <div>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '12px' }}>
            Leads por fonte
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '1px solid #f0f4f8' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', color: '#94a3b8', fontWeight: '500' }}>
                    FONTE
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 0', color: '#94a3b8', fontWeight: '500' }}>
                    LEADS
                  </th>
                  <th style={{ textAlign: 'center', padding: '8px 0', color: '#94a3b8', fontWeight: '500' }}>
                    %
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 0', color: '#94a3b8', fontWeight: '500' }}>
                    QUALIF.
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 0', color: '#94a3b8', fontWeight: '500' }}>
                    TAXA
                  </th>
                </tr>
              </thead>
              <tbody>
                {leadsBySource.map((source, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td
                      style={{
                        padding: '12px 0',
                        color: '#0f172a',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: source.color,
                        }}
                      />
                      {source.source}
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', color: '#0f172a', fontWeight: '600' }}>
                      {source.leads}
                    </td>
                    <td
                      style={{
                        padding: '12px 0',
                        textAlign: 'center',
                        background: source.color + '10',
                        borderRadius: '4px',
                        color: source.color,
                        fontWeight: '600',
                      }}
                    >
                      <div style={{ padding: '2px 8px' }}>{source.percentage.toFixed(1)}%</div>
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right', color: '#10b981', fontWeight: '600' }}>
                      {source.qualified}
                    </td>
                    <td
                      style={{
                        padding: '12px 0',
                        textAlign: 'right',
                        color: source.qualificationRate >= 50 ? '#10b981' : '#ef4444',
                        fontWeight: '600',
                      }}
                    >
                      {source.qualificationRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid #f0f4f8', fontWeight: '600' }}>
                  <td style={{ padding: '12px 0', color: '#0f172a' }}>Total</td>
                  <td style={{ padding: '12px 0', textAlign: 'right', color: '#0f172a' }}>
                    {totalLeads}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'center', color: '#0f172a' }}>
                    100%
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'right', color: '#10b981' }}>
                    {qualifiedLeads}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'right', color: '#10b981' }}>
                    {qualificationRate.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadsCard;
