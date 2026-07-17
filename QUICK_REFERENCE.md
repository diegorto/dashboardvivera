# ⚡ Quick Reference - Comandos Rápidos

## 🚀 Comece por aqui

```bash
# Sincronizar com Figma Make (puxa designs novos)
git fetch origin && git merge origin/main

# Fazer uma mudança
git add .
git commit -m "descrição"
git push origin claude/reinice-ren84r
```

## 📊 Status & Debug

```bash
git status              # Onde você está
git branch              # Branch atual
git log --oneline -5    # Últimas 5 mudanças
git diff main           # Diferenças com main
```

## 🔄 Merge & Sync

```bash
# Trazer atualizações do Figma Make
git fetch origin main
git merge origin/main

# Preparar para deploy (merge com main)
git checkout main
git merge claude/reinice-ren84r
git push origin main
```

## 🆘 Desfazer

```bash
# Antes de fazer push (desfaz último commit)
git reset --soft HEAD~1

# Desfaz mudanças de um arquivo
git checkout -- arquivo.js

# Volta branch inteira para remoto
git reset --hard origin/claude/reinice-ren84r
```

## 🏗️ Seu Setup

```
📍 Local:  /home/user/dashboardvivera
🔗 Remote: github.com/diegorto/dashboardvivera
🌳 Branch: claude/reinice-ren84r (desenvolvimento)
🎨 Figma:  Conectar em Settings → GitHub
📦 Stack:  Node.js/Express (Backend) + React (Frontend)
🐳 Port:   8000
```

---

**Próximo passo:** Vá no Figma Make → Settings → Connect to GitHub
