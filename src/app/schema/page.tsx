import { EmptyState } from '@/components/shared/EmptyState'
import { ClipboardList } from 'lucide-react'

export default function SchemaPage() {
  return (
    <div className="flex flex-col gap-6 px-4 pb-24 pt-6">
      <h1 className="text-page-title">Schema</h1>
      <EmptyState
        icon={<ClipboardList size={40} />}
        title="Trainingsschema's komen binnenkort"
        description="Hier kun je je trainingsschema's bekijken, aanpassen en nieuwe schema's laten genereren door de Coach."
        action={{ label: 'Vraag de Coach', href: '/chat' }}
      />
    </div>
  )
}
