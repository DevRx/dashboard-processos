"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"


export function NovoProcesso() {


  const [processo, setProcesso] = useState({
    beneficio: "",
    numero: "",
    status: "",
    responsavel: "",
    data: "",
    observacoes: "",
  })


  function salvarProcesso() {

    console.log(processo)

    alert("Processo salvo com sucesso!")

  }



  return (

    <Card className="mt-6">


      <CardHeader>

        <CardTitle>
          Novo Processo
        </CardTitle>

      </CardHeader>



      <CardContent className="flex flex-col gap-4">



        <Input
          placeholder="Tipo de benefício"
          value={processo.beneficio}
          onChange={(e) =>
            setProcesso({
              ...processo,
              beneficio: e.target.value
            })
          }
        />



        <Input
          placeholder="Número do processo"
          value={processo.numero}
          onChange={(e) =>
            setProcesso({
              ...processo,
              numero: e.target.value
            })
          }
        />



        <Input
          placeholder="Status"
          value={processo.status}
          onChange={(e) =>
            setProcesso({
              ...processo,
              status: e.target.value
            })
          }
        />



        <Input
          placeholder="Responsável"
          value={processo.responsavel}
          onChange={(e) =>
            setProcesso({
              ...processo,
              responsavel: e.target.value
            })
          }
        />



        <Input
          placeholder="Data de entrada"
          value={processo.data}
          onChange={(e) =>
            setProcesso({
              ...processo,
              data: e.target.value
            })
          }
        />



        <Input
          placeholder="Observações"
          value={processo.observacoes}
          onChange={(e) =>
            setProcesso({
              ...processo,
              observacoes: e.target.value
            })
          }
        />



        <Button
          onClick={salvarProcesso}
        >
          Salvar Processo
        </Button>



      </CardContent>


    </Card>

  )

}