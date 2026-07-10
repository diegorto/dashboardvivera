const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');
const db = require('./db');

class PipedriveIntegration {
  async handleNewDeal(req, res) {
    try {
      const deal = req.body.current;
      if (!deal) return res.status(400).json({ error: 'payload sem "current"' });

      console.log(`[Pipedrive] Novo deal: ${deal.id}`);

      const userMapping = await db.queryOne('SELECT sdr_name FROM pipedrive_users_mapping WHERE pipedrive_user_id = ?', [
        deal.user_id,
      ]);

      if (!userMapping) {
        console.warn(`[Pipedrive] Usuario nao mapeado: ${deal.user_id}`);
        return res.json({ status: 'user_not_mapped' });
      }

      const sdrName = userMapping.sdr_name;
      const person = await this.getPerson(deal.person_id);
      const clientPhone = person?.phone?.[0]?.value?.replace(/\D/g, '');

      if (!clientPhone) {
        console.warn(`[Pipedrive] Sem telefone: ${deal.person_id}`);
        return res.json({ status: 'no_phone' });
      }

      const convId = uuidv4();
      const labels = JSON.stringify(deal.label || []);

      await db.query(
        `INSERT INTO whatsapp_conversations
        (conversation_id, pipedrive_id, client_phone, client_name, assigned_to,
         pipedrive_stage, pipedrive_value, labels, synced_from)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pipedrive')
        ON DUPLICATE KEY UPDATE assigned_to = VALUES(assigned_to), labels = VALUES(labels)`,
        [convId, deal.id, clientPhone, person?.name || 'Desconhecido', sdrName, deal.stage_id, deal.value, labels]
      );

      await this._logSync('new_deal', 'inbound', deal.id, convId, { sdrName });

      console.log(`[Pipedrive] Deal sincronizado: ${deal.id} -> ${sdrName}`);
      res.json({ status: 'synced', conversation_id: convId });
    } catch (error) {
      console.error(`[Pipedrive] Erro: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  async handleLabelAdded(req, res) {
    try {
      const { deal_id, label } = req.body;

      const conv = await db.queryOne('SELECT * FROM whatsapp_conversations WHERE pipedrive_id = ?', [deal_id]);
      if (!conv) return res.json({ status: 'conversation_not_found' });

      const labels = db.parseJSON(conv.labels);
      if (!labels.includes(label)) labels.push(label);

      await db.query('UPDATE whatsapp_conversations SET labels = ? WHERE id = ?', [JSON.stringify(labels), conv.id]);
      await this._logSync('label_added', 'inbound', deal_id, conv.conversation_id, { label });

      console.log(`[Pipedrive] Label sincronizada: ${label}`);
      res.json({ status: 'synced' });
    } catch (error) {
      console.error(`[Pipedrive] Erro label: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  async syncOutboundLabel(conversationId, pipedriveId, label) {
    await axios.put(`${config.pipedrive.baseURL}/deals/${pipedriveId}`, { label }, { params: { api_token: config.pipedrive.token } });
    await this._logSync('label_added', 'outbound', pipedriveId, conversationId, { label });
  }

  async syncDistribution() {
    try {
      const response = await axios.get(`${config.pipedrive.baseURL}/deals`, {
        params: { status: 'open', limit: 500, api_token: config.pipedrive.token },
      });

      for (const deal of response.data.data || []) {
        const userMapping = await db.queryOne('SELECT sdr_name FROM pipedrive_users_mapping WHERE pipedrive_user_id = ?', [
          deal.user_id,
        ]);
        if (!userMapping) continue;

        const sdrName = userMapping.sdr_name;
        const person = await this.getPerson(deal.person_id);
        const clientPhone = person?.phone?.[0]?.value?.replace(/\D/g, '');
        if (!clientPhone) continue;

        const existing = await db.queryOne('SELECT id FROM whatsapp_conversations WHERE pipedrive_id = ?', [deal.id]);
        const labels = JSON.stringify(deal.label || []);

        if (!existing) {
          const convId = uuidv4();
          await db.query(
            `INSERT INTO whatsapp_conversations
            (conversation_id, pipedrive_id, client_phone, client_name, assigned_to,
             pipedrive_stage, pipedrive_value, labels, synced_from)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pipedrive')`,
            [convId, deal.id, clientPhone, person?.name || 'Desconhecido', sdrName, deal.stage_id, deal.value, labels]
          );
        } else {
          await db.query(
            `UPDATE whatsapp_conversations
            SET assigned_to = ?, labels = ?, pipedrive_stage = ?, pipedrive_value = ?
            WHERE pipedrive_id = ?`,
            [sdrName, labels, deal.stage_id, deal.value, deal.id]
          );
        }
      }

      console.log('[Pipedrive] Distribuicao sincronizada');
    } catch (error) {
      console.error(`[Pipedrive] Erro na sincronizacao: ${error.response?.data?.error || error.message}`);
    }
  }

  async getPerson(personId) {
    if (!personId) return null;
    try {
      const response = await axios.get(`${config.pipedrive.baseURL}/persons/${personId}`, {
        params: { api_token: config.pipedrive.token },
      });
      return response.data.data;
    } catch {
      return null;
    }
  }

  async _logSync(action, direction, pipedriveId, conversationId, details) {
    await db.query(
      'INSERT INTO pipedrive_sync_log (action, direction, pipedrive_id, conversation_id, details) VALUES (?, ?, ?, ?, ?)',
      [action, direction, pipedriveId, conversationId, JSON.stringify(details || {})]
    );
  }
}

module.exports = new PipedriveIntegration();
