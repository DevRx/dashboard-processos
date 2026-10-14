// O teste em escala usa o cliente "pg", que vem junto com as dependências
// de desenvolvimento local (sem tipos próprios). Só o necessário aqui.
declare module "pg" {
  type Resultado = { rows: any[] } // eslint-disable-line @typescript-eslint/no-explicit-any
  export class Pool {
    constructor(opcoes: { connectionString?: string; max?: number })
    query(sql: string, valores?: unknown[]): Promise<Resultado>
    end(): Promise<void>
  }
  const pg: { Pool: typeof Pool }
  export default pg
}
