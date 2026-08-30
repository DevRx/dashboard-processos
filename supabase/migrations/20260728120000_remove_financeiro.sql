-- ─────────────────────────────────────────────────────────
-- Remoção do módulo Financeiro
--
-- O escritório não usa o controle de lançamentos, então a tabela sai
-- inteira em vez de ficar como peso morto guardando dado que ninguém
-- alimenta. O `cascade` leva junto o índice e o trigger de updated_at
-- que pendiam dela; o tipo enum é órfão depois disso e cai em seguida.
-- ─────────────────────────────────────────────────────────

drop table if exists "lancamentos_financeiros" cascade;

drop type if exists "LancamentoTipo";
