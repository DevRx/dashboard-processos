import "dotenv/config"
import bcrypt from "bcryptjs"

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!

async function supabaseFetch(url: string, body: unknown) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "return=representation",
    },
    body: JSON.stringify(body),
  })
  return response.json()
}

async function main() {
  console.log("Iniciando seed...")

  const adminPassword = await bcrypt.hash("admin123", 10)
  const advogadoPassword = await bcrypt.hash("advogado123", 10)
  const assistentePassword = await bcrypt.hash("assistente123", 10)

  const now = new Date().toISOString()
  const uuid = () => crypto.randomUUID()

  // Create admin user
  const [adminUser] = await supabaseFetch("User", {
    id: uuid(),
    name: "Administrador",
    email: "admin@advocacia.com",
    password: adminPassword,
    role: "ADMIN",
    createdAt: now,
    updatedAt: now,
  })

  if (!adminUser) {
    console.error("Failed to create admin user")
    return
  }

  console.log("Admin criado:", adminUser.id)

  // Create advogado
  const [advogadoUser] = await supabaseFetch("User", {
    id: uuid(),
    name: "João Advogado",
    email: "advogado@advocacia.com",
    password: advogadoPassword,
    role: "ADVOGADO",
    createdAt: now,
    updatedAt: now,
  })

  // Create assistente
  const [assistenteUser] = await supabaseFetch("User", {
    id: uuid(),
    name: "Ana Assistente",
    email: "assistente@advocacia.com",
    password: assistentePassword,
    role: "ASSISTENTE",
    createdAt: now,
    updatedAt: now,
  })

  // Create clientes
  const [cliente1] = await supabaseFetch("Cliente", {
    id: uuid(),
    userId: adminUser.id,
    nome: "Maria Silva",
    cpf: "123.456.789-00",
    telefone: "(61) 99999-9999",
    beneficio: "Salário-Maternidade",
    email: "maria.silva@email.com",
    endereco: "Rua das Flores, 123 - Brasília/DF",
    dataNascimento: "1985-03-15",
    createdAt: now,
    updatedAt: now,
  })

  const [cliente2] = await supabaseFetch("Cliente", {
    id: uuid(),
    userId: adminUser.id,
    nome: "Carlos Oliveira",
    cpf: "987.654.321-00",
    telefone: "(61) 98888-8888",
    beneficio: "Aposentadoria",
    email: "carlos.oliveira@email.com",
    endereco: "Rua dos Lírios, 456 - Brasília/DF",
    dataNascimento: "1960-08-22",
    createdAt: now,
    updatedAt: now,
  })

  if (cliente1) {
    const [processo1] = await supabaseFetch("Processo", {
      id: uuid(),
      userId: adminUser.id,
      clienteId: cliente1.id,
      beneficio: "Salário-Maternidade",
      numero: "0000000-00",
      status: "AGUARDANDO_INSS",
      responsavelId: advogadoUser?.id,
      dataEntrada: "2026-07-23",
      observacoes: "Aguardando análise do INSS",
      createdAt: now,
      updatedAt: now,
    })

    if (processo1) {
      await supabaseFetch("Andamento", [
        {
          id: uuid(),
          processoId: processo1.id,
          userId: adminUser.id,
          data: "2026-07-23",
          descricao: "Processo distribuído ao INSS",
          status: "EM_ANALISE",
          createdAt: now,
        },
        {
          id: uuid(),
          processoId: processo1.id,
          userId: adminUser.id,
          data: "2026-07-24",
          descricao: "Aguardando resposta do INSS",
          status: "AGUARDANDO_INSS",
          createdAt: now,
        },
      ])

      await supabaseFetch("Tarefa", {
        id: uuid(),
        userId: adminUser.id,
        processoId: processo1.id,
        titulo: "Acompanhar protocolo INSS",
        descricao: "Verificar status do protocolo 0000000-00",
        data: "2026-07-25",
        hora: "10:00",
        prioridade: "ALTA",
        status: "PENDENTE",
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  if (cliente2) {
    const [processo2] = await supabaseFetch("Processo", {
      id: uuid(),
      userId: adminUser.id,
      clienteId: cliente2.id,
      beneficio: "Aposentadoria",
      numero: "0000000-01",
      status: "PERICIA_MARCADA",
      responsavelId: advogadoUser?.id,
      dataEntrada: "2026-07-20",
      observacoes: "Perícia marcada para 25/07/2026",
      createdAt: now,
      updatedAt: now,
    })

    if (processo2) {
      await supabaseFetch("Andamento", [
        {
          id: uuid(),
          processoId: processo2.id,
          userId: adminUser.id,
          data: "2026-07-20",
          descricao: "Processo distribuído",
          status: "EM_ANALISE",
          createdAt: now,
        },
        {
          id: uuid(),
          processoId: processo2.id,
          userId: adminUser.id,
          data: "2026-07-22",
          descricao: "Perícia marcada para 25/07/2026",
          status: "PERICIA_MARCADA",
          createdAt: now,
        },
      ])
    }
  }

  console.log("Seed concluído com sucesso!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })