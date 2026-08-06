# Correcao de responsividade mobile (2026-08-06)

Problema reportado: CRM quebrado no celular (sidebar ocupando quase toda a
tela, conteudo cortado, painel de detalhes do lead sobrepondo o resto).

## O que foi feito

1. **Sidebar (public/app.css)**: a sidebar fixa de 76px agora vira um menu
   retratil ("drawer") em telas <=860px, acionado por um botao "Menu" fixo
   no topo esquerdo. Fecha ao tocar fora (backdrop) ou ao clicar de novo.
   Aplicado em todas as paginas com sidebar: board, pessoas, whatsapp,
   dashboard, index, agenda, agenda-visual, detail, duplicados, stalled.

2. **Topbar/nav**: em mobile a barra superior quebra em linhas, os links de
   navegacao (Lista/Kanban/Conversas Paradas/Agenda etc.) ganham scroll
   horizontal proprio em vez de espremer o layout.

3. **Painel de detalhes do lead (Conversas/WhatsApp)**: o painel lateral
   `#leadSidebar` (largura fixa 280px, que causava overflow/sobreposicao em
   mobile) agora vira um overlay em tela cheia com botao de fechar (X) em
   telas <=768px. Fica escondido ate o usuario abrir os detalhes de um lead.

4. **Tabelas (Pessoas)**: o `.card` que envolve a tabela ganhou scroll
   horizontal proprio em mobile, entao a tabela nao estoura mais a pagina.

5. **Dashboard**: grid de KPIs (que ja tinha 1 breakpoint para 2 colunas)
   ganhou um segundo breakpoint para 1 coluna em telas muito pequenas
   (<=480px), incluindo a aba "Publico".

## Onde

- CSS compartilhado: `public/app.css` (bloco no final do arquivo, marcado
  "Mobile responsiveness additions").
- HTML: botao de menu + backdrop inseridos antes da `<div class="crm-sidebar">`
  em cada pagina.
- `public/whatsapp.html`: botao de fechar do painel de lead + pequeno ajuste
  de JS (`renderLeadSidebar`) para marcar `document.body` com a classe
  `lead-sidebar-open` quando o painel e exibido.

## Testado

Simulado com iframe em ~390px de largura (equivalente a iPhone) nas telas:
Negocios (Kanban), Pessoas, WhatsApp/Conversas (lista + chat + painel do
lead), Dashboard (incluindo aba Publico). Sem erros no console. Desktop
(>860px) permanece identico ao layout anterior.

Commit: ver historico do git ("fix: responsividade mobile do CRM").
