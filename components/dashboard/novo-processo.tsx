"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"


export function NovoProcesso() {

  return (

    <Card>

      <CardHeader>

        <CardTitle>
          Novo Processo
        </CardTitle>

      </CardHeader>


      <CardContent className="flex flex-col gap-4">


        <Input
          placeholder="Tipo de benefício"
        />


        <Input
          placeholder="Número do processo"
        />


        <Input
          placeholder="Status"
        />


        <Input
          placeholder="Responsável"
        />


        <Input
          placeholder="Data de entrada"
        />


        <Input
          placeholder="Observações"
        />


        <Button>
          Salvar Processo
        </Button>


      </CardContent>


    </Card>

  )
}