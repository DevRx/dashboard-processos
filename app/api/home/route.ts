export async function GET() {
  return new Response(
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Dashboard</title></head><body><h1>Dashboard de Processos</h1><p>A página está carregando.</p></body></html>`,
    {
      headers: { "content-type": "text/html; charset=utf-8" },
    }
  )
}
