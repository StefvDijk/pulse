import { ExplainTrigger } from '@/components/explain/ExplainTrigger'

export default function ExplainSmokePage() {
  return (
    <div className="min-h-dvh bg-bg-page p-6">
      <h1 className="mb-6 text-[22px] font-bold text-text-primary">Explain Layer · smoke test</h1>
      <ExplainTrigger
        topic="demo"
        ariaLabel="Open demo-uitleg"
        className="rounded-[22px] border-[0.5px] border-bg-border bg-bg-surface p-[18px]"
      >
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[1.2px] text-text-tertiary">
            Demo-kaart
          </p>
          <p className="text-[22px] font-bold tracking-[-0.4px] text-text-primary">
            Tap om uitleg te openen
          </p>
          <p className="text-footnote text-text-secondary">
            Test van de hele Explain Layer end-to-end.
          </p>
        </div>
      </ExplainTrigger>
    </div>
  )
}
