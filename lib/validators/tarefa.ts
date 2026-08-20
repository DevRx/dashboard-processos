import { z } from "zod"
import { TarefaStatusEnum, TarefaPrioridadeEnum, TimeTarefaEnum } from "./enums"

export const TarefaSchema = z.object({
  processoId: z.string().optional(),
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  data: z.string().min(1, "Data é obrigatória"),
  hora: z.string().optional(),
  status: TarefaStatusEnum.default("PENDENTE"),
  prioridade: TarefaPrioridadeEnum.default("MEDIA"),
  /// Time e responsável são opcionais: a tarefa nasce em qualquer
  /// tela e só depois entra no quadro. O campo se chama `setor` desde
  /// a migração; o nome na interface é time.
  setor: TimeTarefaEnum.nullish(),
  responsavelId: z.string().nullish(),
})

/**
 * Edição pontual pelo quadro de tarefas — trocar o time, passar para
 * outro responsável, marcar como concluída. Um PUT com o corpo pela
 * metade apagaria data, título e prioridade.
 */
export const TarefaPatchSchema = z
  .object({
    setor: TimeTarefaEnum.nullable().optional(),
    responsavelId: z.string().nullable().optional(),
    status: TarefaStatusEnum.optional(),
    prioridade: TarefaPrioridadeEnum.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Nada para atualizar",
  })
