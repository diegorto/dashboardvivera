const pool = require('../db')

// ---------------------------------------------------------------------------
// services/agenda.js
// Capacidades de agenda para a Vivi: checar disponibilidade real e criar
// agendamentos em calendar_events. Fica GATEADO por chatbot_ai_config.agenda_enabled
// (ver services/ai.js). Enquanto agenda_enabled != 'true', este modulo existe e
// pode ser testado isoladamente, mas NAO e exposto ao modelo no fluxo real.
// ---------------------------------------------------------------------------

const DEFAULT_DENTIST_USER_ID = 6 // Dra. Jessica - mesma convencao de services/ai.js (getJessicaAvailabilityText)
const WORK_PERIODS = [
  { startH: 9, endH: 12 },
  { startH: 13, endH: 18 }
]

function isWeekday(date) {
  const dow = date.getDay()
  return dow !== 0 && dow !== 6
}

function formatSlotLabel(date) {
  const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return dias[date.getDay()] + ' (' + dd + '/' + mm + ') ' + hh + ':' + mi
}

// Le apenas os digitos AAAA-MM-DDTHH:MM:SS de uma string (ignorando 'Z' ou offset tipo -03:00).
// O servidor roda em UTC mas todo o resto do sistema (calendar_events, getJessicaAvailabilityText)
// trata os digitos gravados como o horario de parede da clinica, sem conversao de fuso. Se aqui
// fizessemos um new Date(startAt) comum, uma string tipo '...T09:00:00-03:00' vinda do modelo
// seria convertida para 12:00 UTC e gravada como '12:00' no banco - 3h adiantada do que o paciente
// combinou. Por isso sempre extraimos os digitos literais, do mesmo jeito que checar_disponibilidade
// gera os horarios (rodando no mesmo servidor UTC).
function parseWallClock(input) {
  const s = String(input || '')
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3])
  const h = Number(m[4]); const mi = Number(m[5]); const se = Number(m[6] || 0)
  return new Date(Date.UTC(y, mo - 1, d, h, mi, se))
}

async function getConversationContext(conversationId) {
  if (!conversationId) return null
  const [[row]] = await pool.query(
    'SELECT c.id AS conversation_id, c.deal_id, c.patient_id, c.phone, c.contact_name, ' +
    'p.name AS patient_name, p.phone AS patient_phone, d.professional_id, d.owner_name ' +
    'FROM whatsapp_conversations c ' +
    'LEFT JOIN patients p ON p.id = c.patient_id ' +
    'LEFT JOIN deals d ON d.id = c.deal_id ' +
    'WHERE c.id = ?',
    [conversationId]
  )
  return row || null
}

// ---- Checar disponibilidade ----
// Retorna horarios livres (blocos de slotMinutes) dentro do horario de atendimento
// (Seg-Sex, 09-12 e 13-18), cruzando com calendar_events existentes (status <> 'cancelled').
async function checkAvailability({ dentistUserId, days, slotMinutes } = {}) {
  const professionalId = Number(dentistUserId) || DEFAULT_DENTIST_USER_ID
  const windowDays = Math.min(Math.max(Number(days) || 7, 1), 21)
  const step = Math.min(Math.max(Number(slotMinutes) || 30, 15), 120)

  const now = new Date()
  const until = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000)

  const [rows] = await pool.query(
    "SELECT start_at, end_at FROM calendar_events WHERE dentist_user_id = ? AND status <> 'cancelled' AND end_at >= ? AND start_at <= ?",
    [professionalId, now, until]
  )
  const busy = rows.map(function (r) { return { start: new Date(r.start_at), end: new Date(r.end_at) } })

  const slots = []
  const MAX_SLOTS = 40

  for (let d = 0; d < windowDays && slots.length < MAX_SLOTS; d++) {
    const day = new Date(now)
    day.setDate(day.getDate() + d)
    if (!isWeekday(day)) continue

    for (const period of WORK_PERIODS) {
      const totalSteps = Math.floor(((period.endH - period.startH) * 60) / step)
      for (let i = 0; i < totalSteps && slots.length < MAX_SLOTS; i++) {
        const slotStart = new Date(day)
        const minutesFromStart = i * step
        slotStart.setHours(period.startH, 0, 0, 0)
        slotStart.setMinutes(slotStart.getMinutes() + minutesFromStart)
        const slotEnd = new Date(slotStart.getTime() + step * 60 * 1000)
        if (slotStart <= now) continue

        const overlaps = busy.some(function (b) { return b.start < slotEnd && b.end > slotStart })
        if (!overlaps) {
          slots.push({ start_at: slotStart.toISOString(), end_at: slotEnd.toISOString(), label: formatSlotLabel(slotStart) })
        }
      }
    }
  }

  return { dentist_user_id: professionalId, window_days: windowDays, slot_minutes: step, slots }
}

// ---- Criar agendamento ----
// Insere um novo evento em calendar_events. Sempre revalida conflito antes de inserir
// (protege contra corrida entre checar_disponibilidade e criar_agendamento).
async function createAppointment({ conversationId, dentistUserId, startAt, endAt, durationMinutes, title, notes }) {
  if (!startAt) throw new Error('startAt e obrigatorio (ISO datetime)')
  const professionalId = Number(dentistUserId) || DEFAULT_DENTIST_USER_ID
  const start = parseWallClock(startAt)
  if (isNaN(start.getTime())) throw new Error('startAt invalido')
  const end = endAt ? parseWallClock(endAt) : new Date(start.getTime() + (Number(durationMinutes) || 30) * 60 * 1000)
  if (isNaN(end.getTime()) || end <= start) throw new Error('endAt/durationMinutes invalido')

  const ctx = conversationId ? await getConversationContext(conversationId) : null
  const dealId = ctx ? ctx.deal_id : null
  const patientName = (ctx && (ctx.patient_name || ctx.contact_name)) || 'Paciente'

  const [conflict] = await pool.query(
    "SELECT id FROM calendar_events WHERE dentist_user_id = ? AND status <> 'cancelled' AND start_at < ? AND end_at > ? LIMIT 1",
    [professionalId, end, start]
  )
  if (conflict && conflict.length) {
    return { ok: false, error: 'horario_ja_ocupado' }
  }

  const finalTitle = title || ('Consulta - ' + patientName)
  const description = 'Agendado automaticamente pela Vivi (bot)' + (conversationId ? (' - conversationId ' + conversationId) : '') + (notes ? ('. Obs: ' + notes) : '.')

  const [result] = await pool.query(
    'INSERT INTO calendar_events (deal_id, dentist_user_id, title, description, start_at, end_at, status, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [dealId, professionalId, finalTitle, description, start, end, 'confirmed', null]
  )

  return {
    ok: true,
    id: result.insertId,
    deal_id: dealId,
    dentist_user_id: professionalId,
    title: finalTitle,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    status: 'confirmed'
  }
}

// ---- Definicao das tools para o OpenAI function-calling ----
// So sao incluidas na chamada ao modelo quando chatbot_ai_config.agenda_enabled === 'true'
// (ver services/ai.js callLLM). Enquanto o gate estiver desligado, esta lista existe
// mas nunca chega a ser enviada para a OpenAI.
const AGENDA_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'checar_disponibilidade',
      description: 'Consulta a agenda real da clinica e retorna horarios livres para consulta nos proximos dias. Use antes de propor um horario ao paciente.',
      parameters: {
        type: 'object',
        properties: {
          dias: { type: 'integer', description: 'Quantos dias a partir de hoje verificar (padrao 7, maximo 21).' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'criar_agendamento',
      description: 'Cria um agendamento real na agenda da clinica para o paciente desta conversa, em um horario ja confirmado explicitamente pelo paciente. So use depois que o paciente confirmar o horario.',
      parameters: {
        type: 'object',
        properties: {
          start_at: { type: 'string', description: 'Data/hora de inicio no formato AAAA-MM-DDTHH:MM:SS, sempre no horario local da clinica (o mesmo horario que aparece em checar_disponibilidade). Qualquer sufixo de fuso (Z ou -03:00) e ignorado, so os numeros de data/hora contam.' },
          duration_minutes: { type: 'integer', description: 'Duracao em minutos (padrao 30).' },
          observacao: { type: 'string', description: 'Observacao opcional sobre o agendamento.' }
        },
        required: ['start_at']
      }
    }
  }
]

async function executeAgendaTool(name, args, context) {
  const conversationId = context && context.conversationId
  if (name === 'checar_disponibilidade') {
    return await checkAvailability({ days: args && args.dias })
  }
  if (name === 'criar_agendamento') {
    return await createAppointment({
      conversationId,
      startAt: args && args.start_at,
      durationMinutes: args && args.duration_minutes,
      notes: args && args.observacao
    })
  }
  return { error: 'tool_desconhecida: ' + name }
}

module.exports = {
  DEFAULT_DENTIST_USER_ID,
  checkAvailability,
  createAppointment,
  getConversationContext,
  AGENDA_TOOLS,
  executeAgendaTool
}
