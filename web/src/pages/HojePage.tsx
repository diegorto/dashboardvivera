import { useEffect, useState } from 'react'
import { Phone, Users, CheckCircle, TrendingUp, DollarSign, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBRL } from '@/lib/utils'

interface TodayData {
  summary: {
    leads_entrada: number
    leads_contato: number
    leads_qualificados: number
    agendamentos: number
    comparecimentos: number
    fechamentos: number
    perdidos: number
    orcamentos: number
    revenue: number
    ligacoes: number
  }
  origens: Array<{ origem: string; count: number }>
  detalhesPorEtapa: {
    leads: Array<any>
    qualificados: Array<any>
    agendados: Array<any>
    compareceram: Array<any>
    vendas: Array<any>
    perdidos: Array<any>
  }
  data: string
}

const StatCard = ({ label, value, icon: Icon, sublabel, color = 'blue' }: any) => {
  const colorClasses = {
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    orange: 'border-orange-200 bg-orange-50',
    purple: 'border-purple-200 bg-purple-50',
    red: 'border-red-200 bg-red-50',
  }

  const iconClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    orange: 'text-orange-600',
    purple: 'text-purple-600',
    red: 'text-red-600',
  }

  return (
    <Card className={`border-2 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
            {sublabel && <p className="mt-1 text-xs text-gray-500">{sublabel}</p>}
          </div>
          <Icon className={`h-8 w-8 ${iconClasses[color as keyof typeof iconClasses]}`} />
        </div>
      </CardContent>
    </Card>
  )
}

const DataTable = ({ data, title }: any) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500 py-8">Nenhum registro</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 font-semibold">Nome</th>
                <th className="text-left py-2 px-3 font-semibold">Origem</th>
                <th className="text-left py-2 px-3 font-semibold">Etapa</th>
                <th className="text-left py-2 px-3 font-semibold">Telefone</th>
                {data.some((d: any) => d.valor > 0) && (
                  <th className="text-right py-2 px-3 font-semibold">Valor</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((item: any, idx: number) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3">{item.nome}</td>
                  <td className="py-2 px-3 text-gray-600">{item.origem}</td>
                  <td className="py-2 px-3">{item.etapa}</td>
                  <td className="py-2 px-3 text-gray-600">{item.telefone || '-'}</td>
                  {data.some((d: any) => d.valor > 0) && (
                    <td className="py-2 px-3 text-right font-semibold text-green-600">
                      {item.valor > 0 ? formatBRL(item.valor) : '-'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export function HojePage() {
  const [data, setData] = useState<TodayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      const response = await fetch('/api/today')
      if (!response.ok) throw new Error('Erro ao carregar dados')
      const json = await response.json()
      if (!json.success) throw new Error(json.error || 'Erro desconhecido')
      setData(json)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando dados...</div>
  if (error) return <div className="p-8 bg-red-50 text-red-600 rounded-lg">❌ {error}</div>
  if (!data) return null

  const today = new Date(data.data + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">📊 Hoje</h1>
          <p className="text-gray-500 mt-1">Dados em tempo real de {today}</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          🔄 Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Leads Entrada" value={data.summary.leads_entrada} icon={Users} color="blue" />
        <StatCard label="Qualificados" value={data.summary.leads_qualificados} icon={CheckCircle} color="green" />
        <StatCard label="Agendamentos" value={data.summary.agendamentos} icon={TrendingUp} color="orange" />
        <StatCard label="Comparecimentos" value={data.summary.comparecimentos} icon={Phone} color="purple" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Fechamentos"
          value={data.summary.fechamentos}
          icon={DollarSign}
          sublabel={formatBRL(data.summary.revenue)}
          color="green"
        />
        <StatCard label="☎️ Ligações" value={data.summary.ligacoes} icon={Phone} color="blue" />
        <StatCard label="💼 Orçamentos" value={data.summary.orcamentos} icon={TrendingUp} color="orange" />
        <StatCard label="Perdidos" value={data.summary.perdidos} icon={XCircle} color="red" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>📍 Canal de Origem</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {data.origens.length > 0 ? (
              data.origens.map((origem, idx) => (
                <span key={idx} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full text-sm font-medium">
                  {origem.origem} <span className="ml-2 opacity-75">({origem.count})</span>
                </span>
              ))
            ) : (
              <p className="text-gray-500">Sem dados</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <DataTable data={data.detalhesPorEtapa.leads} title="✨ Leads Novos" />
        <DataTable data={data.detalhesPorEtapa.qualificados} title="✅ Qualificados" />
        <DataTable data={data.detalhesPorEtapa.agendados} title="📅 Agendados" />
        <DataTable data={data.detalhesPorEtapa.compareceram} title="👥 Compareceram" />
        <DataTable data={data.detalhesPorEtapa.vendas} title="💰 Vendas de Hoje" />
        <DataTable data={data.detalhesPorEtapa.perdidos} title="❌ Perdidos" />
      </div>
    </div>
  )
}
