# 🎨 Figma Make + GitHub Integration Guide

## Repositório
- **URL:** https://github.com/diegorto/dashboardvivera
- **Repositório Local:** `/home/user/dashboardvivera`

## Estrutura de Branches

```
main                        ← Sincronizada com Figma Make (Design)
└─ claude/reinice-ren84r   ← Development (Código)
```

## Setup no Figma Make

### 1️⃣ Conectar ao GitHub

1. Abra seu projeto no **Figma Make**
2. Clique em **Settings** ⚙️
3. Procure por **"Connect to GitHub"** ou **"Repository"**
4. Selecione: `diegorto/dashboardvivera`
5. Configure a branch: `main`
6. Salve

### 2️⃣ Entender o fluxo

```
┌─────────────────┐
│   Figma Make    │
│   (Design)      │
└────────┬────────┘
         │
         ├─→ Gera código React/components
         │
         ▼
┌─────────────────┐
│   GitHub Main   │
│   (Auto-sync)   │
└────────┬────────┘
         │
         ├─→ Pull para development
         │
         ▼
┌─────────────────────────────────┐
│ claude/reinice-ren84r           │
│ (Integra + Testa + Melhora)     │
└─────────────────────────────────┘
```

## Workflow Local (CLI)

### Clone do zero (em outro computador)

```bash
git clone https://github.com/diegorto/dashboardvivera.git
cd dashboardvivera
npm install

# Mude para a branch de desenvolvimento
git checkout claude/reinice-ren84r
```

### Sincronizar com Figma Make

```bash
# 1. Trazer alterações do Figma Make (que vão para main)
git fetch origin main
git merge origin/main

# 2. Integrar na sua branch de desenvolvimento
git checkout claude/reinice-ren84r
git pull origin main
# ou
git merge main
```

### Depois de fazer alterações localmente

```bash
# 1. Verificar status
git status

# 2. Adicionar mudanças
git add .

# 3. Commit com mensagem clara
git commit -m "Feature: descrição do que foi feito"

# 4. Push para sua branch de desenvolvimento
git push origin claude/reinice-ren84r
```

### Fazer merge para main (quando pronto para deploy)

```bash
# 1. Ir para main
git checkout main

# 2. Pull para ter a versão mais recente
git pull origin main

# 3. Merge da sua branch de desenvolvimento
git merge claude/reinice-ren84r

# 4. Push para main
git push origin main

# 5. Voltar para desenvolvimento
git checkout claude/reinice-ren84r
```

## Fluxo Completo Recomendado

### Dia a dia - Desenvolvedor

```bash
# No início do dia: sincronizar com Figma Make
git fetch origin
git merge origin/main  # Pega designs novos

# Trabalhar normalmente
# ... (fazer mudanças)

# Fim do dia/quando pronto
git add .
git commit -m "Descrição"
git push origin claude/reinice-ren84r
```

### Quando pronto para deploy

```bash
# 1. Criar uma Release Pull Request em GitHub (opcional, mas recomendado)
# 2. Ou fazer merge direto
git checkout main
git pull origin main
git merge claude/reinice-ren84r
git push origin main

# Depois automaticamente:
# ✅ GitHub Actions faz deploy (via SSH)
# ✅ Figma Make recebe update
```

## Limitações Importantes

### ⚠️ Figma Make + Stack Específico

- ✅ React + Vite (Figma Make nativo)
- ✅ Tailwind CSS (componentes estilizados)
- ⚠️ Node.js/Express (seu backend) - não é gerado pelo Figma Make

**O que isso significa:**
- Figma Make gera **componentes React** (UI)
- Você mantém **Node.js/Express** (API)
- Não há conflito - trabalham juntos

### 📁 Estrutura de Pastas

Depois que Figma Make conectar, ele criará:

```
frontend/                           ← (Figma Make gerencia)
├── src/
│   ├── components/                 ← Componentes do Figma
│   ├── pages/                      ← Páginas do Figma
│   └── styles/                     ← CSS gerado
│
backend/                            ← (Você gerencia)
├── server.js
├── routes/
└── services/
```

## Dicas Importantes

1. **Sempre pull antes de push**
   ```bash
   git pull origin claude/reinice-ren84r
   ```

2. **Use commits descritivos**
   ```bash
   ✅ git commit -m "Feature: adiciona KPI card para receita"
   ❌ git commit -m "fix"
   ```

3. **Resolva conflitos localmente**
   - Se tiver conflito com `main`, resolva antes de fazer push
   - Use VS Code ou seu editor para marcar conflicts

4. **Backup antes de merge**
   ```bash
   git branch backup-$(date +%s)
   git checkout claude/reinice-ren84r
   ```

## Comandos Úteis

```bash
# Ver histórico
git log --oneline -10

# Ver diferenças com main
git diff main..claude/reinice-ren84r

# Desfazer último commit (antes de push)
git reset --soft HEAD~1

# Ver branches remotas
git branch -r

# Deletar branch local
git branch -d nome-branch

# Sincronizar com remoto sem merge
git fetch origin
```

## Status do Setup

- ✅ Repositório clonado em `/home/user/dashboardvivera`
- ✅ Git configurado com remoto correto
- ✅ Branch de desenvolvimento ativa: `claude/reinice-ren84r`
- ⏳ Aguardando: Conexão no Figma Make (faça no Figma)
- 📦 Backend: Port 8000 (Node.js/Express rodando)

## Próximos Passos

1. **No Figma Make:** Conecte o repositório (Settings → GitHub)
2. **Localmente:** Rode `npm install` e `npm start`
3. **GitHub:** Veja os componentes chegando via auto-sync
4. **Integre:** Puxe componentes do Figma, ajuste para APIs do backend

---

**Dúvidas?** Rode:
```bash
git status        # Status atual
git branch -a     # Ver todas branches
git remote -v     # Ver remotos
```
