@AGENTS.md

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Design

Sempre que o assunto for design — layout, cores, tipografia, componentes,
refino visual de qualquer tela —, use as duas skills de design do projeto,
em `.claude/skills/`: **frontend-design** (direção estética, fugir do
visual genérico) e **ui-ux-pro-max** (regras de UX, acessibilidade,
densidade de dashboard; tem busca local em `scripts/search.py`). Leia o
`SKILL.md` das duas antes de mexer na tela. A paleta dos times
(`components/tarefas/cores-time.ts`) e as cores das esferas e da agenda
continuam valendo — são decisão do escritório, não sugestão de skill.
