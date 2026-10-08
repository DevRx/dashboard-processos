# Plano — Multi-tenant (vários escritórios, vários usuários)

Status: **aguardando aprovação do Zeca.** Não construído ainda. É o único
bloco que mexe no backend inteiro, então vai para um branch com teste,
não direto na main.

## De onde a gente parte (bom)

O sistema já foi escrito pensando nisso. Toda consulta de dado filtra por
`idsDoEscritorio()` (`lib/escritorio.ts`), e o próprio autor anotou lá:
"se um dia houver mais de um escritório no mesmo banco, esta função é o
único lugar a mudar." Ou seja, o isolamento tem **um chokepoint**, não
cem. E a IA do agente já aceita chave+modelo por escritório
(`responderPergunta({ ia })`). O encaixe existe.

## O que entra

1. **Tabela `escritorios`** + `escritorio_id` em `users`. Cada pessoa
   pertence a um escritório.
2. **`idsDoEscritorio()` passa a filtrar pelo escritório do usuário logado**
   (hoje devolve todos os usuários). Como todas as consultas já usam essa
   função, isso isola clientes, processos, tarefas, documentos, tudo —
   de uma vez, sem caçar query por query.
3. **Config de IA por escritório** (`escritorios.anthropic_key` cifrada no
   padrão do `senha_meu_inss`, `modelo`, `plano`). A rota do agente
   carrega essa config e passa pro `ia` que já existe. É o "traga sua IA":
   a sua chave (opus) fica no seu escritório; cada tenant traz a dele, com
   modelo conforme o plano.
4. **Planos → limites** (nº de usuários, modelo de IA, features). Mapeados
   a partir do rascunho de preços (Essencial/Profissional/Escritório).
5. **Cadastro de escritório** (onboarding) e a virada do seu escritório
   atual (cria 1 escritório e liga os usuários de hoje a ele).

## Isolamento — como garantir

- **Camada 1 (v1, rápida e suficiente):** o filtro por escritório em
  `idsDoEscritorio()`. Como o app acessa o banco com a chave de serviço do
  Supabase, é no código que o isolamento é imposto — e esse código tem um
  ponto só.
- **Camada 2 (endurecimento, depois):** RLS (row-level security) no
  Postgres, pra que nem um bug no app vaze dado entre escritórios. Exige
  trocar o acesso ao banco para o contexto autenticado de cada requisição
  — é mais obra, fica para quando o número de tenants justificar.

## "Só usa IA quem contratou"

Sem chave/plano de IA no escritório, as telas de IA já degradam pro aviso
"configure" (é como o agente e o leitor se comportam hoje). A regra vira:
plano define o modelo; sem plano de IA, as funções de IA ficam off, o
resto funciona.

## Risco e porque vai pra branch

Mexe no caminho de TODA consulta. Um erro aqui não quebra o build — ele
vaza ou esconde dado. Então: branch, migração testada num banco de
teste, e um roteiro de verificação (dois escritórios de mentira, confirmar
que um não vê o outro) antes de ir pra main.

## O que preciso de você (decisões)

- [ ] **Guardar a chave de IA de cada escritório cifrada no banco** (BYO
  key) — ou cada escritório põe no próprio ambiente?
- [ ] **Onboarding de novo escritório**: auto-serviço (o escritório se
  cadastra sozinho) ou você provisiona cada um?
- [ ] **Planos**: confirmar nomes, limites de usuário e o modelo de IA de
  cada um (uso o rascunho de preços como ponto de partida).
- [ ] **Quando**: começo agora (branch + teste) ou depois do piloto rodar
  no seu escritório?
