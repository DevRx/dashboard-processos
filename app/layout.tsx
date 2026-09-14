import type { Metadata } from "next"
import { Inter, Manrope, JetBrains_Mono } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

// Inter no corpo (humanista, excelente em tamanhos pequenos), Manrope
// nos títulos (geométrica, fecha bem em pesos altos) e JetBrains Mono
// para número CNJ, CPF, datas e valores. Cobertura latin-ext garante a
// acentuação do português.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans-app",
  display: "swap",
})

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-heading-app",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-mono-app",
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
      className={`${inter.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <body style={{ margin: 0, minHeight: "100vh" }}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
