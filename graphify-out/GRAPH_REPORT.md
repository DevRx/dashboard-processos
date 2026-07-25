# Graph Report - .  (2026-07-25)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 311 nodes · 563 edges · 23 communities (17 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `89f66a4f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 16
- Community 17
- Community 18
- Community 19

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 43 edges
2. `toCamelCase()` - 35 edges
3. `cn()` - 27 edges
4. `compilerOptions` - 16 edges
5. `supabase` - 13 edges
6. `Button()` - 9 edges
7. `Card()` - 9 edges
8. `CardContent()` - 9 edges
9. `Sidebar()` - 7 edges
10. `CardHeader()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `CardDescription()` --calls--> `cn()`  [EXTRACTED]
  components/ui/card.tsx → lib/utils.ts
- `CardAction()` --calls--> `cn()`  [EXTRACTED]
  components/ui/card.tsx → lib/utils.ts
- `CardFooter()` --calls--> `cn()`  [EXTRACTED]
  components/ui/card.tsx → lib/utils.ts
- `DELETE()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/api/andamentos/[id]/route.ts → lib/auth.ts
- `GET()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/api/auth/me/route.ts → lib/auth.ts

## Import Cycles
- None detected.

## Communities (23 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (33): initialClientes, HomePage(), Processos, LogoutButton(), Header(), MetricCard(), MetricCardProps, menuItems (+25 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (43): DELETE(), GET(), PUT(), GET(), POST(), GET(), DELETE(), GET() (+35 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (39): @base-ui/react, bcryptjs, class-variance-authority, clsx, effect, jose, lucide-react, next (+31 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (28): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+20 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (17): POST(), POST(), POST(), UserRole, globalForPrisma, createSession(), decrypt(), deleteSession() (+9 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.16
Nodes (15): DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle(), Table(), TableBody() (+7 more)

## Knowledge Gaps
- **107 isolated node(s):** `initialClientes`, `metadata`, `Processos`, `$schema`, `style` (+102 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 7` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 2` to `Community 3`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `getCurrentUser()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **What connects `initialClientes`, `metadata`, `Processos` to the rest of the system?**
  _107 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07853107344632769 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11513734658094682 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._