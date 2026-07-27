# Graph Report - dashboard-processos  (2026-07-27)

## Corpus Check
- 125 files · ~47,410 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 612 nodes · 1482 edges · 23 communities (16 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6ad8d32c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
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
- documentos-cliente.tsx
- [id]/page.tsx
- processos/page.tsx
- protocolo/index.ts

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 86 edges
2. `toCamelCase()` - 66 edges
3. `cn()` - 38 edges
4. `supabase` - 34 edges
5. `toSnakeCase()` - 25 edges
6. `ipDaRequisicao()` - 20 edges
7. `registrarTratamento()` - 20 edges
8. `compilerOptions` - 16 edges
9. `POST()` - 14 edges
10. `Card()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --indirect_call--> `texto()`  [INFERRED]
  app/api/documentos/processar/route.ts → lib/integracoes/aplicar.ts
- `TableFooter()` --calls--> `cn()`  [EXTRACTED]
  components/ui/table.tsx → lib/utils.ts
- `TableCaption()` --calls--> `cn()`  [EXTRACTED]
  components/ui/table.tsx → lib/utils.ts
- `HomePage()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/(dashboard)/page.tsx → lib/auth.ts
- `HomePage()` --calls--> `toCamelCase()`  [EXTRACTED]
  app/(dashboard)/page.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (23 total, 7 thin omitted)

### Community 1 - "getCurrentUser"
Cohesion: 0.06
Nodes (81): DELETE(), GET(), PUT(), GET(), POST(), GET(), DELETE(), GET() (+73 more)

### Community 2 - "dependencies"
Cohesion: 0.04
Nodes (47): @anthropic-ai/sdk, @base-ui/react, bcryptjs, class-variance-authority, clsx, effect, jose, lucide-react (+39 more)

### Community 3 - "devDependencies"
Cohesion: 0.06
Nodes (30): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, playwright, tailwindcss, @tailwindcss/postcss (+22 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 5 - "(dashboard)/page.tsx"
Cohesion: 0.09
Nodes (28): POST(), POST(), HomePage(), ProcessosStatusChart(), formatarData(), ProcessoRecente, ProcessTable(), Table() (+20 more)

### Community 6 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 7 - "cn"
Cohesion: 0.08
Nodes (34): getResumo(), metadata, ResumoEmbedPage(), CLASSES_POR_TOM, Tom, TOM_POR_STATUS, BASE_LEGAL_OPCOES, BaseLegal (+26 more)

### Community 8 - "layout.tsx"
Cohesion: 0.33
Nodes (4): metadata, plexMono, plexSans, ThemeProvider()

### Community 10 - "index.ts"
Cohesion: 0.08
Nodes (43): GET(), MOTIVO_MENSAGEM, AdapterImportacao, dataBrParaIso(), DocumentoINSS, FonteIntegracao, ModoIntegracao, moedaBrParaNumero() (+35 more)

### Community 12 - "validators/index.ts"
Cohesion: 0.10
Nodes (19): POST(), globalForPrisma, RegisterSchema, BaseLegalLGPDEnum, DocumentoINSSEnum, EsferaProcessoEnum, FonteIntegracaoEnum, LancamentoTipoEnum (+11 more)

### Community 13 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 22 - "documentos-cliente.tsx"
Cohesion: 0.07
Nodes (41): MOTIVO_IA_MENSAGEM, POST(), TIPOS_ACEITOS, MOTIVO_PARSER_MENSAGEM, POST(), camposLegiveis(), Documento, DocumentosCliente() (+33 more)

### Community 24 - "[id]/page.tsx"
Cohesion: 0.06
Nodes (74): AgendaPage(), emptyForm, hojeISO(), emptyForm, emptyForm, FinanceiroPage(), formatBRL(), BASE_LEGAL_CURTO (+66 more)

### Community 26 - "processos/page.tsx"
Cohesion: 0.60
Nodes (4): ClienteDetalhe(), ESPECIES_BENEFICIO, isEspecieConhecida(), opcoesEspecie()

### Community 29 - "protocolo/index.ts"
Cohesion: 0.20
Nodes (13): POST(), PreparoProtocolo(), avaliarPreparo(), ClienteParaPreparo, DOCUMENTOS_COMUNS, DOCUMENTOS_POR_ESPECIE, documentosDaEspecie(), Gravidade (+5 more)

## Knowledge Gaps
- **194 isolated node(s):** `emptyForm`, `emptyForm`, `emptyForm`, `ClienteIntegracao`, `Resumo` (+189 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `getCurrentUser` to `index.ts`, `(dashboard)/page.tsx`, `protocolo/index.ts`, `documentos-cliente.tsx`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `toCamelCase()` connect `getCurrentUser` to `(dashboard)/page.tsx`, `protocolo/index.ts`, `documentos-cliente.tsx`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `cn()` connect `[id]/page.tsx` to `getCurrentUser`, `(dashboard)/page.tsx`, `cn`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `emptyForm`, `emptyForm`, `emptyForm` to the rest of the system?**
  _194 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `getCurrentUser` be split into smaller, more focused modules?**
  _Cohesion score 0.06469201296787504 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._