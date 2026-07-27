-- ─────────────────────────────────────────────────────────
-- Arquivo da procuração
--
-- A base legal guardava só uma referência em texto ("ad judicia de
-- 12/03/2026"). Numa fiscalização isso é afirmação sem lastro: o que
-- prova o exercício regular de direitos é o documento. Agora o PDF
-- fica anexado à própria base legal que ele sustenta.
-- ─────────────────────────────────────────────────────────

alter table "consentimentos_lgpd"
  -- Caminho no bucket, não URL: URL de bucket privado expira, e
  -- guardar uma URL assinada no banco a deixaria vencida e inútil.
  add column "procuracao_arquivo" text,
  -- Nome original, para o operador reconhecer o que anexou.
  add column "procuracao_nome" text;

-- Bucket privado. A procuração traz CPF, endereço e assinatura do
-- titular: publico seria vazamento por link. O acesso passa sempre por
-- URL assinada de curta duração, emitida no servidor depois de
-- conferir de quem é o documento.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('procuracoes', 'procuracoes', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
