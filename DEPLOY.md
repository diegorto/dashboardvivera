# 🚀 Deploy Dashboard para Hostinger

Script automático para fazer upload do `dashboard.html` para o Hostinger via SFTP.

## ⚙️ Instalação

### 1. Instalar dependência
```bash
pip install paramiko
```

Ou usando requirements.txt:
```bash
pip install -r requirements.txt
```

## 🚀 Como usar

### 1. Preparar credenciais Hostinger
Você vai precisar de:
- **Host SFTP**: `sftp.seudominio.com.br`
- **Usuário FTP**: Encontre no painel Hostinger
- **Senha FTP**: Encontre no painel Hostinger

⚠️ **Não use FTP comum, sempre use SFTP!**

### 2. Executar o script
```bash
python3 deploy.py
```

### 3. Seguir as instruções
O script vai pedir:
1. ✅ Host SFTP
2. ✅ Usuário FTP
3. ✅ Senha FTP
4. ✅ Caminho remoto (ex: `/public_html/crc/`)
5. ✅ Confirmação final

## 📝 Exemplo de execução

```
============================================================
🚀 DEPLOY DASHBOARD - VIVERA ORAL-FACIAL
============================================================

📝 Credenciais Hostinger (encontre no painel de controle)
------------------------------------------------------------
Host SFTP (ex: sftp.seudominio.com.br): sftp.viveraorfacial.com.br
Usuário FTP: meu_usuario
Senha FTP: 

📂 Arquivo local: /home/user/dashboardvivera/dashboard.html
   Tamanho: 85.32 KB

📂 Caminho remoto (ex: /public_html/crc/): /public_html/crc/

============================================================
📋 Resumo do Deploy:
============================================================
Host: sftp.viveraorfacial.com.br
Usuário: meu_usuario
Arquivo local: /home/user/dashboardvivera/dashboard.html
Diretório remoto: /public_html/crc/
============================================================

✅ Deseja continuar? (s/n): s

🔗 Testando conexão SFTP...
✅ Conexão SFTP estabelecida com sucesso!

📤 Enviando arquivo...
   De: /home/user/dashboardvivera/dashboard.html
   Para: /public_html/crc/dashboard.html
   [████████████████████████████████████████] 100.0%

✅ Upload concluído com sucesso!
   Arquivo remoto: /public_html/crc/dashboard.html
   Tamanho: 85.32 KB

🔐 Permissões definidas: 644

============================================================
🎉 DEPLOY COMPLETO!
============================================================
Digite seu domínio (ex: viveraorfacial.com.br): viveraorfacial.com.br

🌐 URL do Dashboard: https://viveraorfacial.com.br/crc/dashboard.html
============================================================
```

## ✅ Verificação

Após o deploy, acesse:
```
https://seudominio.com.br/crc/dashboard.html
```

## 🔧 Troubleshooting

### ❌ "Credenciais inválidas"
- Verifique usuário e senha no painel Hostinger
- Certifique-se que está usando SFTP (não FTP)

### ❌ "Diretório não encontrado"
- O script tenta criar `/crc/` automaticamente
- Se falhar, crie manualmente no cPanel > File Manager

### ❌ "Erro de conexão"
- Verifique se SFTP está habilitado na sua conta Hostinger
- Suporte Hostinger: [chat.hostinger.com](https://chat.hostinger.com)

## 📋 Credenciais Hostinger

Onde encontrar:

1. **Host SFTP**:
   - Painel > Contas > FTP/SFTP
   - Copie o "Host do servidor"

2. **Usuário FTP**:
   - Painel > Contas > FTP/SFTP
   - Campo "Usuário"

3. **Senha FTP**:
   - Painel > Contas > FTP/SFTP
   - Botão "Mostrar senha"

## 🔐 Segurança

✅ A senha **não é salva** em lugar nenhum
✅ O script usa **SFTP** (SSH seguro), não FTP comum
✅ Arquivo é enviado com permissões **644** (seguro)

## 📞 Suporte

Se tiver problemas:
1. Verifique as credenciais
2. Teste conexão SFTP em outro cliente (Filezilla)
3. Contate suporte Hostinger

---

**Dashboard criado com ❤️ para Vivera Oral-Facial**
