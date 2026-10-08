import { requireAdmin } from "@/lib/auth"
import { Pagina } from "@/components/layout/pagina"
import { Escritorios } from "@/components/configuracoes/escritorios"

/**
 * Provisionamento de escritórios — só administrador. `requireAdmin`
 * manda quem não é admin de volta pra home antes de renderizar.
 */
export default async function EscritoriosPage() {
  await requireAdmin()

  return (
    <Pagina
      titulo="Escritórios"
      subtitulo="Provisionamento multi-tenant — criar escritório, plano, chave de IA e usuários"
      voltar={{ href: "/configuracoes", rotulo: "Configurações" }}
    >
      <Escritorios />
    </Pagina>
  )
}
