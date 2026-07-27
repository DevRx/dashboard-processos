# Graph Report - dashboard-processos  (2026-07-27)

## Corpus Check
- 121 files · ~43,360 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 585 nodes · 1413 edges · 30 communities (23 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `eaca295d`
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
- [id]/page.tsx
- documentos-cliente.tsx
- importar/route.ts
- [id]/page.tsx
- agenda/page.tsx
- processos/page.tsx
- cn
- preparo-protocolo.tsx
- protocolo/index.ts

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 84 edges
2. `toCamelCase()` - 64 edges
3. `cn()` - 38 edges
4. `supabase` - 33 edges
5. `toSnakeCase()` - 25 edges
6. `ipDaRequisicao()` - 18 edges
7. `registrarTratamento()` - 18 edges
8. `compilerOptions` - 16 edges
9. `Card()` - 14 edges
10. `CardContent()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/api/lgpd/consentimentos/[id]/procuracao/route.ts → lib/auth.ts
- `Marca()` --calls--> `cn()`  [EXTRACTED]
  components/layout/sidebar.tsx → lib/utils.ts
- `Navegacao()` --calls--> `cn()`  [EXTRACTED]
  components/layout/sidebar.tsx → lib/utils.ts
- `DELETE()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/api/andamentos/[id]/route.ts → lib/auth.ts
- `GET()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/api/auth/me/route.ts → lib/auth.ts

## Import Cycles
- None detected.

## Communities (30 total, 7 thin omitted)

### Community 0 - "data.ts"
Cohesion: 0.25
Nodes (9): emptyForm, Dialog(), DialogClose(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogTitle() (+1 more)

### Community 1 - "getCurrentUser"
Cohesion: 0.09
Nodes (60): DELETE(), GET(), PUT(), GET(), POST(), GET(), DELETE(), GET() (+52 more)

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
Cohesion: 0.07
Nodes (34): POST(), getResumo(), metadata, ResumoEmbedPage(), BASE_LEGAL_OPCOES, BaseLegal, Confirmacao, Consentimento (+26 more)

### Community 8 - "layout.tsx"
Cohesion: 0.33
Nodes (4): metadata, plexMono, plexSans, ThemeProvider()

### Community 10 - "index.ts"
Cohesion: 0.08
Nodes (42): GET(), MOTIVO_MENSAGEM, AdapterImportacao, dataBrParaIso(), FonteIntegracao, ModoIntegracao, moedaBrParaNumero(), normalizarTexto() (+34 more)

### Community 11 - "process-table.tsx"
Cohesion: 0.13
Nodes (13): LogoutButton(), Header(), iniciais(), MenuUsuario(), ROTULO_POR_PAPEL, Usuario, Marca(), MenuGroup (+5 more)

### Community 12 - "validators/index.ts"
Cohesion: 0.12
Nodes (16): BaseLegalLGPDEnum, DocumentoINSSEnum, EsferaProcessoEnum, FonteIntegracaoEnum, LancamentoTipoEnum, ProcessoStatusEnum, TarefaPrioridadeEnum, TarefaStatusEnum (+8 more)

### Community 13 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 21 - "[id]/page.tsx"
Cohesion: 0.23
Nodes (9): BASE_LEGAL_CURTO, ClienteIntegracao, formatarData(), InssPage(), Resumo, EmptyState(), Skeleton(), EsferaProcesso (+1 more)

### Community 22 - "documentos-cliente.tsx"
Cohesion: 0.27
Nodes (11): Documento, DocumentosCliente(), formatarTamanho(), ProcessoOpcao, CATEGORIA_DOCUMENTO_LABELS, CategoriaDocumento, CATEGORIAS_BASICAS, CATEGORIAS_DOCUMENTO (+3 more)

### Community 23 - "importar/route.ts"
Cohesion: 0.09
Nodes (33): MOTIVO_PARSER_MENSAGEM, POST(), GET(), POST(), DELETE(), PATCH(), GET(), POST() (+25 more)

### Community 24 - "[id]/page.tsx"
Cohesion: 0.21
Nodes (13): emptyForm, FinanceiroPage(), formatBRL(), TOM_POR_STATUS, MetricCardProps, Button(), ButtonProps, Card() (+5 more)

### Community 25 - "agenda/page.tsx"
Cohesion: 0.12
Nodes (17): AgendaPage(), emptyForm, hojeISO(), Andamento, Auditoria, Documento, LANCAMENTO_TIPO_LABELS, LANCAMENTO_TIPO_VALUES (+9 more)

### Community 26 - "processos/page.tsx"
Cohesion: 0.60
Nodes (4): ClienteDetalhe(), ESPECIES_BENEFICIO, isEspecieConhecida(), opcoesEspecie()

### Community 27 - "cn"
Cohesion: 0.15
Nodes (22): ProcessosStatusChart(), MetricCard(), formatarData(), ProcessoRecente, ProcessTable(), CLASSES_POR_TOM, StatusBadge(), Tom (+14 more)

### Community 28 - "preparo-protocolo.tsx"
Cohesion: 0.21
Nodes (7): ClientePreparo, ProcessoPreparo, KanbanBoard(), prazoInfo(), Badge(), Processo, User

### Community 29 - "protocolo/index.ts"
Cohesion: 0.20
Nodes (13): POST(), PreparoProtocolo(), avaliarPreparo(), ClienteParaPreparo, DOCUMENTOS_COMUNS, DOCUMENTOS_POR_ESPECIE, documentosDaEspecie(), Gravidade (+5 more)

## Knowledge Gaps
- **183 isolated node(s):** `emptyForm`, `emptyForm`, `emptyForm`, `ClienteIntegracao`, `Resumo` (+178 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `getCurrentUser` to `cn`, `index.ts`, `importar/route.ts`, `cn`, `protocolo/index.ts`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `toCamelCase()` connect `getCurrentUser` to `cn`, `importar/route.ts`, `protocolo/index.ts`, `cn`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `data.ts`, `getCurrentUser`, `process-table.tsx`, `[id]/page.tsx`, `[id]/page.tsx`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `emptyForm`, `emptyForm`, `emptyForm` to the rest of the system?**
  _183 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `getCurrentUser` be split into smaller, more focused modules?**
  _Cohesion score 0.0853625170998632 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._