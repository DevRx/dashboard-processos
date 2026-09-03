import { Bell, Building2, Palette, ShieldCheck, UserRound } from "lucide-react"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

/**
 * Preferências do sistema. Por ora a página apresenta as áreas que
 * existirão; o botão de tema já funciona no cabeçalho.
 */
const AREAS = [
  {
    icone: UserRound,
    titulo: "Perfil",
    texto: "Nome, e-mail e senha de acesso.",
  },
  {
    icone: Building2,
    titulo: "Escritório",
    texto: "Dados do escritório, equipe e papéis de cada pessoa.",
  },
  {
    icone: Palette,
    titulo: "Aparência",
    texto: "Tema claro ou escuro — alterne pelo ícone no cabeçalho.",
  },
  {
    icone: Bell,
    titulo: "Notificações",
    texto: "Avisos de intimação, prazo e tarefa atribuída.",
  },
  {
    icone: ShieldCheck,
    titulo: "Privacidade e LGPD",
    texto: "Consentimentos, retenção e portabilidade dos dados dos titulares.",
  },
]

export default function ConfiguracoesPage() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header title="Configurações" subtitle="Preferências do sistema." />
        <main className="flex-1 space-y-5 p-5 md:p-7">
          <p className="max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
            As preferências ainda estão sendo construídas. Abaixo, as áreas
            que este painel vai reunir.
          </p>

          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {AREAS.map((a) => {
              const Icone = a.icone
              return (
                <li
                  key={a.titulo}
                  className="group flex items-start gap-3.5 rounded-2xl bg-card p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-transform duration-200 group-hover:scale-105">
                    <Icone size={18} strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0">
                    <span className="font-heading block text-[14px] font-semibold">
                      {a.titulo}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">
                      {a.texto}
                    </span>
                  </span>
                  <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                    em breve
                  </span>
                </li>
              )
            })}
          </ul>
        </main>
      </div>
    </div>
  )
}
