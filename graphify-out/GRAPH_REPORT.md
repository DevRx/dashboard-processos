# Graph Report - dashboard-processos  (2026-07-26)

## Corpus Check
- 106 files · ~34,506 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 531 nodes · 1265 edges · 22 communities (15 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `939c5a0f`
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
- datajud.ts

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
- `HomePage()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/(dashboard)/page.tsx → lib/auth.ts
- `HomePage()` --calls--> `toCamelCase()`  [EXTRACTED]
  app/(dashboard)/page.tsx → lib/utils.ts
- `DELETE()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/api/andamentos/[id]/route.ts → lib/auth.ts
- `GET()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/api/auth/me/route.ts → lib/auth.ts
- `DELETE()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/api/clientes/[id]/route.ts → lib/auth.ts

## Import Cycles
- None detected.

## Communities (22 total, 7 thin omitted)

### Community 0 - "data.ts"
Cohesion: 0.06
Nodes (59): AgendaPage(), emptyForm, hojeISO(), emptyForm, emptyForm, FinanceiroPage(), formatBRL(), BASE_LEGAL_CURTO (+51 more)

### Community 1 - "getCurrentUser"
Cohesion: 0.07
Nodes (71): DELETE(), GET(), PUT(), GET(), POST(), GET(), DELETE(), GET() (+63 more)

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
Cohesion: 0.06
Nodes (48): MOTIVO_PARSER_MENSAGEM, POST(), AdapterImportacao, dataBrParaIso(), DocumentoINSS, FonteIntegracao, ModoIntegracao, moedaBrParaNumero() (+40 more)

### Community 11 - "process-table.tsx"
Cohesion: 0.11
Nodes (28): HomePage(), LogoutButton(), formatarData(), ProcessoRecente, ProcessTable(), CLASSES_POR_TOM, StatusBadge(), Tom (+20 more)

### Community 12 - "validators/index.ts"
Cohesion: 0.14
Nodes (13): BaseLegalLGPDEnum, DocumentoINSSEnum, FonteIntegracaoEnum, LancamentoTipoEnum, ProcessoStatusEnum, TarefaPrioridadeEnum, TarefaStatusEnum, UserRoleEnum (+5 more)

### Community 13 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 22 - "datajud.ts"
Cohesion: 0.31
Nodes (8): GET(), MOTIVO_MENSAGEM, consultarProcessoDataJud(), DataJudResultado, detectarEndpoint(), limparNumero(), normalizarData(), TRF_ENDPOINTS

## Knowledge Gaps
- **170 isolated node(s):** `emptyForm`, `emptyForm`, `emptyForm`, `ClienteIntegracao`, `Resumo` (+165 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `getCurrentUser` to `index.ts`, `process-table.tsx`, `datajud.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `toCamelCase()` connect `getCurrentUser` to `index.ts`, `process-table.tsx`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `cn()` connect `process-table.tsx` to `data.ts`, `getCurrentUser`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `emptyForm`, `emptyForm`, `emptyForm` to the rest of the system?**
  _170 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06334735857877513 - nodes in this community are weakly interconnected._
- **Should `getCurrentUser` be split into smaller, more focused modules?**
  _Cohesion score 0.07474276839448651 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._