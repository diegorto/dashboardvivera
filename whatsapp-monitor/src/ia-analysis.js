const axios = require('axios');
const config = require('./config');
const db = require('./db');

const SCRIPT = `
CUMPRIMENTO: "Ola [Nome]! Bem-vindo a Vivera Orofacial"
QUALIFICACAO: "Qual e seu interesse?"
PROBLEMA: "O que mais te incomoda?"
IMPLICACAO: "Como isso afeta voce?"
CONCORDANCIA: "Seria importante resolver?"
PLANO (Premium -> Avancado -> Essencial)
AGENDAMENTO: "Qual dia prefere?"
`;

class IAAnalysis {
  async analyzeConversationsDaily() {
    try {
      console.log('[IA] Iniciando analise diaria...');

      const conversations = await db.query(`
        SELECT c.*, GROUP_CONCAT(m.text SEPARATOR ' | ') as messages
        FROM whatsapp_conversations c
        LEFT JOIN whatsapp_messages m ON c.conversation_id = m.conversation_id
        WHERE DATE(c.last_message_at) = CURDATE()
          AND c.analyzed_at IS NULL
        GROUP BY c.id
        ORDER BY c.assigned_to
      `);

      if (conversations.length === 0) {
        console.log('[IA] Nenhuma conversa para analisar');
        return;
      }

      const bySDR = {};
      for (const conv of conversations) {
        if (!bySDR[conv.assigned_to]) bySDR[conv.assigned_to] = [];
        bySDR[conv.assigned_to].push(conv);
      }

      for (const [sdrName, convs] of Object.entries(bySDR)) {
        await this._analyzeSDR(sdrName, convs);
      }

      console.log('[IA] Analise concluida');
    } catch (error) {
      console.error(`[IA] Erro: ${error.message}`);
    }
  }

  async _analyzeSDR(sdrName, conversations) {
    if (!config.n8nWebhook) {
      console.warn('[IA] N8N_WEBHOOK nao configurado, pulando analise');
      return;
    }

    try {
      const conversationsData = conversations.map((c) => ({
        id: c.conversation_id,
        client: c.client_name,
        messages: c.messages,
      }));

      const response = await axios.post(config.n8nWebhook, {
        action: 'analyze',
        sdr: sdrName,
        script: SCRIPT,
        conversations: conversationsData,
      });

      const results = response.data.results || [];

      for (const result of results) {
        await db.query('UPDATE whatsapp_conversations SET script_adherence = ?, analyzed_at = NOW() WHERE conversation_id = ?', [
          result.adherence_score,
          result.conversation_id,
        ]);
        console.log(`[IA] ${sdrName} - ${result.adherence_score}%`);
      }

      await this._generateMetrics(sdrName, conversations, results);
    } catch (error) {
      console.error(`[IA] Erro ao analisar ${sdrName}: ${error.message}`);
    }
  }

  async _generateMetrics(sdrName, conversations, results) {
    try {
      const scoreById = new Map(results.map((r) => [r.conversation_id, r.adherence_score]));
      const scores = conversations.map((c) => scoreById.get(c.conversation_id) ?? c.script_adherence ?? 0);
      const total = conversations.length;
      const conforming = scores.filter((s) => s >= 80).length;
      const avg = total ? scores.reduce((sum, s) => sum + s, 0) / total : 0;

      const calls = await db.queryOne(
        `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as answered,
         AVG(duration_seconds) as avg_duration
        FROM whatsapp_calls
        WHERE sdr_name = ? AND DATE(call_timestamp) = CURDATE()`,
        [sdrName]
      );

      await db.query(
        `INSERT INTO daily_metrics
        (sdr_name, date, total_conversations, messages_analyzed, messages_conforming, avg_script_adherence,
         total_calls, calls_answered, avg_call_duration)
        VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        total_conversations = VALUES(total_conversations),
        messages_analyzed = VALUES(messages_analyzed),
        messages_conforming = VALUES(messages_conforming),
        avg_script_adherence = VALUES(avg_script_adherence),
        total_calls = VALUES(total_calls),
        calls_answered = VALUES(calls_answered),
        avg_call_duration = VALUES(avg_call_duration)`,
        [sdrName, total, total, conforming, Math.round(avg), calls.total, calls.answered, Math.round(calls.avg_duration || 0)]
      );

      console.log(`[Metrica] ${sdrName}: ${Math.round(avg)}% aderencia`);
    } catch (error) {
      console.error(`[Metrica] Erro: ${error.message}`);
    }
  }
}

module.exports = new IAAnalysis();
