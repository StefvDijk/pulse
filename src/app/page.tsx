export default function Home() {
  return (
    <main className="p-8 space-y-8">
      <h1 className="text-3xl font-bold" style={{ color: '#f0f0f5' }}>
        Pulse — Design Tokens
      </h1>

      <section className="space-y-2">
        <h2 className="text-xl" style={{ color: '#8888a0' }}>
          Backgrounds
        </h2>
        <div className="flex gap-4">
          <Swatch bg="#0a0a0f" label="bg-primary" />
          <Swatch bg="#12121a" label="bg-secondary" />
          <Swatch bg="#1a1a2e" label="bg-tertiary" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl" style={{ color: '#8888a0' }}>
          Accents
        </h2>
        <div className="flex gap-4 flex-wrap">
          <Swatch bg="#4f8cff" label="accent-primary" />
          <Swatch bg="#34d399" label="accent-green" />
          <Swatch bg="#fbbf24" label="accent-yellow" />
          <Swatch bg="#f87171" label="accent-red" />
          <Swatch bg="#fb923c" label="accent-orange" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl" style={{ color: '#8888a0' }}>
          Sport kleuren
        </h2>
        <div className="flex gap-4">
          <Swatch bg="#8b5cf6" label="sport-gym" />
          <Swatch bg="#06b6d4" label="sport-running" />
          <Swatch bg="#f59e0b" label="sport-padel" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl" style={{ color: '#8888a0' }}>
          Typografie (Inter)
        </h2>
        <div className="space-y-1" style={{ color: '#f0f0f5' }}>
          <p className="text-xs" style={{ color: '#55556a' }}>
            xs — labels, badges
          </p>
          <p className="text-sm" style={{ color: '#8888a0' }}>
            sm — secondary text
          </p>
          <p className="text-base">base — body text</p>
          <p className="text-lg">lg — sub-headers</p>
          <p className="text-xl">xl — section headers</p>
          <p className="text-2xl">2xl — page headers</p>
          <p className="text-3xl font-bold">3xl — hero numbers (1.24)</p>
        </div>
      </section>
    </main>
  )
}

function Swatch({ bg, label }: { bg: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-20 h-12 rounded-lg border"
        style={{ backgroundColor: bg, borderColor: '#1a1a2e' }}
      />
      <span className="text-xs" style={{ color: '#8888a0' }}>
        {label}
      </span>
    </div>
  )
}
