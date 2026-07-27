-- ─────────────────────────────────────────────────────────
-- Documentos do caso com arquivo de verdade
--
-- A tabela `documentos` existia desde o início com uma coluna `url`
-- obrigatória, mas nada no sistema jamais gravou nem leu essa coluna:
-- não havia upload em lugar nenhum. Era infraestrutura morta.
--
-- Agora ela guarda o caminho no bucket privado. `url` continua
-- existindo, para o caso de documento que mora fora (link de sistema
-- de tribunal, por exemplo), mas deixa de ser obrigatória — exigir uma
-- URL de um arquivo que está no storage seria pedir um dado que não
-- existe.
-- ─────────────────────────────────────────────────────────

alter table "documentos"
  alter column "url" drop not null,
  -- Caminho no bucket, não URL: bucket privado só entrega por URL
  -- assinada, que expira. Guardar a assinada aqui a deixaria vencida.
  add column "caminho" text;

-- Documento previdenciário traz laudo médico, CPF e endereço. Público
-- seria vazamento por link; o acesso passa por URL assinada de curta
-- duração, emitida no servidor depois de conferir de quem é o arquivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;
