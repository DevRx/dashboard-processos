-- ─────────────────────────────────────────────────────────
-- 10 clientes de teste, um por benefício
--
-- Para ver o quadro do Administrativo com as sete famílias povoadas
-- sem ter que cadastrar dez pessoas à mão. Cole no SQL Editor do
-- Supabase, ou rode contra o banco local.
--
-- Todos têm "(TESTE)" no nome, e é isso que os torna fáceis de apagar:
-- o bloco no fim deste arquivo remove exatamente estes, e mais nada.
--
-- O `user_id` sai de uma consulta em vez de vir escrito: assim o
-- arquivo funciona em qualquer instalação, sem você precisar procurar
-- o seu id. Cai no ADMIN mais antigo, que é a conta do escritório.
-- ─────────────────────────────────────────────────────────

insert into "clientes" ("user_id", "nome", "cpf", "telefone", "beneficio", "observacoes")
select dono.id, v.nome, v.cpf, v.telefone, v.beneficio, v.observacoes
from (
  select id from "users"
  where role = 'ADMIN'
  order by created_at
  limit 1
) as dono,
(values
  -- APOSENTADORIA (3)
  ('Antônia Ferreira Lima (TESTE)',      '90000000001', '(88) 99100-0001', 'Aposentadoria por idade',                    'Tem CNIS completo. Falta comprovante de residência.'),
  ('Benedito Alves Souza (TESTE)',       '90000000002', '(88) 99100-0002', 'Aposentadoria por tempo de contribuição',    'Período de 1998 a 2003 sem registro — conferir.'),
  ('Cícera Rodrigues Matos (TESTE)',     '90000000003', '(88) 99100-0003', 'Aposentadoria por idade rural',              'Sindicato emitiu a declaração. Falta a autodeclaração.'),
  -- BPC/LOAS — Deficiente (1)
  ('Damião Santos Barbosa (TESTE)',      '90000000004', '(88) 99100-0004', 'BPC/LOAS — pessoa com deficiência',          'Laudo do neurologista anexado. Aguarda perícia social.'),
  -- AUXÍLIO-DOENÇA (2)
  ('Elza Maria da Conceição (TESTE)',    '90000000005', '(88) 99100-0005', 'Auxílio por incapacidade temporária',        'Afastada desde março. Perícia a marcar.'),
  ('Francisco Gomes Teixeira (TESTE)',   '90000000006', '(88) 99100-0006', 'Auxílio por incapacidade temporária',        'Perícia marcada. Levar exames de imagem.'),
  -- PENSÃO (1)
  ('Geralda Pereira Nunes (TESTE)',      '90000000007', '(88) 99100-0007', 'Pensão por morte',                           'Certidão de óbito e casamento na pasta.'),
  -- SALÁRIO-MATERNIDADE (1)
  ('Helena Cristina Duarte (TESTE)',     '90000000008', '(88) 99100-0008', 'Salário-maternidade',                        'Parto em julho. Certidão de nascimento anexada.'),
  -- PROCEDIMENTO ADM. (1)
  ('Izaías Moreira Campos (TESTE)',      '90000000009', '(88) 99100-0009', 'Revisão de benefício',                       'Revisão da vida toda. Cálculo em andamento.'),
  -- OUTROS BENEFÍCIOS (1)
  ('Josefa Andrade Vasconcelos (TESTE)', '90000000010', '(88) 99100-0010', 'BPC/LOAS — idoso',                           'Renda per capita a comprovar. Família de 4.')
) as v(nome, cpf, telefone, beneficio, observacoes)
-- Rodar duas vezes não duplica: o CPF é único, e estes são reservados.
on conflict ("cpf") do nothing;

-- ─────────────────────────────────────────────────────────
-- Requerimentos para 5 deles
--
-- Sem processo, todo cartão mostra "sem processo" e o quadro fica
-- uniforme. Com processo aparecem as etiquetas de estado, e no
-- auxílio-doença a de perícia — que é a única que a equipe troca à mão.
-- Os outros 5 ficam sem, de propósito: é o outro estado que a tela
-- precisa saber mostrar.
-- ─────────────────────────────────────────────────────────

insert into "processos" ("user_id", "cliente_id", "beneficio", "esfera", "status", "situacao_pericia", "protocolo_inss", "data_entrada")
select c.user_id, c.id, c.beneficio, 'ADMINISTRATIVO', v.status::"ProcessoStatus",
       v.pericia::"SituacaoPericia", v.protocolo, v.entrada::date
from "clientes" c
join (values
  ('90000000001', 'AGUARDANDO_INSS',   null,               '1234567890123', '2026-06-10'),
  ('90000000004', 'EM_ANALISE',        null,               '1234567890124', '2026-07-02'),
  ('90000000005', 'EM_ANALISE',        'MARCAR_PERICIA',   '1234567890125', '2026-07-21'),
  ('90000000006', 'PERICIA_MARCADA',   'PERICIA_MARCADA',  '1234567890126', '2026-08-05'),
  ('90000000007', 'BENEFICIO_CONCEDIDO', null,             '1234567890127', '2026-05-14')
) as v(cpf, status, pericia, protocolo, entrada) on v.cpf = c.cpf
where c.nome like '%(TESTE)'
  and not exists (select 1 from "processos" p where p.cliente_id = c.id);

-- ─────────────────────────────────────────────────────────
-- PARA APAGAR DEPOIS — rode só este bloco
--
-- Os processos saem junto por cascade, então uma linha basta. O filtro
-- é o sufixo "(TESTE)": nenhum cliente de verdade tem isso no nome.
-- ─────────────────────────────────────────────────────────
-- delete from "clientes" where "nome" like '%(TESTE)';
