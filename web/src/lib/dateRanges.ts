// Formata em YYYY-MM-DD usando o calendario LOCAL do navegador (nao UTC) -
// toISOString() converteria pra UTC e podia mudar o dia perto da virada.
function fmt(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfWeek(d: Date): Date {
  const day = d.getDay() // 0=domingo
  const diff = day === 0 ? 6 : day - 1 // segunda como inicio
  const s = new Date(d)
  s.setDate(d.getDate() - diff)
  return s
}

export type PresetKey =
  | 'hoje' | 'ontem' | 'semanaAtual' | 'semanaAnterior'
  | 'mesAtual' | 'mesAnterior' | '7dias' | '30dias' | '90dias' | 'trimestre'

export const PRESET_LABELS: Record<PresetKey, string> = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  semanaAtual: 'Semana atual',
  semanaAnterior: 'Semana anterior',
  mesAtual: 'Mês atual',
  mesAnterior: 'Mês anterior',
  '7dias': '7 dias',
  '30dias': '30 dias',
  '90dias': '90 dias',
  trimestre: 'Trimestre',
}

export function resolvePreset(key: PresetKey): { since: string; until: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  switch (key) {
    case 'hoje':
      return { since: fmt(today), until: fmt(today) }
    case 'ontem': {
      const y = new Date(today); y.setDate(y.getDate() - 1)
      return { since: fmt(y), until: fmt(y) }
    }
    case 'semanaAtual': {
      const s = startOfWeek(today)
      return { since: fmt(s), until: fmt(today) }
    }
    case 'semanaAnterior': {
      const s = startOfWeek(today); s.setDate(s.getDate() - 7)
      const e = new Date(s); e.setDate(e.getDate() + 6)
      return { since: fmt(s), until: fmt(e) }
    }
    case 'mesAtual': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1)
      return { since: fmt(s), until: fmt(today) }
    }
    case 'mesAnterior': {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const e = new Date(today.getFullYear(), today.getMonth(), 0)
      return { since: fmt(s), until: fmt(e) }
    }
    case '7dias': {
      const s = new Date(today); s.setDate(s.getDate() - 6)
      return { since: fmt(s), until: fmt(today) }
    }
    case '30dias': {
      const s = new Date(today); s.setDate(s.getDate() - 29)
      return { since: fmt(s), until: fmt(today) }
    }
    case '90dias': {
      const s = new Date(today); s.setDate(s.getDate() - 89)
      return { since: fmt(s), until: fmt(today) }
    }
    case 'trimestre': {
      const qStartMonth = Math.floor(today.getMonth() / 3) * 3
      const s = new Date(today.getFullYear(), qStartMonth, 1)
      return { since: fmt(s), until: fmt(today) }
    }
  }
}
