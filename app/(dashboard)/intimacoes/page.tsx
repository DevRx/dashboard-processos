import { redirect } from "next/navigation"

/**
 * As intimações passaram a morar dentro do Judicial — é lá que elas
 * são trabalhadas. O endereço antigo continua de pé porque já estava
 * em links e favoritos do escritório.
 */
export default function IntimacoesAntiga() {
  redirect("/judicial/intimacoes")
}
