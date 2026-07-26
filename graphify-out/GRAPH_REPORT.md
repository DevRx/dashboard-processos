# Graph Report - dashboard-processos  (2026-07-25)

## Corpus Check
- 82 files · ~19,815 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 386 nodes · 867 edges · 20 communities (13 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `196ac596`
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
- datajud.ts
- README.md
- AGENTS.md
- eslint.config.mjs
- client.ts
- next.config.ts
- postcss.config.mjs
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 54 edges
2. `toCamelCase()` - 43 edges
3. `cn()` - 33 edges
4. `toSnakeCase()` - 25 edges
5. `supabase` - 17 edges
6. `compilerOptions` - 16 edges
7. `Button()` - 11 edges
8. `Card()` - 11 edges
9. `CardContent()` - 11 edges
10. `Sidebar()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `TableFooter()` --calls--> `cn()`  [EXTRACTED]
  components/ui/table.tsx → lib/utils.ts
- `TableCaption()` --calls--> `cn()`  [EXTRACTED]
  components/ui/table.tsx → lib/utils.ts
- `HomePage()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/(dashboard)/page.tsx → lib/auth.ts
- `HomePage()` --calls--> `toCamelCase()`  [EXTRACTED]
  app/(dashboard)/page.tsx → lib/utils.ts
- `DELETE()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/api/andamentos/[id]/route.ts → lib/auth.ts

## Import Cycles
- None detected.

## Communities (20 total, 7 thin omitted)

### Community 0 - "data.ts"
Cohesion: 0.09
Nodes (44): AgendaPage(), emptyForm, hojeISO(), emptyForm, emptyForm, FinanceiroPage(), formatBRL(), LogoutButton() (+36 more)

### Community 1 - "getCurrentUser"
Cohesion: 0.12
Nodes (46): DELETE(), GET(), PUT(), GET(), POST(), GET(), DELETE(), GET() (+38 more)

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
Cohesion: 0.07
Nodes (30): POST(), POST(), HomePage(), Andamento, Auditoria, Documento, LANCAMENTO_TIPO_LABELS, LANCAMENTO_TIPO_VALUES (+22 more)

### Community 6 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 7 - "cn"
Cohesion: 0.10
Nodes (24): getResumo(), metadata, ResumoEmbedPage(), ProcessosStatusChart(), formatarData(), ProcessoRecente, ProcessTable(), CLASSES_POR_TOM (+16 more)

### Community 8 - "layout.tsx"
Cohesion: 0.33
Nodes (4): metadata, plexMono, plexSans, ThemeProvider()

### Community 10 - "index.ts"
Cohesion: 0.18
Nodes (8): POST(), globalForPrisma, RegisterSchema, LancamentoTipoEnum, ProcessoStatusEnum, TarefaPrioridadeEnum, TarefaStatusEnum, UserRoleEnum

### Community 11 - "datajud.ts"
Cohesion: 0.31
Nodes (8): GET(), MOTIVO_MENSAGEM, consultarProcessoDataJud(), DataJudResultado, detectarEndpoint(), limparNumero(), normalizarData(), TRF_ENDPOINTS

### Community 13 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

## Knowledge Gaps
- **122 isolated node(s):** `emptyForm`, `emptyForm`, `emptyForm`, `metadata`, `MOTIVO_MENSAGEM` (+117 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `getCurrentUser` to `datajud.ts`, `(dashboard)/page.tsx`, `cn`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `cn()` connect `data.ts` to `getCurrentUser`, `cn`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `emptyForm`, `emptyForm`, `emptyForm` to the rest of the system?**
  _122 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08807017543859649 - nodes in this community are weakly interconnected._
- **Should `getCurrentUser` be split into smaller, more focused modules?**
  _Cohesion score 0.11608391608391608 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._