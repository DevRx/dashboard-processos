import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 10)
  await db.user.upsert({
    where: { email: "admin@advocacia.com" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@advocacia.com",
      password: adminPassword,
      role: "ADMIN",
    },
  })

  // Create regular user
  const userPassword = await bcrypt.hash("user123", 10)
  await db.user.upsert({
    where: { email: "user@advocacia.com" },
    update: {},
    create: {
      name: "Usuário Teste",
      email: "user@advocacia.com",
      password: userPassword,
      role: "USER",
    },
  })

  // Create sample clientes
  const cliente1 = await db.cliente.upsert({
    where: { id: "1" },
    update: {},
    create: {
      id: "1",
      nome: "Maria Silva",
      cpf: "123.456.789-00",
      telefone: "(61) 99999-9999",
      beneficio: "Salário-Maternidade",
    },
  })

  const cliente2 = await db.cliente.upsert({
    where: { id: "2" },
    update: {},
    create: {
      id: "2",
      nome: "Carlos Oliveira",
      cpf: "987.654.321-00",
      telefone: "(61) 98888-8888",
      beneficio: "Aposentadoria",
    },
  })

  // Create sample processos
  await db.processo.upsert({
    where: { id: "1" },
    update: {},
    create: {
      id: "1",
      clienteId: cliente1.id,
      beneficio: "Salário-Maternidade",
      numero: "0000000-00",
      status: "Em análise",
      responsavel: "João",
      data: "23/07/2026",
      observacoes: "Aguardando análise do INSS",
    },
  })

  await db.processo.upsert({
    where: { id: "2" },
    update: {},
    create: {
      id: "2",
      clienteId: cliente2.id,
      beneficio: "Aposentadoria",
      numero: "0000000-01",
      status: "Perícia marcada",
      responsavel: "Ana",
      data: "20/07/2026",
      observacoes: "Perícia marcada para 25/07/2026",
    },
  })

  console.log("Seed concluído com sucesso!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
