# Graph Report - dashboard-processos  (2026-07-25)

## Corpus Check
- 82 files · ~19,518 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 380 nodes · 857 edges · 20 communities (12 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8b92a0dc`
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
3. `cn()` - 31 edges
4. `toSnakeCase()` - 25 edges
5. `supabase` - 17 edges
6. `compilerOptions` - 16 edges
7. `Button()` - 11 edges
8. `Card()` - 11 edges
9. `CardContent()` - 11 edges
10. `Sidebar()` - 9 edges

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

## Communities (20 total, 8 thin omitted)

### Community 0 - "data.ts"
Cohesion: 0.07
Nodes (50): AgendaPage(), emptyForm, hojeISO(), emptyForm, emptyForm, FinanceiroPage(), formatBRL(), LogoutButton() (+42 more)

### Community 1 - "getCurrentUser"
Cohesion: 0.11
Nodes (46): DELETE(), GET(), PUT(), GET(), POST(), GET(), DELETE(), GET() (+38 more)

### Community 2 - "dependencies"
Cohesion: 0.05
Nodes (41): @base-ui/react, bcryptjs, class-variance-authority, clsx, effect, jose, lucide-react, next (+33 more)

### Community 3 - "devDependencies"
Cohesion: 0.07
Nodes (28): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+20 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 5 - "(dashboard)/page.tsx"
Cohesion: 0.14
Nodes (17): POST(), POST(), HomePage(), ProcessoRecente, UserRole, createSession(), decrypt(), deleteSession() (+9 more)

### Community 6 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 7 - "cn"
Cohesion: 0.10
Nodes (29): getResumo(), metadata, ResumoEmbedPage(), ProcessosStatusChart(), getStatusVariant(), ProcessTable(), CLASSES_POR_TOM, StatusBadge() (+21 more)

### Community 10 - "index.ts"
Cohesion: 0.19
Nodes (8): POST(), globalForPrisma, RegisterSchema, LancamentoTipoEnum, ProcessoStatusEnum, TarefaPrioridadeEnum, TarefaStatusEnum, UserRoleEnum

### Community 11 - "datajud.ts"
Cohesion: 0.31
Nodes (8): GET(), MOTIVO_MENSAGEM, consultarProcessoDataJud(), DataJudResultado, detectarEndpoint(), limparNumero(), normalizarData(), TRF_ENDPOINTS

### Community 13 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

## Knowledge Gaps
- **117 isolated node(s):** `emptyForm`, `emptyForm`, `emptyForm`, `metadata`, `MOTIVO_MENSAGEM` (+112 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `getCurrentUser` to `datajud.ts`, `(dashboard)/page.tsx`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `data.ts`, `getCurrentUser`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `emptyForm`, `emptyForm`, `emptyForm` to the rest of the system?**
  _117 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07405230678812812 - nodes in this community are weakly interconnected._
- **Should `getCurrentUser` be split into smaller, more focused modules?**
  _Cohesion score 0.11352329262777024 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._