import { NextRequest, NextResponse } from "next/server"
import { decrypt } from "@/lib/session"

/**
 * Quem entra e quem não entra.
 *
 * A regra é negar por padrão: protegido é tudo, menos o que estiver
 * listado aqui. O caminho contrário — proteger só o que está na lista —
 * fazia cada tela nova nascer aberta até alguém lembrar de registrá-la,
 * e foi assim que /inss, /judicial, /mapa e /tarefas passaram a
 * responder sem sessão. Esquecer a lista agora tranca a tela, que é o
 * lado seguro do esquecimento.
 */

/**
 * Telas de entrada: quem já tem sessão não tem o que fazer nelas.
 *
 * `/register` saiu daqui quando a carteira passou a ser do escritório:
 * a tela de criar conta não pode ficar de frente para a rua se a conta
 * criada enxerga o cliente de todo mundo. Só um ADMIN logado cadastra
 * gente — ver app/api/auth/register/route.ts.
 */
const rotasDeEntrada = ["/login"]

/**
 * Abertas a qualquer um, com ou sem sessão. O /embed existe para ser
 * posto em iframe de terceiro — ver o `frame-ancestors` no
 * next.config.ts —, então não pode depender de cookie nosso nem
 * expulsar quem já está logado.
 */
const rotasAbertas = ["/embed"]

function casa(rotas: string[], pathname: string) {
  return rotas.some(
    (rota) => pathname === rota || pathname.startsWith(rota + "/")
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // As rotas de API cuidam da própria autorização e devolvem 401; passar
  // por aqui só as transformaria em redirect para HTML.
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next()
  }

  // Antes de verificar o cookie: rota aberta não precisa saber quem é.
  if (casa(rotasAbertas, pathname)) {
    return NextResponse.next()
  }

  const payload = await decrypt(request.cookies.get("session")?.value)

  if (casa(rotasDeEntrada, pathname)) {
    return payload
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next()
  }

  if (!payload) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Fora do proxy: as rotas de API, os internos do Next e qualquer
     * caminho com extensão de arquivo. Esse último é o que mantém os
     * arquivos de `public/` — inss-logo.svg, por exemplo — servíveis na
     * tela de login, que é justamente onde não há sessão.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
}
