# Graph Report - dashboard-processos  (2026-07-26)

## Corpus Check
- 104 files · ~32,938 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 520 nodes · 1232 edges · 21 communities (14 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f5eb1a46`
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
- validators/index.ts
- README.md
- AGENTS.md
- eslint.config.mjs
- client.ts
- next.config.ts
- postcss.config.mjs
- CLAUDE.md
- importar/route.ts

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 72 edges
2. `toCamelCase()` - 59 edges
3. `cn()` - 38 edges
4. `supabase` - 27 edges
5. `toSnakeCase()` - 25 edges
6. `ipDaRequisicao()` - 16 edges
7. `registrarTratamento()` - 16 edges
8. `compilerOptions` - 16 edges
9. `Card()` - 12 edges
10. `CardContent()` - 12 edges

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

## Communities (21 total, 7 thin omitted)

### Community 0 - "data.ts"
Cohesion: 0.05
Nodes (80): AgendaPage(), emptyForm, hojeISO(), emptyForm, emptyForm, FinanceiroPage(), formatBRL(), HomePage() (+72 more)

### Community 1 - "getCurrentUser"
Cohesion: 0.11
Nodes (48): DELETE(), GET(), PUT(), GET(), POST(), GET(), DELETE(), GET() (+40 more)

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
Nodes (33): getResumo(), metadata, ResumoEmbedPage(), CLASSES_POR_TOM, Tom, TOM_POR_STATUS, BASE_LEGAL_OPCOES, BaseLegal (+25 more)

### Community 8 - "layout.tsx"
Cohesion: 0.33
Nodes (4): metadata, plexMono, plexSans, ThemeProvider()

### Community 10 - "index.ts"
Cohesion: 0.08
Nodes (43): GET(), MOTIVO_MENSAGEM, AdapterImportacao, dataBrParaIso(), DocumentoINSS, FonteIntegracao, ModoIntegracao, moedaBrParaNumero() (+35 more)

### Community 12 - "validators/index.ts"
Cohesion: 0.16
Nodes (12): BaseLegalLGPDEnum, DocumentoINSSEnum, FonteIntegracaoEnum, LancamentoTipoEnum, TarefaPrioridadeEnum, TarefaStatusEnum, UserRoleEnum, ImportacaoInput (+4 more)

### Community 13 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 21 - "importar/route.ts"
Cohesion: 0.08
Nodes (34): POST(), MOTIVO_PARSER_MENSAGEM, POST(), DELETE(), PATCH(), GET(), POST(), POST() (+26 more)

## Knowledge Gaps
- **164 isolated node(s):** `emptyForm`, `emptyForm`, `emptyForm`, `metadata`, `MOTIVO_PARSER_MENSAGEM` (+159 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `getCurrentUser` to `data.ts`, `index.ts`, `importar/route.ts`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `toCamelCase()` connect `getCurrentUser` to `data.ts`, `importar/route.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `cn()` connect `data.ts` to `getCurrentUser`, `cn`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `emptyForm`, `emptyForm`, `emptyForm` to the rest of the system?**
  _164 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `data.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05041286397218601 - nodes in this community are weakly interconnected._
- **Should `getCurrentUser` be split into smaller, more focused modules?**
  _Cohesion score 0.1062374245472837 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._