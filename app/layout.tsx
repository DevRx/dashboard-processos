import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Dashboard de Processos",
  description: "Sistema de gestão de processos advocatícios",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: "100vh", background: "#f5f5f5" }}>
        {children}
      </body>
    </html>
  )
}
