import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const processos = [
  {
    cliente: "Maria Silva",
    beneficio: "Salário-Maternidade",
    status: "Em análise",
    responsavel: "João",
  },
  {
    cliente: "Carlos Oliveira",
    beneficio: "Aposentadoria",
    status: "Perícia",
    responsavel: "Ana",
  },
  {
    cliente: "Fernanda Souza",
    beneficio: "Auxílio Incapacidade",
    status: "Documentação",
    responsavel: "Pedro",
  },
]

export default function Processos() {
  return (
    <main className="min-h-screen bg-zinc-100 p-6">

      <div className="mb-6">

        <h1 className="text-2xl font-bold">
          Processos
        </h1>

        <p className="text-sm text-muted-foreground">
          Controle dos processos do escritório
        </p>

      </div>


      <Card>

        <CardContent className="p-0">

          <table className="w-full">

            <thead className="bg-zinc-50">

              <tr>

                <th className="p-4 text-left">
                  Cliente
                </th>

                <th className="p-4 text-left">
                  Benefício
                </th>

                <th className="p-4 text-left">
                  Status
                </th>

                <th className="p-4 text-left">
                  Responsável
                </th>

              </tr>

            </thead>


            <tbody>

              {processos.map((processo) => (

                <tr
                  key={processo.cliente}
                  className="border-t"
                >

                  <td className="p-4">
                    {processo.cliente}
                  </td>


                  <td className="p-4">
                    {processo.beneficio}
                  </td>


                  <td className="p-4">

                    <Badge>
                      {processo.status}
                    </Badge>

                  </td>


                  <td className="p-4">
                    {processo.responsavel}
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </CardContent>

      </Card>

    </main>
  )
}