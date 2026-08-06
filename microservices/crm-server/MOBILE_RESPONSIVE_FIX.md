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

## Update 1 (mesmo dia): onclick inline -> addEventListener

Diego reportou que o botao Menu nao abria no celular real (funcionava em
simulacao de clique). Trocado onclick inline por addEventListener em
<script> (mais resistente a bloqueadores de conteudo/navegadores restritos).
Nao resolveu sozinho.

## Update 2: causa provavel identificada (Chrome iOS / WebKit)

Diego confirmou uso de Chrome no iPhone (motor WebKit). Hipotese: o botao
fica nos primeiros ~48px do topo da tela, zona onde o iOS reconhece o gesto
nativo de pull-to-refresh. Um toque real (com pequeno deslocamento vertical
do dedo) pode ser capturado por esse gesto antes de virar um "click" na
pagina - por isso nunca reproduzi o bug com clique de mouse simulado.

Correcoes aplicadas em public/app.css:
- `overscroll-behavior-y: contain` em html/body (desativa pull-to-refresh
  nativo; suportado desde Safari/WebKit 16, portanto Chrome iOS tambem).
- `touch-action: manipulation` + `-webkit-tap-highlight-color` no botao
  Menu (remove ambiguidade/atraso de gesto no WebKit).
- Botao aumentado para 44x44px (touch target minimo recomendado pela Apple).
- `pointer-events: none` na sidebar/backdrop quando fechados, como
  blindagem extra contra qualquer sobreposicao de hit-test.

Nao foi possivel validar em iPhone fisico (sem acesso a hardware real) -
aguardando novo teste do Diego. Se persistir, proximo passo e pedir uma
gravacao de tela do toque, ou tentar Safari no lugar do Chrome para isolar
se e algo do Chrome iOS especificamente ou do WebKit em geral.
