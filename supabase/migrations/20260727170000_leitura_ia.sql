-- ─────────────────────────────────────────────────────────
-- Leitura de documentos por IA
--
-- Mandar um laudo médico para a Anthropic é tratamento novo: um
-- operador a mais na cadeia (art. 5º, VII) e transferência
-- internacional de dado sensível (art. 33). Isso não cabe no
-- consentimento genérico já dado para consultar Meu INSS e GERID — o
-- titular concordou que o escritório tratasse os dados dele, não que
-- eles saíssem para um terceiro em outro país.
--
-- Por isso uma autorização própria, desligada por padrão. Quem não
-- marcar continua usando o sistema inteiro; só não terá leitura
-- automática.
-- ─────────────────────────────────────────────────────────

alter table "consentimentos_lgpd"
  add column "ia_autorizada" boolean not null default false;

-- ─────────────────────────────────────────────────────────
-- O que a IA leu fica no próprio documento
--
-- Guardar a leitura permite revisar depois o que a máquina entendeu,
-- e não relê-lo a cada abertura da tela — releitura seria custo e
-- envio repetido do dado sensível sem ganho nenhum.
-- ─────────────────────────────────────────────────────────
alter table "documentos"
  -- Resumo em uma frase, para a lista da pasta.
  add column "ia_resumo" text,
  -- Campos extraídos (CID, médico, CRM, prazo de afastamento…).
  add column "ia_campos" jsonb,
  add column "ia_lido_em" timestamp with time zone,
  -- Qual modelo leu: a extração muda entre versões, e sem isso não há
  -- como saber se um campo estranho veio de um modelo antigo.
  add column "ia_modelo" text;

create index "idx_documentos_ia_lido_em" on "documentos"("ia_lido_em");
