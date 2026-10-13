-- ─────────────────────────────────────────────────────────
-- Time rosa
--
-- O escritório passou a ter quatro times, nesta ordem: vermelho, azul,
-- amarelo e rosa. O rosa é novo no enum; preto e verde continuam
-- aceitos porque há tarefas antigas gravadas com eles — no quadro elas
-- aparecem na faixa "a classificar" até alguém mover para um dos
-- quatro. Ver lib/domain/tarefa/time.ts.
--
-- Idempotente, como as outras: rode uma vez no SQL Editor do Supabase.
-- Sem ela, mover uma tarefa para o rosa devolve erro.
-- ─────────────────────────────────────────────────────────

alter type "SetorTarefa" add value if not exists 'ROSA';
