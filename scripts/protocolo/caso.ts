import { createClient } from "@supabase/supabase-js"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { DadosDoCaso, DocumentoDoCaso } from "./analista"

/**
 * O caso, montado do que o CRM já sabe.
 *
 * Redigitar num JSON o que já está cadastrado é onde o erro entra: um
 * benefício escrito de outro jeito, um período que não confere com o
 * PPP. Aqui o requerimento sai da mesma linha do banco que o resto do
 * escritório enxerga.
 *
 * Os anexos vêm do bucket privado para uma pasta temporária desta
 * máquina — o navegador precisa de arquivo em disco para anexar. A
 * pasta é criada por execução e some com o reinício da máquina.
 */

const BUCKET = "documentos"

function banco() {
  const url = process.env.SUPABASE_URL
  const chave = process.env.SUPABASE_SECRET_KEY

  if (!url || !chave) {
    throw new Error(
      "faltam SUPABASE_URL e SUPABASE_SECRET_KEY. Rode com: node --env-file=.env"
    )
  }

  return createClient(url, chave)
}

export async function montarCaso(processoId: string): Promise<DadosDoCaso> {
  const supabase = banco()

  const { data: processo, error } = await supabase
    .from("processos")
    .select("id, beneficio, observacoes, esfera, cliente:clientes(nome, cpf)")
    .eq("id", processoId)
    .maybeSingle()

  if (error) throw new Error(`não consegui ler o processo: ${error.message}`)
  if (!processo) throw new Error(`processo ${processoId} não existe`)

  const cliente = (Array.isArray(processo.cliente) ? processo.cliente[0] : processo.cliente) as
    | { nome: string; cpf: string | null }
    | undefined

  if (processo.esfera !== "ADMINISTRATIVO") {
    throw new Error(
      `este processo está na esfera ${processo.esfera}. O requerimento no Meu INSS é da esfera administrativa.`
    )
  }

  const { data: linhas } = await supabase
    .from("documentos")
    .select("id, nome, categoria, caminho")
    .eq("processo_id", processoId)
    .not("caminho", "is", null)
    .order("created_at")

  const pasta = mkdtempSync(join(tmpdir(), "protocolo-"))
  const documentos: DocumentoDoCaso[] = []

  for (const [i, linha] of (linhas ?? []).entries()) {
    const caminhoRemoto = linha.caminho as string
    const { data: arquivo, error: erroDownload } = await supabase.storage
      .from(BUCKET)
      .download(caminhoRemoto)

    if (erroDownload || !arquivo) {
      console.warn(`  ⚠ não baixei "${linha.nome}": ${erroDownload?.message ?? "vazio"}`)
      continue
    }

    // O nome no disco não vem do banco: nome de arquivo com barra ou
    // acento vindo de fora é caminho para escrever onde não devia.
    const extensao = caminhoRemoto.split(".").pop()?.slice(0, 5) ?? "pdf"
    const local = join(pasta, `d${i + 1}.${extensao}`)
    writeFileSync(local, Buffer.from(await arquivo.arrayBuffer()))

    documentos.push({
      id: `d${i + 1}`,
      nome: linha.nome as string,
      categoria: linha.categoria as string,
      caminho: local,
    })
  }

  return {
    cliente: cliente?.nome ?? "(cliente sem nome)",
    cpf: cliente?.cpf ?? undefined,
    beneficio: processo.beneficio as string,
    observacoes: (processo.observacoes as string | null) ?? "",
    documentos,
  }
}
