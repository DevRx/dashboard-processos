This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Rodando localmente (demonstração)

O app usa Supabase (PostgREST) em quase toda a camada de dados e Prisma no
login. Para demonstrar sem depender de um projeto Supabase na nuvem, o
ambiente local sobe um Postgres embarcado + PostgREST + um gateway que
serve a mesma superfície de API do Supabase.

**Preparação (uma vez):**

```bash
npm install
npm run setup:local     # cria o banco, aplica o schema e insere dados de exemplo
```

**Rodar:**

```bash
npm run dev:local       # Postgres → PostgREST → gateway → Next.js em :3000
```

**Usuários de demonstração:**

| Perfil     | E-mail                     | Senha           |
| ---------- | -------------------------- | --------------- |
| Admin      | admin@advocacia.com        | admin123        |
| Advogado   | advogado@advocacia.com     | advogado123     |
| Assistente | assistente@advocacia.com   | assistente123   |

**Serviços locais:**

| Serviço          | Porta | Observação                                   |
| ---------------- | ----- | -------------------------------------------- |
| Postgres         | 5433  | cluster em `~/.dashboard-processos-pg`       |
| PostgREST        | 3002  | API REST sobre o Postgres                    |
| Gateway Supabase | 54321 | `/rest/v1` e `/storage/v1`                   |
| Next.js          | 3000  | app                                          |

Para parar o banco: `npm run db:local stop`.

> O cluster fica fora da pasta do projeto de propósito: o socket unix do
> Postgres dentro do repositório faz o watcher do Turbopack quebrar.

### Em produção

`.env` aponta para o ambiente local. Para usar um projeto Supabase real,
basta trocar `SUPABASE_URL`/`SUPABASE_SECRET_KEY` e `DATABASE_URL` — nada
no código depende do gateway local.

A tela **Administrativo** guarda a senha do Meu INSS do titular cifrada
(AES-256-GCM). A chave sai de `SENHA_INSS_KEY`; sem ela, é derivada do
`SESSION_SECRET`. Definir `SENHA_INSS_KEY` é o recomendado — assim
girar o segredo de sessão não torna as senhas ilegíveis. Trocar
qualquer uma das duas exige recadastrar as senhas guardadas.

Na tela a senha aparece em claro, junto do CPF: a ferramenta é interna
e os dois existem para serem copiados na hora de protocolar. A cifra
protege o banco e os backups, não a tela. Quem tem papel `USER` recebe
a fila sem as senhas.

As colunas novas dessa tela estão em duas migrações, ambas
idempotentes — em um Supabase real, rode cada SQL uma vez no editor do
projeto:

| Migração | O que cria |
| --- | --- |
| `20260818_ficha_administrativa` | `clientes.senha_meu_inss`, `clientes.observacoes`, `processos.situacao_pericia` |
| `20260818_tarefas_por_setor` | `tarefas.setor`, `tarefas.responsavel_id` |
| `20260818_mapa_atendimento` | `clientes.latitude`, `clientes.longitude` |
| `20260818_comunicacoes_djen` | tabela `comunicacoes_djen` |
| `20260818_analise_intimacao` | colunas `ia_*` em `comunicacoes_djen` |

Os times são identificados por cor (`VERMELHO`, `PRETO`, `AZUL`,
`AMARELO`, `VERDE`). Para dar nome próprio a cada um sem mexer no
banco, edite os rótulos em `lib/domain/tarefa/time.ts`.

A coluna continua se chamando `setor` de propósito: `time` é tipo de
dado no Postgres e viraria uma coluna que só funciona entre aspas. O
nome que a equipe lê — em toda a interface — é **time**.

### Mapa de atendimento

O pin de cada cliente sai do município reconhecido no endereço (texto
livre) — o dicionário desse reconhecimento é
`lib/domain/localizacao/municipios.ts`, hoje com as regiões
administrativas do DF, o entorno e as capitais. Município fora da
lista não vira pin: o cliente aparece em "sem localização", onde
alguém aponta a cidade à mão. Ampliar a cobertura é acrescentar linhas
naquele arquivo.

A coordenada é a do centro da cidade, nunca a do endereço do titular.

O mapa usa Leaflet com tiles do OpenStreetMap, o que significa
requisições do navegador para `tile.openstreetmap.org`. Sem internet,
a página carrega e os pins existem, mas o fundo fica cinza.

### Judicial

A fila judicial (`/judicial`) consulta a **API pública do DataJud
(CNJ)** por número CNJ — a mesma integração que o cadastro de processos
já usava, em `lib/integracoes/datajud.ts`. Ela cobre a Justiça Federal
(TRF1 a TRF6), que é onde tramita a ação previdenciária.

O DataJud entrega dados do processo (classe, órgão julgador,
movimentos). Quem traz as intimações com prazo é o DJEN, na tela
separada abaixo.

### Intimações (DJEN)

Moram dentro do Judicial, em `/judicial/intimacoes` — as duas telas
compartilham as abas "Ações" e "Intimações". O endereço antigo
(`/intimacoes`) redireciona.

A tela consulta a API pública de comunicações do CNJ
(`comunicaapi.pje.jus.br`) pela inscrição na OAB e guarda o resultado
em `comunicacoes_djen`. A tela abre com o que está guardado; a busca
no diário só acontece quando alguém clica.

A OAB consultada sai de `DJEN_OAB_NUMERO` / `DJEN_OAB_UF`
(`lib/integracoes/oab.ts`), e a própria tela permite trocá-la na hora
da busca.

**Sobre o prazo:** o número de dias é lido do texto da publicação por
reconhecimento de padrão, e a data-limite conta dias úteis a partir do
dia útil seguinte à publicação (CPC, arts. 219 e 224). Nem sempre o
prazo do texto é do escritório — por isso a tela mostra o trecho de
onde o número saiu, e a data fica editável. É ferramenta de triagem,
não de contagem oficial.

**Tarefa automática:** com a opção ligada (padrão), toda publicação
nova com prazo já vira tarefa na data do vencimento, com prioridade
pela proximidade — vencendo em até 1 dia ou já vencida entra como
URGENTE, até 3 dias ALTA, o resto MÉDIA. Dá para escolher o time que
recebe essas tarefas. O botão "Criar as N tarefas" cobre os prazos que
ficaram para trás, e nada duplica: cada intimação guarda o id da tarefa
que gerou.

### Calendário forense

`lib/domain/prazo/calendario.ts` é onde ficam os dias em que prazo não
corre. Já vêm prontos os feriados nacionais (incluindo os móveis
derivados da Páscoa) e a suspensão de 20/12 a 20/1 (CPC, art. 220).

**Falta o que é de cada tribunal** — aniversário de cidade, padroeiro,
portaria de suspensão. Duas listas esperam por isso no mesmo arquivo:

- `FERIADOS_TRIBUNAL` — datas soltas, por sigla do DJEN (`"TJDFT"`,
  `"TRF1"`…), ou `"*"` para todos.
- `SUSPENSOES_POR_PERIODO` — intervalos com data inicial e final.

Depois de preencher, use o botão de recalcular na tela de Intimações
(ao lado de "Buscar no DJEN"): ele refaz as datas-limite já gravadas e
remarca as tarefas abertas que vieram delas.

### Rotina automática do DJEN

`/api/cron/djen` faz sozinha o que o botão "Buscar no DJEN" faz: busca
as publicações da OAB, guarda as novas e abre as tarefas dos prazos.
Protegida pelo header `x-cron-secret`, no mesmo padrão do expurgo da
LGPD — sem `DJEN_CRON_SECRET` configurada, a rota recusa tudo.

| Variável | Para que serve |
| --- | --- |
| `DJEN_CRON_SECRET` | Segredo do agendador. Sem ela a rotina não roda. |
| `DJEN_CRON_USER_EMAIL` | Conta que recebe as intimações e as tarefas. Sem ela, o primeiro ADMIN. |
| `DJEN_CRON_TIME` | Time que recebe as tarefas automáticas (opcional). |

Rodar duas vezes no dia não duplica nada: a trava é o `djen_id` único
por usuário, e tarefa só nasce de intimação que ainda não tem uma. É o
que permite agendar com folga — se a máquina estava desligada de
manhã, a passada da tarde faz o mesmo serviço.

**Na Vercel:** `vercel.json` já agenda 11h e 17h UTC (8h e 14h em
Brasília), de segunda a sexta. Configure as variáveis no projeto.

**Na máquina do escritório:** `scripts/cron-djen.sh` chama a rota e
registra o resultado em `~/.dashboard-processos-djen.log`. Para
agendar no macOS, edite `scripts/com.zecaaposenta.djen.plist`
(trocando `CAMINHO_DO_PROJETO`) e:

```bash
cp scripts/com.zecaaposenta.djen.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.zecaaposenta.djen.plist
```

A tela de Intimações mostra quando a rotina passou pela última vez, e
avisa em vermelho se falhou ou se está há três dias sem rodar.

### Leitura da intimação por IA

Cada publicação pode ser lida por modelo (`lib/ia/analista-intimacao.ts`,
mesmo padrão do leitor de laudos) e a triagem aparece no cartão: tipo
do ato, o que aconteceu, o que o escritório precisa fazer, urgência e
alertas ("sob pena de extinção", "perícia é ato personalíssimo").

O campo mais útil é **de quem é o prazo**. A leitura por padrão pega o
número de dias, mas não sabe se aqueles "60 dias corridos" são do INSS
para implantar o benefício ou do advogado para se manifestar. Quando a
IA identifica prazo de outra parte, o cartão marca isso e a tarefa
nasce com prioridade baixa em vez de urgente.

A triagem roda **antes** da criação da tarefa na busca do DJEN — por
isso o título da tarefa vira "Emendar a inicial juntando CNIS" em vez
de "Despacho". Há também o botão "Ler com IA" no cartão e o lote da
faixa superior (até 30 por vez, teto para uma varredura de madrugada
não virar conta surpresa).

**Precisa de `ANTHROPIC_API_KEY` no `.env`.** Sem a chave nada quebra:
a rota responde "IA não configurada" e o resto da tela — busca,
prazos, tarefas, direcionamento — funciona igual.

### Direcionar a intimação para um time

No cartão, os cinco times aparecem como botões coloridos. Um clique
move a tarefa que já existe ou cria a tarefa já naquele time. É o gesto
mais repetido da triagem, então não tem menu nem formulário.
