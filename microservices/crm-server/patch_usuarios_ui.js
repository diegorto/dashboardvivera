const fs = require('fs');
const file = 'public/dashboard.html';
let src = fs.readFileSync(file, 'utf8');

// 1. Sidebar links
const navOld = `<div class="sb-group-label">Diretoria</div>
<a class="sb-sub" href="dashboard.html#diretoria">Diretoria</a>
</div>`;
const navNew = `<div class="sb-group-label">Diretoria</div>
<a class="sb-sub" href="dashboard.html#diretoria">Diretoria</a>
<div class="sb-group-label" id="sbAdminLabel" style="display:none">Administracao</div>
<a class="sb-sub" href="dashboard.html#usuarios" id="sbAdminUsersLink" style="display:none">Usuarios</a>
</div>
<script>(function(){ try { var u = JSON.parse(localStorage.getItem('crm_user')||'null'); if (u && u.role === 'admin') { document.getElementById('sbAdminLabel').style.display=''; document.getElementById('sbAdminUsersLink').style.display=''; } } catch(e){} })();</script>`;
if (!src.includes(navOld)) { console.error('NAV_OLD_NOT_FOUND'); process.exit(1); }
src = src.replace(navOld, navNew);

// 2. TAB_TITLES
const tabTitlesOld = `whatsapp:'WhatsApp Analytics', diretoria:'Diretoria' };`;
const tabTitlesNew = `whatsapp:'WhatsApp Analytics', diretoria:'Diretoria', usuarios:'Usuarios' };`;
if (!src.includes(tabTitlesOld)) { console.error('TABTITLES_OLD_NOT_FOUND'); process.exit(1); }
src = src.replace(tabTitlesOld, tabTitlesNew);

// 3. Tab routing
const routeOld = `} else if (tab === 'diretoria') { loadDiretoria();`;
const routeNew = `} else if (tab === 'usuarios') { loadUsuarios();
} else if (tab === 'diretoria') { loadDiretoria();`;
if (!src.includes(routeOld)) { console.error('ROUTE_OLD_NOT_FOUND'); process.exit(1); }
src = src.replace(routeOld, routeNew);

// 4. Functions - insert right before 'function tableHtml(headers, rows) {'
const funcAnchor = `function tableHtml(headers, rows) {`;
if (!src.includes(funcAnchor)) { console.error('FUNCANCHOR_NOT_FOUND'); process.exit(1); }
const usuariosFuncs = `
var USUARIOS_CACHE = [];
function fmtRole(r){ var m={admin:'Administrador',sdr:'SDR',closer:'Closer',recepcao:'Recepcao'}; return m[r]||r; }
async function loadUsuarios(){
  document.getElementById('tabTitle').textContent = 'Usuarios';
  document.getElementById('tabBody').innerHTML = '<p class="muted">Carregando...</p>';
  try {
    var d = await api('/api/crm/ui/admin/users');
    if (!d || d.success === false) { document.getElementById('tabBody').innerHTML = '<p class="muted">' + ((d&&d.error)||'Acesso restrito.') + '</p>'; return; }
    USUARIOS_CACHE = d.users || [];
    renderUsuarios();
  } catch (e) {
    document.getElementById('tabBody').innerHTML = '<p class="muted">Erro ao carregar.</p>';
  }
}
function renderUsuarios(){
  var html = '<div style="margin-bottom:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;max-width:640px;">';
  html += '<div style="font-weight:600;margin-bottom:8px;">Criar novo usuario</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">';
  html += '<input id="nuName" placeholder="Nome" style="padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;">';
  html += '<input id="nuEmail" placeholder="email@viveracrm.local" style="padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;">';
  html += '<select id="nuRole" style="padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;">' +
    '<option value="sdr">SDR</option><option value="closer">Closer</option><option value="recepcao">Recepcao</option><option value="admin">Administrador</option></select>';
  html += '<button class="btn" onclick="criarUsuario()">Criar (senha temp: 123)</button>';
  html += '</div></div>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr>' +
    '<th style="text-align:left;padding:8px;border-bottom:2px solid #e5e7eb;">Nome</th>' +
    '<th style="text-align:left;padding:8px;border-bottom:2px solid #e5e7eb;">Email</th>' +
    '<th style="text-align:left;padding:8px;border-bottom:2px solid #e5e7eb;">Papel</th>' +
    '<th style="text-align:center;padding:8px;border-bottom:2px solid #e5e7eb;">Ativo</th>' +
    '<th style="text-align:center;padding:8px;border-bottom:2px solid #e5e7eb;">Precisa trocar senha</th>' +
    '<th style="text-align:right;padding:8px;border-bottom:2px solid #e5e7eb;">Acoes</th>' +
    '</tr></thead><tbody>';
  USUARIOS_CACHE.forEach(function(u){
    html += '<tr>' +
      '<td style="padding:8px;border-bottom:1px solid #f3f4f6;">' + u.name + (u.id===1?' (voce)':'') + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #f3f4f6;">' + u.email + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #f3f4f6;">' +
        '<select onchange="mudarPapel(' + u.id + ', this.value)" ' + (u.id===1?'disabled':'') + '>' +
        ['admin','sdr','closer','recepcao'].map(function(r){ return '<option value="'+r+'"'+(r===u.role?' selected':'')+'>'+fmtRole(r)+'</option>'; }).join('') +
        '</select></td>' +
      '<td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:center;">' + (u.active ? 'Sim' : 'Nao') + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:center;">' + (u.must_reset_password ? 'Sim' : 'Nao') + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;white-space:nowrap;">' +
        '<button class="btn" style="font-size:11px;padding:4px 8px;" onclick="resetarSenha(' + u.id + ')">Resetar senha</button> ' +
        (u.id!==1 ? '<button class="btn" style="font-size:11px;padding:4px 8px;" onclick="alternarAtivo(' + u.id + ',' + (u.active?0:1) + ')">' + (u.active?'Desativar':'Ativar') + '</button>' : '') +
      '</td>' +
    '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('tabBody').innerHTML = html;
}
async function criarUsuario(){
  var name = document.getElementById('nuName').value.trim();
  var email = document.getElementById('nuEmail').value.trim();
  var role = document.getElementById('nuRole').value;
  if (!name || !email) { alert('Preencha nome e email'); return; }
  var d = await api('/api/crm/ui/admin/users', { method:'POST', body: JSON.stringify({ name: name, email: email, role: role }) });
  if (!d || d.success === false) { alert((d&&d.error)||'Erro ao criar'); return; }
  alert('Usuario criado. Senha temporaria: ' + d.tempPassword + ' (ele(a) sera obrigado(a) a trocar no primeiro login)');
  loadUsuarios();
}
async function mudarPapel(id, role){
  var d = await api('/api/crm/ui/admin/users/' + id, { method:'PATCH', body: JSON.stringify({ role: role }) });
  if (!d || d.success === false) { alert((d&&d.error)||'Erro'); }
  loadUsuarios();
}
async function alternarAtivo(id, active){
  var d;
  if (!active) { d = await api('/api/crm/ui/admin/users/' + id, { method:'DELETE' }); }
  else { d = await api('/api/crm/ui/admin/users/' + id, { method:'PATCH', body: JSON.stringify({ active: 1 }) }); }
  if (!d || d.success === false) { alert((d&&d.error)||'Erro'); }
  loadUsuarios();
}
async function resetarSenha(id){
  if (!confirm('Resetar a senha para 123 (a pessoa sera obrigada a trocar no proximo login)?')) return;
  var d = await api('/api/crm/ui/admin/users/' + id + '/reset-password', { method:'POST' });
  if (!d || d.success === false) { alert((d&&d.error)||'Erro'); return; }
  alert('Senha resetada para: ' + d.tempPassword);
  loadUsuarios();
}
`;
src = src.replace(funcAnchor, usuariosFuncs + funcAnchor);

fs.writeFileSync(file, src);
console.log('USUARIOS_UI_PATCHED_OK');
