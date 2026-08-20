export type FichaCliente = {
  id: string
  nome: string
  cpf: string | null
  criadoEm: string
  observacoes: string | null
  /** Em claro: uso interno. A cifra vale no banco, não na tela. */
  senhaMeuInss: string | null
}

/**
 * Um item da fila é um requerimento. Quando o cliente foi cadastrado
 * com benefício mas ainda não tem processo aberto, `processoId` é
 * nulo — o item existe para ele não sumir da coluna.
 */
export type ItemFila = {
  id: string
  processoId: string | null
  beneficio: string
  status: string | null
  situacaoPericia: string | null
  protocoloInss: string | null
  dataEntrada: string | null
  cliente: FichaCliente
}

/** CPF chega do banco com ou sem máscara, e a coluna precisa alinhar. */
export function formatarCpf(cpf?: string | null) {
  if (!cpf) return null
  const digitos = cpf.replace(/\D/g, "")
  if (digitos.length !== 11) return cpf
  return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
}

export function formatarData(iso?: string | null) {
  if (!iso) return null
  return iso.slice(0, 10).split("-").reverse().join("/")
}
