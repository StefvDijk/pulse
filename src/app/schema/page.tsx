import { SchemaPageContent } from '@/components/schema/SchemaPageContent'

export default function SchemaPage() {
  return (
    <div className="flex flex-col gap-6 px-4 pb-24 pt-6">
      <h1 className="text-page-title">Schema</h1>
      <SchemaPageContent />
    </div>
  )
}
