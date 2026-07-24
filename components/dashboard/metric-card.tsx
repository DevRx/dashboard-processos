import { Card, CardContent } from "@/components/ui/card"

interface MetricCardProps {
  title: string
  value: string
  description: string
}

export function MetricCard({
  title,
  value,
  description,
}: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground">
          {title}
        </p>

        <h3 className="mt-2 text-3xl font-bold">
          {value}
        </h3>

        <p className="mt-2 text-xs text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  )
}