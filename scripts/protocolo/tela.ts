import type { Page } from "playwright"

/**
 * O que a tela oferece, em texto que cabe num prompt.
 *
 * Seletor chumbado no código envelhece junto com o site: o INSS troca
 * um `id` e o robô passa a preencher o campo errado, ou nenhum. Aqui o
 * código não decide onde vai cada coisa — ele descreve a tela e entrega
 * a decisão para a análise.
 *
 * Cada elemento recebe um `ref` próprio, gravado no DOM. É por ele que
 * a ação volta a encontrar o elemento depois, sem depender de texto ou
 * posição, que mudam entre a leitura e o clique.
 */

export type ElementoDaTela = {
  ref: string
  tag: string
  tipo: string
  rotulo: string
  placeholder: string
  textoVisivel: string
  valorAtual: string
  opcoes?: string[]
  obrigatorio: boolean
}

export type Tela = {
  url: string
  titulo: string
  cabecalhos: string[]
  elementos: ElementoDaTela[]
}

/** Teto de elementos enviados. Tela de governo tem rodapé enorme. */
const LIMITE = 60

export async function lerTela(page: Page): Promise<Tela> {
  // Tudo abaixo roda dentro do navegador. Sem funções auxiliares
  // nomeadas: o transpilador (tsx/esbuild) injeta um `__name` nelas que
  // não existe do lado da página, e a leitura morre com
  // "__name is not defined" — erro que não diz nada sobre a causa.
  return page.evaluate((limite) => {
    const alvos: HTMLElement[] = []

    for (const e of Array.from(
      document.querySelectorAll<HTMLElement>(
        "input, textarea, select, button, a[href], [role=button], [role=link]"
      )
    )) {
      const r = e.getBoundingClientRect()
      const s = getComputedStyle(e)
      if (r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none") {
        alvos.push(e)
      }
    }

    const elementos = alvos.slice(0, limite).map((e, i) => {
      const ref = `e${i + 1}`
      e.setAttribute("data-ref-protocolo", ref)
      const el = e as HTMLInputElement & HTMLSelectElement

      // rótulo: <label for>, aria-label, aria-labelledby, label em volta
      let rotulo = el.labels?.[0]?.textContent?.trim() ?? ""
      if (!rotulo) rotulo = e.getAttribute("aria-label")?.trim() ?? ""
      if (!rotulo) {
        const idRef = e.getAttribute("aria-labelledby")
        if (idRef) rotulo = document.getElementById(idRef)?.textContent?.trim() ?? ""
      }
      if (!rotulo) rotulo = e.closest("label")?.textContent?.trim() ?? ""

      const opcoes =
        e.tagName === "SELECT"
          ? Array.from(el.options)
              .slice(0, 40)
              .map((o) => o.text.trim())
          : undefined

      return {
        ref,
        tag: e.tagName.toLowerCase(),
        tipo: (el.type || e.getAttribute("role") || "").toLowerCase(),
        rotulo: rotulo.slice(0, 120),
        placeholder: (el.placeholder ?? "").slice(0, 120),
        textoVisivel: (e.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 120),
        valorAtual: typeof el.value === "string" ? el.value.slice(0, 80) : "",
        opcoes,
        obrigatorio: el.required === true || e.getAttribute("aria-required") === "true",
      }
    })

    const cabecalhos: string[] = []
    for (const h of Array.from(document.querySelectorAll("h1, h2, h3"))) {
      const r = h.getBoundingClientRect()
      if (r.width > 0 && r.height > 0 && cabecalhos.length < 8) {
        cabecalhos.push((h.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 120))
      }
    }

    return { url: location.href, titulo: document.title, cabecalhos, elementos }
  }, LIMITE)
}

/**
 * A tela como ela se parece.
 *
 * A lista de elementos diz o que existe; a imagem diz o que a pessoa
 * veria. Num formulário de governo isso não é redundância: rótulo que
 * mora num `<div>` ao lado, campo agrupado por moldura, aviso em
 * vermelho — nada disso aparece na árvore de acessibilidade, e é
 * exatamente o que decide onde vai cada dado.
 *
 * Só a área visível, não a página inteira: o rodapé institucional do
 * INSS é alto e não ajuda a preencher nada.
 */
export async function capturarTela(page: Page): Promise<string> {
  const png = await page.screenshot({ fullPage: false, type: "png" })
  return png.toString("base64")
}

/** Reencontra pelo `ref` gravado na leitura. */
export function porRef(page: Page, ref: string) {
  return page.locator(`[data-ref-protocolo="${ref}"]`)
}

/** Versão curta da tela, para caber no prompt sem ruído. */
export function telaEmTexto(tela: Tela): string {
  const linhas = tela.elementos.map((e) => {
    const partes = [
      `${e.ref}`,
      `<${e.tag}${e.tipo ? ` ${e.tipo}` : ""}>`,
      e.rotulo ? `rótulo="${e.rotulo}"` : null,
      e.placeholder ? `placeholder="${e.placeholder}"` : null,
      e.textoVisivel && e.textoVisivel !== e.rotulo ? `texto="${e.textoVisivel}"` : null,
      e.valorAtual ? `valor-atual="${e.valorAtual}"` : null,
      e.opcoes ? `opções=[${e.opcoes.join(" | ")}]` : null,
      e.obrigatorio ? "obrigatório" : null,
    ].filter(Boolean)
    return "  " + partes.join(" ")
  })

  return [
    `URL: ${tela.url}`,
    `Título: ${tela.titulo}`,
    tela.cabecalhos.length ? `Cabeçalhos: ${tela.cabecalhos.join(" · ")}` : "",
    "",
    "Elementos:",
    ...linhas,
  ]
    .filter(Boolean)
    .join("\n")
}
