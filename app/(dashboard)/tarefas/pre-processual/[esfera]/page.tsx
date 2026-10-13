import { redirect } from "next/navigation"

/** Endereço antigo do pré-processual: agora é um lado do amarelo. */
export default async function PreProcessualEsferaPage({
  params,
}: {
  params: Promise<{ esfera: string }>
}) {
  const { esfera } = await params
  if (esfera === "administrativo" || esfera === "judicial") redirect(`/times/amarelo/${esfera}`)
  redirect("/times/amarelo")
}
