import type { Metadata } from "next"
import localFont from "next/font/local"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

// Uma fonte só no sistema inteiro (pedido do Zeca): Inter, em todos os
// pesos — títulos, texto, números de processo e CPF. Antes eram três
// (Inter, Manrope e JetBrains Mono), e a mistura fazia a tela parecer
// remendada. Vem do pacote @fontsource-variable/inter e é servida pelo
// próprio sistema: a build não depende de buscar nada no Google, e o
// que se vê no computador do desenvolvedor é o que vai para o ar. O
// subconjunto latino cobre os acentos do português e a pontuação (›, —).
const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-sans-app",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Zeca Aposenta — Dashboard de Processos",
  description: "Sistema de gestão de processos advocatícios",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable}`}
    >
      <body style={{ margin: 0, minHeight: "100vh" }}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
