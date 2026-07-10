// Analytics do WhatsApp Monitor - Queries & Lógica
const db = require('./whatsapp-db');

const DAYS_DEFAULT = 30;

class WhatsAppAnalytics {
  // 1️⃣ KPIs Básicos: Chamadas, Atendimento, Tempo Médio
  async getStats(days = DAYS_DEFAULT) {
    const rows = await db.query(`
      SELECT
        COUNT(*) as total_chamadas_realizadas,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as chamadas_atendidas,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as taxa_atendimento_pct,
        AVG(CASE WHEN status = 'completed' THEN duration_seconds ELSE NULL END) as tempo_medio_atendidas_seg,
        MIN(duration_seconds) as duracao_minima_seg,
        MAX(duration_seconds) as duracao_maxima_seg
      FROM whatsapp_calls
      WHERE DATE(call_timestamp) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]);

    return rows[0] || {};
  }

  // 3️⃣ Tabela de Chamadas por Número
  async getCalls(days = DAYS_DEFAULT, limit = 500) {
    return db.query(`
      SELECT
        c.conversation_id,
        ca.to_number as numero_cliente,
        c.client_name as nome_cliente,
        ca.call_timestamp as data_hora,
        ca.duration_seconds as duracao_segundos,
        ca.status as status_chamada,
        c.assigned_to as sdr_que_ligou,
        ca.attempted_from_other as tentou_do_fallback
      FROM whatsapp_calls ca
      LEFT JOIN whatsapp_conversations c ON ca.conversation_id = c.conversation_id
      WHERE DATE(ca.call_timestamp) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      ORDER BY ca.call_timestamp DESC
      LIMIT ?
    `, [days, limit]);
  }

  // 5️⃣ Tempo até Primeira Mensagem
  async getLeadTimingMessages(days = DAYS_DEFAULT) {
    const details = await db.query(`
      SELECT
        c.conversation_id,
        c.client_name,
        c.created_at as quando_lead_entrou,
        m.timestamp as quando_primeira_msg,
        TIMESTAMPDIFF(MINUTE, c.created_at, m.timestamp) as minutos_ate_resposta,
        LEFT(m.text, 100) as primeira_mensagem,
        c.assigned_to as sdr
      FROM whatsapp_conversations c
      LEFT JOIN (
        SELECT conversation_id, timestamp, text
        FROM whatsapp_messages
        WHERE direction = 'outbound'
        ORDER BY timestamp ASC
        LIMIT 1
      ) m ON c.conversation_id = m.conversation_id
      WHERE c.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND m.timestamp IS NOT NULL
      ORDER BY c.created_at DESC
      LIMIT 500
    `, [days]);

    if (details.length === 0) {
      return { dados: [], media_minutos: 0, mediana_minutos: 0, percentil_95_minutos: 0 };
    }

    const minutos = details.map(d => d.minutos_ate_resposta).sort((a, b) => a - b);
    const media = minutos.reduce((a, b) => a + b, 0) / minutos.length;
    const mediana = minutos[Math.floor(minutos.length / 2)];
    const p95 = minutos[Math.floor(minutos.length * 0.95)];

    return {
      dados: details,
      media_minutos: Math.round(media * 10) / 10,
      mediana_minutos: mediana,
      percentil_95_minutos: p95,
    };
  }

  // 6️⃣ Tempo até Primeira Ligação
  async getLeadTimingCalls(days = DAYS_DEFAULT) {
    const details = await db.query(`
      SELECT
        c.conversation_id,
        c.client_name,
        c.created_at as quando_lead_entrou,
        ca.call_timestamp as quando_primeira_ligacao,
        TIMESTAMPDIFF(MINUTE, c.created_at, ca.call_timestamp) as minutos_ate_primeira_ligacao,
        ca.status as resultado_primeira_ligacao,
        c.assigned_to as sdr
      FROM whatsapp_conversations c
      LEFT JOIN (
        SELECT conversation_id, call_timestamp, status
        FROM whatsapp_calls
        ORDER BY call_timestamp ASC
        LIMIT 1
      ) ca ON c.conversation_id = ca.conversation_id
      WHERE c.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND ca.call_timestamp IS NOT NULL
      ORDER BY c.created_at DESC
      LIMIT 500
    `, [days]);

    if (details.length === 0) {
      return { dados: [], media_minutos: 0, mediana_minutos: 0, percentil_95_minutos: 0 };
    }

    const minutos = details.map(d => d.minutos_ate_primeira_ligacao).sort((a, b) => a - b);
    const media = minutos.reduce((a, b) => a + b, 0) / minutos.length;
    const mediana = minutos[Math.floor(minutos.length / 2)];
    const p95 = minutos[Math.floor(minutos.length * 0.95)];

    return {
      dados: details,
      media_minutos: Math.round(media * 10) / 10,
      mediana_minutos: mediana,
      percentil_95_minutos: p95,
    };
  }

  // 7️⃣ Análise de Padrões: Taxa por Hora, Impacto Mensagem Prévia, Velocidade de Tentativas
  async getPatterns(days = DAYS_DEFAULT) {
    // A. Taxa por hora
    const porHora = await db.query(`
      SELECT
        HOUR(call_timestamp) as hora_do_dia,
        COUNT(*) as total_tentativas,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as atendidas,
        ROUND(COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 1) as taxa_atendimento_pct,
        ROUND(AVG(duration_seconds), 0) as tempo_medio_seg
      FROM whatsapp_calls
      WHERE DATE(call_timestamp) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY HOUR(call_timestamp)
      ORDER BY hora_do_dia
    `, [days]);

    // B. Impacto de mensagem prévia
    const msgPreviaImpact = await db.query(`
      SELECT
        CASE
          WHEN tinha_msg_antes = 1 THEN 'Com mensagem prévia'
          ELSE 'Sem mensagem prévia'
        END as estrategia,
        COUNT(*) as quantidade_tentativas,
        COUNT(CASE WHEN resultado = 'completed' THEN 1 END) as atendidas,
        ROUND(COUNT(CASE WHEN resultado = 'completed' THEN 1 END) * 100.0 / COUNT(*), 1) as taxa_atendimento_pct,
        ROUND(AVG(duracao_chamada), 0) as tempo_medio_seg
      FROM (
        SELECT
          ca.id,
          ca.conversation_id,
          ca.status as resultado,
          ca.duration_seconds as duracao_chamada,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM whatsapp_messages m
              WHERE m.conversation_id = ca.conversation_id
                AND m.direction = 'outbound'
                AND m.timestamp < ca.call_timestamp
                AND m.timestamp > DATE_SUB(ca.call_timestamp, INTERVAL 2 HOUR)
            ) THEN 1
            ELSE 0
          END as tinha_msg_antes
        FROM whatsapp_calls ca
        WHERE DATE(ca.call_timestamp) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      ) subquery
      GROUP BY tinha_msg_antes
    `, [days]);

    // Calcular impacto percentual
    let impactoPct = 0;
    if (msgPreviaImpact.length === 2) {
      const comMsg = msgPreviaImpact.find(r => r.estrategia === 'Com mensagem prévia')?.taxa_atendimento_pct || 0;
      const semMsg = msgPreviaImpact.find(r => r.estrategia === 'Sem mensagem prévia')?.taxa_atendimento_pct || 0;
      impactoPct = Math.round((comMsg - semMsg) * 10) / 10;
    }

    return {
      por_hora: porHora,
      mensagem_previa_impact: msgPreviaImpact,
      impacto_pct: impactoPct,
      insight: impactoPct > 0
        ? `Enviar mensagem antes de ligar aumenta taxa de atendimento em ${impactoPct}%`
        : 'Dados insuficientes para análise',
    };
  }

  // 8️⃣ Análise de Tipos de Mensagem (requer classificação)
  async getMessageTypes(days = DAYS_DEFAULT) {
    // Nota: Atualmente sistema não classifica tipo de mensagem
    // Esta query é um template para quando tiver coluna message_type
    const rows = await db.query(`
      SELECT
        COUNT(*) as total_mensagens,
        COUNT(DISTINCT conversation_id) as conversas_com_msgs
      FROM whatsapp_messages
      WHERE direction = 'outbound'
        AND DATE(timestamp) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]);

    return {
      aviso: 'Classificação de tipo de mensagem não está implementada',
      dados: rows[0] || {},
      proximo_passo: 'Adicionar coluna message_type em whatsapp_messages e implementar classificação via N8N',
    };
  }
}

module.exports = new WhatsAppAnalytics();
