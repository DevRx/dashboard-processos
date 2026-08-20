// Seed para o banco Postgres local (desenvolvimento/demonstração).
// Espelha lib/seed.ts, mas grava via Prisma em vez da API REST do Supabase.
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Iniciando seed local...")

  const [adminPassword, advogadoPassword, assistentePassword] = await Promise.all([
    bcrypt.hash("admin123", 10),
    bcrypt.hash("advogado123", 10),
    bcrypt.hash("assistente123", 10),
  ])

  const admin = await prisma.user.upsert({
    where: { email: "admin@advocacia.com" },
    update: {},
    create: { name: "Administrador", email: "admin@advocacia.com", password: adminPassword, role: "ADMIN" },
  })

  const advogado = await prisma.user.upsert({
    where: { email: "advogado@advocacia.com" },
    update: {},
    create: { name: "João Advogado", email: "advogado@advocacia.com", password: advogadoPassword, role: "ADVOGADO" },
  })

  await prisma.user.upsert({
    where: { email: "assistente@advocacia.com" },
    update: {},
    create: { name: "Ana Assistente", email: "assistente@advocacia.com", password: assistentePassword, role: "ASSISTENTE" },
  })

  const cliente1 = await prisma.cliente.upsert({
    where: { cpf: "123.456.789-00" },
    update: {},
    create: {
      userId: admin.id,
      nome: "Maria Silva",
      cpf: "123.456.789-00",
      telefone: "(61) 99999-9999",
      beneficio: "Salário-Maternidade",
      email: "maria.silva@email.com",
      endereco: "Rua das Flores, 123 - Brasília/DF",
      dataNascimento: new Date("1985-03-15"),
    },
  })

  const cliente2 = await prisma.cliente.upsert({
    where: { cpf: "987.654.321-00" },
    update: {},
    create: {
      userId: admin.id,
      nome: "Carlos Oliveira",
      cpf: "987.654.321-00",
      telefone: "(61) 98888-8888",
      beneficio: "Aposentadoria",
      email: "carlos.oliveira@email.com",
      endereco: "Rua dos Lírios, 456 - Brasília/DF",
      dataNascimento: new Date("1960-08-22"),
    },
  })

  const jaSemeado = await prisma.processo.count()
  if (jaSemeado > 0) {
    console.log("Processos já existem — nada a inserir.")
    return
  }

  const processo1 = await prisma.processo.create({
    data: {
      userId: admin.id,
      clienteId: cliente1.id,
      beneficio: "Salário-Maternidade",
      numero: "0000000-00",
      status: "AGUARDANDO_INSS",
      responsavelId: advogado.id,
      dataEntrada: new Date("2026-07-23"),
      observacoes: "Aguardando análise do INSS",
      andamentos: {
        create: [
          { userId: admin.id, data: new Date("2026-07-23"), descricao: "Processo distribuído ao INSS", status: "EM_ANALISE" },
          { userId: admin.id, data: new Date("2026-07-24"), descricao: "Aguardando resposta do INSS", status: "AGUARDANDO_INSS" },
        ],
      },
      tarefas: {
        create: [
          {
            userId: admin.id,
            titulo: "Acompanhar protocolo INSS",
            descricao: "Verificar status do protocolo 0000000-00",
            data: new Date("2026-07-25"),
            hora: "10:00",
            prioridade: "ALTA",
            status: "PENDENTE",
          },
        ],
      },
    },
  })

  const processo2 = await prisma.processo.create({
    data: {
      userId: admin.id,
      clienteId: cliente2.id,
      beneficio: "Aposentadoria",
      numero: "0000000-01",
      status: "PERICIA_MARCADA",
      responsavelId: advogado.id,
      dataEntrada: new Date("2026-07-20"),
      observacoes: "Perícia marcada para 25/07/2026",
      andamentos: {
        create: [
          { userId: admin.id, data: new Date("2026-07-20"), descricao: "Processo distribuído", status: "EM_ANALISE" },
          { userId: admin.id, data: new Date("2026-07-22"), descricao: "Perícia marcada para 25/07/2026", status: "PERICIA_MARCADA" },
        ],
      },
    },
  })

  console.log(`Seed concluído: 3 usuários, 2 clientes, 2 processos (${processo1.numero}, ${processo2.numero}).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
