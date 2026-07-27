import "server-only"
import sharp from "sharp"
import { PDFDocument } from "pdf-lib"

/**
 * Tratamento de imagem e montagem de PDF.
 *
 * Nada aqui usa IA, de propósito. Melhorar contraste e juntar páginas
 * num PDF são operações determinísticas: uma biblioteca faz isso em
 * milissegundos, sempre igual, de graça. Um modelo de linguagem nem
 * produz imagens — pedir isso a ele seria caro, lento e pior.
 *
 * A IA entra depois, para *ler* o que está no documento.
 */

/**
 * Resolução do lado maior.
 *
 * 2000px é meio-termo deliberado: o suficiente para o modelo ler
 * carimbo e letra de médico, sem pagar o teto de 2576px (que custa até
 * ~4784 tokens de visão por página). Laudo é foto de celular, quase
 * sempre acima disso — reduzir também acelera o upload.
 */
const LADO_MAIOR = 2000

/** JPEG a 85 preserva texto legível com arquivo pequeno. */
const QUALIDADE_JPEG = 85

export type PaginaTratada = {
  jpeg: Buffer
  largura: number
  altura: number
  /** Só para a interface poder dizer o que mudou. */
  melhorias: string[]
}

/**
 * Prepara uma foto de documento para leitura.
 *
 * `normalize` estica o histograma, que é o que resgata foto tirada com
 * sombra em cima do papel — o caso mais comum de laudo fotografado no
 * balcão. Escala de cinza porque documento é preto no branco: a cor
 * não carrega informação e só atrapalha o contraste.
 *
 * `rotate()` sem argumento aplica a orientação do EXIF. Sem isso a
 * foto de celular chega deitada, e um documento deitado é bem mais
 * difícil de ler — tanto para a IA quanto para a pessoa.
 */
export async function tratarImagem(entrada: Buffer): Promise<PaginaTratada> {
  const original = sharp(entrada, { failOn: "none" })
  const meta = await original.metadata()

  const melhorias: string[] = []
  let img = sharp(entrada, { failOn: "none" }).rotate()

  if (meta.orientation && meta.orientation !== 1) {
    melhorias.push("orientação corrigida")
  }

  // Caixa quadrada com `fit: inside`: limita o lado maior seja qual
  // for a orientação. Escolher width ou height pelas dimensões do
  // metadado erra quando o EXIF manda girar — aí a rotação troca os
  // lados e o limite acaba aplicado ao lado menor, deixando o maior
  // acima do teto.
  const maior = Math.max(meta.width ?? 0, meta.height ?? 0)
  if (maior > LADO_MAIOR) {
    img = img.resize({
      width: LADO_MAIOR,
      height: LADO_MAIOR,
      fit: "inside",
      withoutEnlargement: true,
    })
    melhorias.push(`reduzida para ${LADO_MAIOR}px`)
  }

  // Cinza + histograma esticado + nitidez: a sequência que mais ajuda
  // em foto de papel. `sharpen` depois do resize, senão amplifica o
  // ruído que a redução já ia eliminar.
  img = img.grayscale().normalize().sharpen()
  melhorias.push("escala de cinza", "contraste normalizado", "nitidez")

  const { data, info } = await img
    .jpeg({ quality: QUALIDADE_JPEG })
    .toBuffer({ resolveWithObject: true })

  return {
    jpeg: data,
    largura: info.width,
    altura: info.height,
    melhorias,
  }
}

/**
 * Junta as páginas tratadas num único PDF.
 *
 * Cada página do PDF fica do tamanho exato da imagem, sem margem: o
 * documento é a imagem, e enquadrar em A4 só criaria borda branca e
 * distorção de proporção.
 */
export async function montarPdf(paginas: PaginaTratada[]): Promise<Buffer> {
  const pdf = await PDFDocument.create()

  for (const pagina of paginas) {
    const imagem = await pdf.embedJpg(pagina.jpeg)
    const folha = pdf.addPage([pagina.largura, pagina.altura])
    folha.drawImage(imagem, {
      x: 0,
      y: 0,
      width: pagina.largura,
      height: pagina.altura,
    })
  }

  pdf.setProducer("Dashboard Processos")
  pdf.setCreationDate(new Date())

  return Buffer.from(await pdf.save())
}

/** Extrai as páginas de um PDF já pronto, para a IA poder lê-las. */
export function ehPdf(mime: string): boolean {
  return mime === "application/pdf"
}
