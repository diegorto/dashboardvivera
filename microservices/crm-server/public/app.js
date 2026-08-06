// Helpers compartilhados pela mini-interface do CRM (sem framework, JS puro).

function getToken() {
  return localStorage.getItem('crm_token');
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('crm_user') || 'null'); }
  catch { return null; }
}

function setSession(token, user) {
  localStorage.setItem('crm_token', token);
  localStorage.setItem('crm_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_user');
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = 'login.html';
  }
}

function logout() {
  clearSession();
  window.location.href = 'login.html';
}

async function api(path, opts = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(path, Object.assign({}, opts, { headers }));
  if (res.status === 401) {
    clearSession();
    window.location.href = 'login.html';
    throw new Error('Sessao expirada');
  }
  let data;
  try { data = await res.json(); }
  catch { data = { success: false, error: 'Resposta invalida do servidor' }; }
  if (!res.ok || data.success === false) {
    const err = new Error(data.error || 'Erro inesperado'); err.status = res.status; throw err;
  }
  return data;
}


async function moveDealStage(dealId, stageId, saraPassword) {
  const body = { stageId: stageId };
  if (saraPassword) body.saraPassword = saraPassword;
  try {
    return await api('/api/crm/deals/' + dealId + '/stage', { method: 'PATCH', body: JSON.stringify(body) });
  } catch (err) {
    if (err && err.status === 403 && !saraPassword) {
      const pwd = window.prompt((err.message || 'Acao bloqueada.') + '\n\nDigite a senha da Sara para autorizar:');
      if (!pwd) throw err;
      return await moveDealStage(dealId, stageId, pwd);
    }
    throw err;
  }
}

function fmtMoney(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(v) {
  if (!v) return '-';
  const d = new Date(v.replace(' ', 'T'));
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString('pt-BR');
}

function fmtDateTime(v) {
  if (!v) return '-';
  const d = new Date(v.replace(' ', 'T'));
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status) {
  const map = { open: ['badge-open', 'Aberto'], won: ['badge-won', 'Ganho'], lost: ['badge-lost', 'Perdido'] };
  const [cls, label] = map[status] || ['badge-open', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

let toastTimer = null;
function showToast(msg, type) {
  let el = document.getElementById('__toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '__toast';
    document.body.appendChild(el);
  }
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.remove(); }, 3500);
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// GATE: perfil comercial_robo so pode ver a tela de Orientacao do Robo (whatsapp.html)
(function() {
  try {
    var u = getUser();
    if (u && u.role === 'comercial_robo' && false) {
      var page = location.pathname.split('/').pop();
      var allowed = ['whatsapp.html', 'login.html', ''];
      if (allowed.indexOf(page) === -1) {
        location.replace('/whatsapp.html');
      }
    }
  } catch (e) {}
})();


// --- Alerta de leads aguardando resposta (SDR) - polling global ---
(function () {
  function initSdrWaitAlert() {
    try {
      var token = localStorage.getItem('crm_token');
      if (!token) return;
      var user = JSON.parse(localStorage.getItem('crm_user') || 'null');
      if (!user || !user.name) return;

      var badgeEl = null;
      function ensureBadge() {
        if (badgeEl && document.body.contains(badgeEl)) return badgeEl;
        badgeEl = document.createElement('div');
        badgeEl.id = 'sdrWaitAlert';
        badgeEl.style.cssText = 'position:fixed;top:10px;left:10px;z-index:99999;' +
          'background:#e53e3e;color:#fff;font:600 13px/1.3 system-ui,-apple-system,sans-serif;' +
          'padding:8px 14px;border-radius:20px;box-shadow:0 2px 12px rgba(0,0,0,.3);' +
          'display:none;cursor:pointer;align-items:center;gap:6px;user-select:none;';
        badgeEl.title = 'Clique para ir ao WhatsApp';
        badgeEl.addEventListener('click', function () {
          window.location.href = '/whatsapp.html';
        });
        document.body.appendChild(badgeEl);
        return badgeEl;
      }

      var styleEl = document.createElement('style');
      styleEl.textContent = '@keyframes sdrWaitPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.08);}}';
      document.head.appendChild(styleEl);

      var lastIds = [];
      function poll() {
        fetch('/whatsapp-api/api/conversations', { headers: { Authorization: 'Bearer ' + token } })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            if (!data || !data.conversations) return;
            var mine = data.conversations.filter(function (c) {
              return c.last_sent_by === 'lead' && c.deal_owner_name === user.name;
            });
            var badge = ensureBadge();
            if (mine.length > 0) {
              var isNew = mine.some(function (c) { return lastIds.indexOf(c.id) === -1; });
              badge.style.display = 'flex';
              badge.textContent = '⚠ ' + mine.length + (mine.length > 1 ? ' leads aguardando resposta' : ' lead aguardando resposta');
              if (isNew) {
                badge.style.animation = 'none';
                void badge.offsetWidth;
                badge.style.animation = 'sdrWaitPulse 0.6s ease-in-out 2';
              }
              lastIds = mine.map(function (c) { return c.id; });
            } else {
              badge.style.display = 'none';
              lastIds = [];
            }
          })
          .catch(function () {});
      }

      poll();
      setInterval(poll, 20000);
    } catch (e) {}
  }

  if (document.body) initSdrWaitAlert();
  else document.addEventListener('DOMContentLoaded', initSdrWaitAlert);
})();
