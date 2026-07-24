export type Cliente = {
  id: string
  nome: string
  cpf: string
  telefone: string
  beneficio: string
}


export type Processo = {
  id: string
  clienteId: string
  beneficio: string
  numero: string
  status: string
  responsavel: string
  data: string
  observacoes: string
}



export const clientes: Cliente[] = [

  {
    id: "1",
    nome: "Maria Silva",
    cpf: "123.456.789-00",
    telefone: "(61) 99999-9999",
    beneficio: "Salário-Maternidade",
  },


  {
    id: "2",
    nome: "Carlos Oliveira",
    cpf: "987.654.321-00",
    telefone: "(61) 98888-8888",
    beneficio: "Aposentadoria",
  },

]



export const processos: Processo[] = [

  {
    id: "1",
    clienteId: "1",
    beneficio: "Salário-Maternidade",
    numero: "0000000-00",
    status: "Em análise",
    responsavel: "João",
    data: "23/07/2026",
    observacoes: "Aguardando análise do INSS",
  },

]