export async function GET() {
  return new Response(
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Cadastro</title></head><body><h1>Cadastro</h1><p>A rota de cadastro está respondendo.</p></body></html>`,
    {
      headers: { "content-type": "text/html; charset=utf-8" },
    }
  )
}
