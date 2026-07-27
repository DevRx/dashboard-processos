# Graph Report - dashboard-processos  (2026-07-26)

## Corpus Check
- 107 files · ~35,567 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 533 nodes · 1271 edges · 27 communities (20 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d244c942`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- data.ts
- getCurrentUser
- dependencies
- devDependencies
- compilerOptions
- (dashboard)/page.tsx
- components.json
- cn
- layout.tsx
- seed.ts
- index.ts
- process-table.tsx
- validators/index.ts
- README.md
- AGENTS.md
- eslint.config.mjs
- client.ts
- next.config.ts
- postcss.config.mjs
- CLAUDE.md
- agenda/page.tsx
- datajud.ts
- processos/page.tsx
- [id]/page.tsx
- inss/page.tsx
- header.tsx

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 74 edges
2. `toCamelCase()` - 59 edges
3. `cn()` - 38 edges
4. `supabase` - 28 edges
5. `toSnakeCase()` - 25 edges
6. `ipDaRequisicao()` - 16 edges
7. `registrarTratamento()` - 16 edges
8. `compilerOptions` - 16 edges
9. `Card()` - 13 edges
10. `CardContent()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Marca()` --calls--> `cn()`  [EXTRACTED]
  components/layout/sidebar.tsx → lib/utils.ts
- `Navegacao()` --calls--> `cn()`  [EXTRACTED]
  components/layout/sidebar.tsx → lib/utils.ts
- `DELETE()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/api/andamentos/[id]/route.ts → lib/auth.ts
- `GET()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/api/auth/me/route.ts → lib/auth.ts
- `DELETE()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/api/clientes/[id]/route.ts → lib/auth.ts

## Import Cycles
- None detected.

## Communities (27 total, 7 thin omitted)

### Community 0 - "data.ts"
Cohesion: 0.18
Nodes (15): emptyForm, FinanceiroPage(), formatBRL(), TOM_POR_STATUS, MetricCard(), MetricCardProps, Card(), CardContent() (+7 more)

### Community 1 - "getCurrentUser"
Cohesion: 0.07
Nodes (73): DELETE(), GET(), PUT(), GET(), POST(), GET(), DELETE(), GET() (+65 more)

### Community 2 - "dependencies"
Cohesion: 0.05
Nodes (41): @base-ui/react, bcryptjs, class-variance-authority, clsx, effect, jose, lucide-react, next (+33 more)

### Community 3 - "devDependencies"
Cohesion: 0.06
Nodes (30): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, playwright, tailwindcss, @tailwindcss/postcss (+22 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 5 - "(dashboard)/page.tsx"
Cohesion: 0.12
Nodes (17): POST(), POST(), POST(), UserRole, globalForPrisma, createSession(), decrypt(), deleteSession() (+9 more)

### Community 6 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 7 - "cn"
Cohesion: 0.08
Nodes (32): getResumo(), metadata, ResumoEmbedPage(), ProcessosStatusChart(), BASE_LEGAL_OPCOES, BaseLegal, Confirmacao, Consentimento (+24 more)

### Community 8 - "layout.tsx"
Cohesion: 0.33
Nodes (4): metadata, plexMono, plexSans, ThemeProvider()

### Community 10 - "index.ts"
Cohesion: 0.08
Nodes (43): GET(), MOTIVO_MENSAGEM, AdapterImportacao, dataBrParaIso(), DocumentoINSS, FonteIntegracao, ModoIntegracao, moedaBrParaNumero() (+35 more)

### Community 11 - "process-table.tsx"
Cohesion: 0.17
Nodes (19): formatarData(), ProcessoRecente, ProcessTable(), CLASSES_POR_TOM, StatusBadge(), Tom, TOM_POR_STATUS, CardAction() (+11 more)

### Community 12 - "validators/index.ts"
Cohesion: 0.14
Nodes (14): BaseLegalLGPDEnum, DocumentoINSSEnum, EsferaProcessoEnum, FonteIntegracaoEnum, LancamentoTipoEnum, ProcessoStatusEnum, TarefaPrioridadeEnum, TarefaStatusEnum (+6 more)

### Community 13 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 21 - "agenda/page.tsx"
Cohesion: 0.13
Nodes (17): AgendaPage(), emptyForm, hojeISO(), Andamento, Auditoria, Documento, EsferaProcesso, LancamentoTipo (+9 more)

### Community 22 - "datajud.ts"
Cohesion: 0.15
Nodes (13): MOTIVO_PARSER_MENSAGEM, POST(), hashOrigem(), selecionarAdapter(), avaliarBaseLegal(), BASE_LEGAL_LABELS, BaseLegalLGPD, buscarConsentimentoVigente() (+5 more)

### Community 23 - "processos/page.tsx"
Cohesion: 0.23
Nodes (10): emptyForm, Dialog(), DialogClose(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogTitle() (+2 more)

### Community 24 - "[id]/page.tsx"
Cohesion: 0.16
Nodes (10): EmptyState(), Header(), Marca(), MenuGroup, menuGroups, MenuItem, Modo, Navegacao() (+2 more)

### Community 25 - "inss/page.tsx"
Cohesion: 0.23
Nodes (8): BASE_LEGAL_CURTO, ClienteIntegracao, formatarData(), InssPage(), Resumo, KanbanBoard(), prazoInfo(), Badge()

### Community 26 - "header.tsx"
Cohesion: 0.21
Nodes (7): LogoutButton(), iniciais(), MenuUsuario(), ROTULO_POR_PAPEL, Usuario, Button(), ButtonProps

## Knowledge Gaps
- **170 isolated node(s):** `emptyForm`, `emptyForm`, `emptyForm`, `ClienteIntegracao`, `Resumo` (+165 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `getCurrentUser` to `index.ts`, `datajud.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `toCamelCase()` connect `getCurrentUser` to `datajud.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `cn()` connect `process-table.tsx` to `data.ts`, `getCurrentUser`, `processos/page.tsx`, `[id]/page.tsx`, `header.tsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `emptyForm`, `emptyForm`, `emptyForm` to the rest of the system?**
  _170 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `getCurrentUser` be split into smaller, more focused modules?**
  _Cohesion score 0.0728937728937729 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._