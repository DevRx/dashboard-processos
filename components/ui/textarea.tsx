import * as React from "react"

import { cn } from "@/lib/utils"
import { CLASSES_CAMPO } from "@/components/ui/input"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(CLASSES_CAMPO, "h-auto min-h-20 resize-y py-2 leading-relaxed", className)}
      {...props}
    />
  )
}

export { Textarea }
