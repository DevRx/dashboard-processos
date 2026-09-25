import "server-only"

/**
 * Quem é ADMIN por definição do escritório, não por linha no banco.
 *
 * O sistema não tem tela para mudar o papel de alguém, e a conta de
 * quem administra acabou nascendo como USER — o padrão de todo
 * cadastro. Em vez de exigir SQL no Supabase, o login promove quem
 * estiver nesta lista.
 *
 * `ADMIN_EMAILS` (separados por vírgula) substitui a lista inteira.
 * Promover só acontece no login com a senha certa, e criar conta é
 * coisa de ADMIN (ver app/api/auth/register/route.ts): conhecer o
 * e-mail daqui não dá a ninguém um jeito de virar essa pessoa.
 */
const PADRAO = ["joaoguilherme9ccepmg@gmail.com"]

export function ehAdminFixo(email: string) {
  const lista = process.env.ADMIN_EMAILS
    ? process.env.ADMIN_EMAILS.split(",")
    : PADRAO
  const alvo = email.trim().toLowerCase()
  return lista.some((e) => e.trim().toLowerCase() === alvo)
}
