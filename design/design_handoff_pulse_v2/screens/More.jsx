// Workload, Goals, Trends, Check-in, Settings, WorkoutDetail
const M = () => window.PulseTokens;

// Shared back nav bar
function BackBar({ title }) {
  const t = M();
  return (
    <div style={{ padding: '60px 16px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
      <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
        <path d="M11 2 L3 11 L11 20" stroke="#0A84FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{ color: '#0A84FF', fontSize: 17, letterSpacing: -0.2 }}>Terug</span>
    </div>
  );
}

function PageTitle({ children, sub }) {
  const t = M();
  return (
    <div style={{ padding: '6px 16px 18px' }}>
      <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.8, color: t.text.primary }}>{children}</div>
      {sub && <div style={{ fontSize: 13, color: t.text.tertiary, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─────────── BELASTING / WORKLOAD ───────────
function Workload() {
  const t = M();
  const ratio = 1.18;
  const status = 'optimal'; // low | optimal | warning | danger
  const statusInfo = {
    low: { label: 'Te licht', color: '#8E8E93', dot: '#8E8E93' },
    optimal: { label: 'In balans', color: t.status.good, dot: t.status.good },
    warning: { label: 'Opbouw', color: t.status.warn, dot: t.status.warn },
    danger: { label: 'Overbelast', color: t.status.bad, dot: t.status.bad },
  }[status];

  // Zone bar: 0 - 0.6 - 0.8 - 1.3 - 1.5 - 2.0
  const ratioPct = Math.min(Math.max(ratio / 2.0, 0), 1) * 100;

  // 12-week sparkline data
  const trendData = [0.62, 0.71, 0.85, 0.92, 1.05, 1.12, 0.95, 0.88, 1.02, 1.10, 1.15, 1.18];
  const max = 1.5, min = 0.4;
  const w = 320, h = 88;
  const points = trendData.map((v, i) => {
    const x = (i / (trendData.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div style={{ background: t.bg.page, color: t.text.primary, minHeight: '100%', paddingBottom: 100, fontFamily: t.font }}>
      <BackBar/>
      <PageTitle sub="Acute vs. chronische belasting · laatste 28 dagen">Belasting</PageTitle>

      {/* Big ratio card */}
      <div style={{ margin: '0 16px', padding: 20, background: t.bg.surface, border: `0.5px solid ${t.bg.borderStrong}`, borderRadius: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: statusInfo.color }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusInfo.dot, boxShadow: `0 0 8px ${statusInfo.dot}` }}/>
              {statusInfo.label}
            </div>
            <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -2, marginTop: 8, lineHeight: 1, color: t.text.primary }}>
              {ratio.toFixed(2)}
            </div>
            <div style={{ fontSize: 12, color: t.text.tertiary, marginTop: 4 }}>acute : chronisch ratio</div>
          </div>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(34,214,122,0.15)', border: '1px solid rgba(34,214,122,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(34,214,122,0.3)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M5 12L10 17L19 7" stroke={t.status.good} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* zone bar */}
        <div style={{ marginTop: 22, position: 'relative' }}>
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 1 }}>
            <div style={{ flex: 0.6, background: 'rgba(142,142,147,0.25)' }}/>
            <div style={{ flex: 0.2, background: 'rgba(255,176,32,0.4)' }}/>
            <div style={{ flex: 0.5, background: t.status.good }}/>
            <div style={{ flex: 0.2, background: 'rgba(255,176,32,0.6)' }}/>
            <div style={{ flex: 0.5, background: 'rgba(255,77,109,0.6)' }}/>
          </div>
          {/* indicator */}
          <div style={{
            position: 'absolute', top: -4, left: `${ratioPct}%`, transform: 'translateX(-50%)',
            width: 4, height: 18, background: t.text.primary, borderRadius: 2,
            boxShadow: '0 0 0 3px rgba(0,0,0,0.5)',
          }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: t.text.tertiary, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
            <span>0.6</span><span>0.8</span><span>1.3</span><span>1.5</span>
          </div>
        </div>

        <div style={{ marginTop: 16, fontSize: 13, color: t.text.secondary, lineHeight: 1.5 }}>
          Je totale belasting is 18% hoger dan je 28-daags gemiddelde. Genoeg prikkel om sterker te worden, met ruimte voor herstel.
        </div>
      </div>

      {/* Trend sparkline */}
      <div style={{ margin: '14px 16px 0', padding: 18, background: t.bg.surface, border: `0.5px solid ${t.bg.border}`, borderRadius: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text.primary }}>Trend · 12 weken</div>
          <div style={{ fontSize: 11, color: t.text.tertiary }}>↗ stijgend</div>
        </div>
        <svg viewBox={`-2 -4 ${w + 4} ${h + 8}`} style={{ width: '100%', height: h + 8 }}>
          {/* optimal band */}
          <rect x="0" y={h - ((1.3 - min) / (max - min)) * h} width={w} height={((1.3 - 0.8) / (max - min)) * h} fill="rgba(34,214,122,0.08)"/>
          <line x1="0" x2={w} y1={h - ((1.0 - min) / (max - min)) * h} y2={h - ((1.0 - min) / (max - min)) * h} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3"/>
          <polyline points={points} fill="none" stroke="url(#wlGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <defs>
            <linearGradient id="wlGrad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#7C3AED"/>
              <stop offset="100%" stopColor="#00E5C7"/>
            </linearGradient>
          </defs>
          {/* end dot */}
          <circle cx={w} cy={h - ((trendData[trendData.length - 1] - min) / (max - min)) * h} r="5" fill="#00E5C7"/>
          <circle cx={w} cy={h - ((trendData[trendData.length - 1] - min) / (max - min)) * h} r="9" fill="#00E5C7" opacity="0.25"/>
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: t.text.tertiary, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
          <span>12w</span><span>8w</span><span>4w</span><span>nu</span>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ margin: '14px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Acute (7d)', val: '482', unit: 'load', dir: '↑' },
          { label: 'Chronisch (28d)', val: '408', unit: 'load', dir: '→' },
          { label: 'Sessies (7d)', val: '5', unit: 'van 6', dir: '↑' },
          { label: 'Tonnage', val: '12.4', unit: 'ton', dir: '↑' },
        ].map((s, i) => (
          <div key={i} style={{ padding: 14, background: t.bg.surface, border: `0.5px solid ${t.bg.border}`, borderRadius: 18 }}>
            <div style={{ fontSize: 11, color: t.text.tertiary, fontWeight: 500 }}>{s.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.6 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: t.text.tertiary }}>{s.unit}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Per sport breakdown */}
      <div style={{ margin: '14px 16px 0', padding: 18, background: t.bg.surface, border: `0.5px solid ${t.bg.border}`, borderRadius: 22 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Per sport</div>
        {[
          { sport: 'gym', label: 'Krachttraining', acute: 256, chronic: 220, pct: 116 },
          { sport: 'run', label: 'Hardlopen', acute: 162, chronic: 138, pct: 117 },
          { sport: 'padel', label: 'Padel', acute: 64, chronic: 50, pct: 128 },
        ].map((s, i) => {
          const c = t.sport[s.sport];
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i > 0 ? `0.5px solid ${t.bg.border}` : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: c.light, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: c.base, boxShadow: `0 0 8px ${c.base}` }}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: t.text.tertiary, marginTop: 1 }}>acute {s.acute} · chr. {s.chronic}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: s.pct > 130 ? t.status.warn : t.text.primary }}>
                {s.pct}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────── DOELEN / GOALS ───────────
function Goals() {
  const t = M();
  const goals = [
    { cat: 'kracht', title: 'Bench press 80 kg', current: 72.5, target: 80, unit: 'kg', deadline: '15 jun', sport: 'gym', priority: 1 },
    { cat: 'lopen', title: '10 km onder 50 min', current: 53.2, target: 50, unit: 'min', deadline: '1 mei', sport: 'run', priority: 1, inverse: true },
    { cat: 'kracht', title: 'Squat 1RM 110 kg', current: 95, target: 110, unit: 'kg', deadline: '1 aug', sport: 'gym', priority: 2 },
    { cat: 'gewoonte', title: 'Eiwit ≥ 140g/dag', current: 132, target: 140, unit: 'g', deadline: '4 weken', sport: null, priority: 2 },
    { cat: 'volume', title: 'Maandelijks 60km hardlopen', current: 48, target: 60, unit: 'km', deadline: 'apr', sport: 'run', priority: 3 },
  ];
  const completed = [
    { title: 'Bench press 70 kg', sport: 'gym' },
    { title: '5 km onder 24 min', sport: 'run' },
  ];
  return (
    <div style={{ background: t.bg.page, color: t.text.primary, minHeight: '100%', paddingBottom: 100, fontFamily: t.font }}>
      <div style={{ padding: '60px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.8 }}>Doelen</div>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: '#0A84FF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(10,132,255,0.4)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
        </div>
      </div>
      <div style={{ padding: '4px 16px 16px', fontSize: 13, color: t.text.tertiary }}>5 actief · 2 voltooid dit kwartaal</div>

      {/* Quarter progress summary */}
      <div style={{ margin: '0 16px 14px', padding: 18, background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(0,229,199,0.10))', border: '0.5px solid rgba(124,58,237,0.30)', borderRadius: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: '#A78BFA' }}>Kwartaaldoel</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, marginTop: 4, lineHeight: 1.2 }}>3 PR's behalen<br/>voor de zomer</div>
        <div style={{ marginTop: 14, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: '66%', height: '100%', background: 'linear-gradient(90deg, #7C3AED, #00E5C7)', borderRadius: 4 }}/>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: t.text.tertiary, display: 'flex', justifyContent: 'space-between' }}>
          <span>2 / 3 voltooid</span><span>nog 6 weken</span>
        </div>
      </div>

      {/* Goal list */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {goals.map((g, i) => {
          const c = g.sport ? t.sport[g.sport] : { base: '#A78BFA', light: 'rgba(167,139,250,0.18)' };
          const pct = g.inverse
            ? Math.max(0, Math.min(100, ((g.current - g.target) / (g.current * 0.1)) * -100 + 50))
            : Math.min(100, (g.current / g.target) * 100);
          return (
            <div key={i} style={{ padding: 16, background: t.bg.surface, border: `0.5px solid ${t.bg.border}`, borderRadius: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: c.base, padding: '2px 6px', background: c.light, borderRadius: 4 }}>{g.cat}</div>
                    {g.priority === 1 && <div style={{ fontSize: 10, color: '#FFB020' }}>★ Prio</div>}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: t.text.primary, letterSpacing: -0.2 }}>{g.title}</div>
                </div>
                <div style={{ fontSize: 11, color: t.text.tertiary }}>{g.deadline}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: t.text.primary, fontVariantNumeric: 'tabular-nums' }}>{g.current}</div>
                <div style={{ fontSize: 13, color: t.text.tertiary, fontVariantNumeric: 'tabular-nums' }}>/ {g.target} {g.unit}</div>
                <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: c.base, fontVariantNumeric: 'tabular-nums' }}>{Math.round(pct)}%</div>
              </div>

              <div style={{ marginTop: 8, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: c.base, borderRadius: 3, boxShadow: `0 0 8px ${c.base}` }}/>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed */}
      <div style={{ margin: '20px 16px 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: t.text.tertiary }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2"/></svg>
        Voltooid (2)
      </div>
    </div>
  );
}

// ─────────── TRENDS ───────────
function Trends() {
  const t = M();
  const months = [
    { m: 'Mrt', sessions: 18, km: 32, tonnage: 14.2, prs: 1, current: false },
    { m: 'Apr', sessions: 21, km: 48, tonnage: 16.8, prs: 2, current: true },
  ];
  const quarter = [
    { m: 'Feb', val: 12.4 },
    { m: 'Mrt', val: 14.2 },
    { m: 'Apr', val: 16.8 },
  ];
  const maxQ = Math.max(...quarter.map(q => q.val));

  return (
    <div style={{ background: t.bg.page, color: t.text.primary, minHeight: '100%', paddingBottom: 100, fontFamily: t.font }}>
      <div style={{ padding: '60px 16px 18px' }}>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.8 }}>Trends</div>
        <div style={{ fontSize: 13, color: t.text.tertiary, marginTop: 4 }}>Hoe je nu presteert vs. vroeger</div>
      </div>

      {/* Month vs month */}
      <div style={{ margin: '0 16px', padding: 18, background: t.bg.surface, border: `0.5px solid ${t.bg.border}`, borderRadius: 22 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>April vs Maart</div>
        <div style={{ fontSize: 12, color: t.text.tertiary, marginBottom: 14 }}>Maand-op-maand</div>
        {[
          { label: 'Trainingen', cur: 21, prev: 18, unit: '' },
          { label: 'Tonnage', cur: 16.8, prev: 14.2, unit: ' ton' },
          { label: 'Hardloop km', cur: 48, prev: 32, unit: ' km' },
          { label: 'PR\'s behaald', cur: 2, prev: 1, unit: '' },
          { label: 'Eiwit (gem)', cur: 138, prev: 124, unit: 'g' },
        ].map((row, i) => {
          const delta = row.cur - row.prev;
          const pct = (delta / row.prev) * 100;
          const up = delta > 0;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 0.7fr 0.6fr', alignItems: 'center', gap: 8, padding: '11px 0', borderTop: i > 0 ? `0.5px solid ${t.bg.border}` : 'none' }}>
              <div style={{ fontSize: 13, color: t.text.secondary }}>{row.label}</div>
              <div style={{ fontSize: 13, color: t.text.tertiary, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.prev}{row.unit}</div>
              <div style={{ fontSize: 14, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.cur}{row.unit}</div>
              <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'right', color: up ? t.status.good : t.status.bad, fontVariantNumeric: 'tabular-nums' }}>
                {up ? '↑' : '↓'} {Math.abs(Math.round(pct))}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Quarter */}
      <div style={{ margin: '14px 16px 0', padding: 18, background: t.bg.surface, border: `0.5px solid ${t.bg.border}`, borderRadius: 22 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Q2 · Tonnage</div>
        <div style={{ fontSize: 12, color: t.text.tertiary, marginBottom: 16 }}>Totaal volume per maand</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 140 }}>
          {quarter.map((q, i) => {
            const h = (q.val / maxQ) * 110;
            const isLast = i === quarter.length - 1;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: isLast ? '#00E5C7' : t.text.secondary, fontVariantNumeric: 'tabular-nums' }}>{q.val}</div>
                <div style={{
                  width: '100%', height: h, borderRadius: 8,
                  background: isLast ? 'linear-gradient(180deg, #00E5C7, #0A4F45)' : 'rgba(255,255,255,0.10)',
                  boxShadow: isLast ? '0 0 14px rgba(0,229,199,0.3)' : 'none',
                }}/>
                <div style={{ fontSize: 11, color: t.text.tertiary, fontWeight: 500 }}>{q.m}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Year ago snapshot */}
      <div style={{ margin: '14px 16px 0', padding: 18, background: 'linear-gradient(135deg, rgba(255,94,58,0.10), rgba(124,58,237,0.10))', border: `0.5px solid rgba(255,94,58,0.20)`, borderRadius: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: '#FF7A52' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2"/></svg>
          Een jaar geleden
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, marginTop: 8, lineHeight: 1.4, color: t.text.primary, letterSpacing: -0.2 }}>
          Week 17 vorig jaar deed je 3 sessies met 8.4t volume.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: t.text.tertiary }}>Toen</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>8.4 <span style={{ fontSize: 12, color: t.text.tertiary }}>ton</span></div>
            <div style={{ fontSize: 11, color: t.text.tertiary }}>3 sessies · 18 km</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#FF7A52' }}>Nu</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: '#FF7A52', fontVariantNumeric: 'tabular-nums' }}>12.4 <span style={{ fontSize: 12, color: t.text.tertiary }}>ton</span></div>
            <div style={{ fontSize: 11, color: t.text.tertiary }}>5 sessies · 32 km</div>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: 10, background: 'rgba(0,0,0,0.20)', borderRadius: 12, fontSize: 12, color: t.text.secondary, lineHeight: 1.5 }}>
          +48% volume, +66% sessies. Je bent objectief sterker en consistenter dan een jaar geleden.
        </div>
      </div>
    </div>
  );
}

// ─────────── CHECK-IN ───────────
function CheckIn() {
  const t = M();
  const steps = ['Review', 'Analyse', 'Planning', 'Bevestig'];
  const current = 2;

  return (
    <div style={{ background: t.bg.page, color: t.text.primary, minHeight: '100%', paddingBottom: 100, fontFamily: t.font }}>
      <BackBar/>
      <PageTitle sub="Wekelijkse check-in · zondag 27 apr">Check-in</PageTitle>

      {/* Step indicator */}
      <div style={{ padding: '0 16px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {steps.map((s, i) => {
          const stepNum = i + 1;
          const isDone = stepNum < current;
          const isActive = stepNum === current;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i === steps.length - 1 ? 'none' : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: isDone ? 'rgba(34,214,122,0.15)' : isActive ? '#0A84FF' : 'rgba(255,255,255,0.08)',
                  color: isDone ? t.status.good : isActive ? '#fff' : t.text.tertiary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600,
                }}>
                  {isDone ? '✓' : stepNum}
                </div>
                <div style={{ fontSize: 11, fontWeight: 500, color: isActive ? t.text.primary : t.text.tertiary, whiteSpace: 'nowrap' }}>{s}</div>
              </div>
              {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: isDone ? t.status.good : 'rgba(255,255,255,0.10)', minWidth: 8 }}/>}
            </div>
          );
        })}
      </div>

      {/* Coach analysis card */}
      <div style={{ margin: '0 16px', padding: 18, background: 'linear-gradient(135deg, rgba(10,132,255,0.10), rgba(124,58,237,0.06))', border: '0.5px solid rgba(10,132,255,0.30)', borderRadius: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #0A84FF, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✦</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Coach analyse</div>
            <div style={{ fontSize: 11, color: t.text.tertiary }}>op basis van week 17</div>
          </div>
        </div>
        <div style={{ fontSize: 14, color: t.text.primary, lineHeight: 1.55, letterSpacing: -0.1 }}>
          Sterke week. <span style={{ color: '#00E5C7', fontWeight: 600 }}>Bench +2.5kg</span>, eerste tempo-run sinds maart op 4:38/km. Pull-volume blijft achter — vrijdag een extra row-set toevoegen?
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          {[
            { l: 'Volume', v: '+12%', c: t.status.good },
            { l: 'Pull/Push', v: '0.6', c: t.status.warn },
            { l: 'Adherence', v: '83%', c: t.status.good },
          ].map((x, i) => (
            <div key={i} style={{ flex: 1, padding: 10, background: 'rgba(0,0,0,0.20)', borderRadius: 12 }}>
              <div style={{ fontSize: 10, color: t.text.tertiary, fontWeight: 500 }}>{x.l}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: x.c, fontVariantNumeric: 'tabular-nums' }}>{x.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Week plan */}
      <div style={{ margin: '14px 16px 0', padding: 18, background: t.bg.surface, border: `0.5px solid ${t.bg.border}`, borderRadius: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Week 18 plan</div>
            <div style={{ fontSize: 11, color: t.text.tertiary }}>Voorgesteld door coach</div>
          </div>
          <button style={{ fontSize: 12, fontWeight: 500, color: '#0A84FF', background: 'none', border: 'none', padding: 0 }}>Aanpassen</button>
        </div>
        {[
          { d: 'Ma 28', sport: 'gym', title: 'Upper B — pull focus', tag: '+1 row' },
          { d: 'Di 29', sport: 'run', title: 'Easy 6 km @ 5:20/km' },
          { d: 'Wo 30', sport: null, title: 'Rust' },
          { d: 'Do 1', sport: 'gym', title: 'Lower B' },
          { d: 'Vr 2', sport: 'run', title: 'Tempo 5 km @ 4:35/km' },
          { d: 'Za 3', sport: 'padel', title: 'Match' },
          { d: 'Zo 4', sport: null, title: 'Rust + check-in' },
        ].map((d, i) => {
          const c = d.sport ? t.sport[d.sport] : null;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: i > 0 ? `0.5px solid ${t.bg.border}` : 'none' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, width: 40 }}>{d.d}</div>
              <div style={{ width: 3, height: 22, borderRadius: 2, background: c ? c.base : 'rgba(255,255,255,0.10)', boxShadow: c ? `0 0 6px ${c.base}` : 'none' }}/>
              <div style={{ flex: 1, fontSize: 13, color: c ? t.text.primary : t.text.tertiary, fontWeight: c ? 500 : 400 }}>{d.title}</div>
              {d.tag && <div style={{ fontSize: 10, fontWeight: 600, color: '#00E5C7', padding: '3px 7px', background: 'rgba(0,229,199,0.12)', borderRadius: 4 }}>{d.tag}</div>}
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div style={{ margin: '16px 16px 0' }}>
        <button style={{
          width: '100%', padding: '14px 20px',
          background: 'linear-gradient(135deg, #0A84FF, #7C3AED)',
          color: 'white', border: 'none', borderRadius: 16,
          fontSize: 16, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(10,132,255,0.4)',
        }}>
          Plan bevestigen →
        </button>
      </div>
    </div>
  );
}

// ─────────── SETTINGS ───────────
function Settings() {
  const t = M();
  const Row = ({ icon, label, value, danger, last }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: last ? 'none' : `0.5px solid ${t.bg.border}` }}>
      <div style={{ width: 28, height: 28, borderRadius: 7, background: icon.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 14, color: icon.color, lineHeight: 1 }}>{icon.glyph}</div>
      </div>
      <div style={{ flex: 1, fontSize: 15, color: danger ? t.status.bad : t.text.primary }}>{label}</div>
      {value && <div style={{ fontSize: 13, color: t.text.tertiary, fontVariantNumeric: 'tabular-nums' }}>{value}</div>}
      <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M1 1L7 7L1 13" stroke={t.text.muted} strokeWidth="1.6" strokeLinecap="round"/></svg>
    </div>
  );
  const Group = ({ title, children }) => (
    <div style={{ margin: '0 16px 24px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: t.text.tertiary, padding: '0 4px 8px' }}>{title}</div>
      <div style={{ background: t.bg.surface, border: `0.5px solid ${t.bg.border}`, borderRadius: 14, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ background: t.bg.page, color: t.text.primary, minHeight: '100%', paddingBottom: 100, fontFamily: t.font }}>
      <PageTitle>Instellingen</PageTitle>

      {/* Profile header */}
      <div style={{ margin: '0 16px 24px', padding: 18, background: 'linear-gradient(135deg, rgba(0,229,199,0.10), rgba(124,58,237,0.10))', border: `0.5px solid ${t.bg.borderStrong}`, borderRadius: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #00E5C7, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'white' }}>S</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>Stef</div>
          <div style={{ fontSize: 12, color: t.text.tertiary }}>32 · 78 kg · 1.83 m</div>
          <div style={{ fontSize: 11, color: '#00E5C7', marginTop: 3 }}>Bewerk profiel ›</div>
        </div>
      </div>

      <Group title="Verbindingen">
        <Row icon={{ bg: 'rgba(255,176,32,0.15)', color: '#FFB020', glyph: '◇' }} label="Hevy" value="Verbonden"/>
        <Row icon={{ bg: 'rgba(255,77,109,0.15)', color: '#FF4D6D', glyph: '♥' }} label="Apple Health" value="Verbonden"/>
        <Row icon={{ bg: 'rgba(10,132,255,0.15)', color: '#0A84FF', glyph: '🗓' }} label="Google Calendar" value="Niet verbonden"/>
        <Row icon={{ bg: 'rgba(255,94,58,0.15)', color: '#FF5E3A', glyph: '◐' }} label="Strava" value="Niet verbonden" last/>
      </Group>

      <Group title="Training">
        <Row icon={{ bg: 'rgba(0,229,199,0.15)', color: '#00E5C7', glyph: '◯' }} label="Wekelijkse targets" value="3·2·1"/>
        <Row icon={{ bg: 'rgba(124,58,237,0.15)', color: '#A78BFA', glyph: '⚙' }} label="Eiwit per kg" value="1.8 g"/>
        <Row icon={{ bg: 'rgba(255,255,255,0.06)', color: t.text.secondary, glyph: '◰' }} label="Eenheden" value="Metrisch" last/>
      </Group>

      <Group title="Coach">
        <Row icon={{ bg: 'rgba(167,139,250,0.15)', color: '#A78BFA', glyph: '✦' }} label="Coaching memory"/>
        <Row icon={{ bg: 'rgba(0,229,199,0.15)', color: '#00E5C7', glyph: '◊' }} label="AI context preview" last/>
      </Group>

      <Group title="Account">
        <Row icon={{ bg: 'rgba(255,255,255,0.06)', color: t.text.secondary, glyph: '◔' }} label="Wachtwoord wijzigen"/>
        <Row icon={{ bg: 'rgba(255,77,109,0.15)', color: '#FF4D6D', glyph: '⤴' }} label="Uitloggen" danger last/>
      </Group>

      <div style={{ textAlign: 'center', fontSize: 11, color: t.text.muted, padding: 12 }}>Pulse v2.0.1 · Build 142</div>
    </div>
  );
}

// ─────────── WORKOUT DETAIL ───────────
function WorkoutDetail() {
  const t = M();
  const exercises = [
    {
      name: 'Bench Press', muscle: 'chest',
      sets: [
        { type: 'warmup', w: 40, r: 10 },
        { type: 'normal', w: 60, r: 8, prev: 60 },
        { type: 'normal', w: 70, r: 8, prev: 67.5, pr: true },
        { type: 'normal', w: 70, r: 7, prev: 67.5 },
        { type: 'normal', w: 70, r: 6, prev: 67.5 },
      ],
    },
    {
      name: 'Overhead Press', muscle: 'shoulders',
      sets: [
        { type: 'normal', w: 40, r: 10 },
        { type: 'normal', w: 42.5, r: 8, prev: 40 },
        { type: 'normal', w: 42.5, r: 8 },
      ],
    },
    {
      name: 'Incline DB Press', muscle: 'chest',
      sets: [
        { type: 'normal', w: 22.5, r: 10, prev: 22.5 },
        { type: 'normal', w: 22.5, r: 10 },
        { type: 'normal', w: 22.5, r: 9 },
      ],
    },
    {
      name: 'Lateral Raises', muscle: 'shoulders',
      sets: [
        { type: 'normal', w: 9, r: 12 },
        { type: 'normal', w: 9, r: 12 },
        { type: 'normal', w: 9, r: 10 },
        { type: 'dropset', w: 7, r: 8 },
      ],
    },
    {
      name: 'Tricep Pushdown', muscle: 'arms',
      sets: [
        { type: 'normal', w: 32, r: 12 },
        { type: 'normal', w: 32, r: 12 },
        { type: 'normal', w: 32, r: 10 },
      ],
    },
  ];
  const totalSets = exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const totalReps = exercises.reduce((acc, e) => acc + e.sets.reduce((s, st) => s + st.r, 0), 0);
  const tonnage = exercises.reduce((acc, e) => acc + e.sets.reduce((s, st) => s + (st.type !== 'warmup' ? st.w * st.r : 0), 0), 0);

  return (
    <div style={{ background: t.bg.page, color: t.text.primary, minHeight: '100%', paddingBottom: 100, fontFamily: t.font }}>
      {/* Hero */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(80% 100% at 100% 0%, rgba(0,229,199,0.30), transparent 60%), radial-gradient(60% 80% at 0% 100%, rgba(124,58,237,0.18), transparent 60%)' }}/>
        <div style={{ position: 'relative', padding: '60px 16px 22px' }}>
          <BackBar/>
          <div style={{ padding: '6px 0 0' }}>
            <div style={{ fontSize: 11, color: '#00E5C7', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>Donderdag 24 apr · 18:42</div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.7, marginTop: 6 }}>Upper Body A</div>
            <div style={{ fontSize: 13, color: t.text.secondary, marginTop: 4 }}>Push focus · Hevy</div>
          </div>
          {/* PR badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'linear-gradient(135deg, #FFB020, #FF5E3A)', borderRadius: 99, marginTop: 14, boxShadow: '0 4px 12px rgba(255,176,32,0.4)' }}>
            <span style={{ fontSize: 13 }}>🏆</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>1 nieuwe PR · Bench +2.5kg</span>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ margin: '14px 16px 0', padding: '14px 8px', background: t.bg.surface, border: `0.5px solid ${t.bg.border}`, borderRadius: 18, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { v: '58', u: 'min', l: 'Duur' },
          { v: totalSets, u: 'sets', l: 'Volume' },
          { v: `${(tonnage / 1000).toFixed(1)}k`, u: 'kg', l: 'Tonnage' },
          { v: '142', u: 'bpm', l: 'Avg HR' },
        ].map((s, i) => (
          <div key={i} style={{ borderLeft: i > 0 ? `0.5px solid ${t.bg.border}` : 'none', textAlign: 'center', padding: '0 6px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.4, fontVariantNumeric: 'tabular-nums' }}>{s.v}<span style={{ fontSize: 10, color: t.text.tertiary, fontWeight: 500, marginLeft: 2 }}>{s.u}</span></div>
            <div style={{ fontSize: 10, color: t.text.tertiary, fontWeight: 500, marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Exercises */}
      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {exercises.map((ex, i) => {
          const muscleColors = { chest: '#FF5E3A', shoulders: '#FFB020', arms: '#A78BFA', back: '#00E5C7', legs: '#9CFF4F' };
          const c = muscleColors[ex.muscle];
          return (
            <div key={i} style={{ background: t.bg.surface, border: `0.5px solid ${t.bg.border}`, borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${c}1f`, border: `0.5px solid ${c}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: c, boxShadow: `0 0 8px ${c}` }}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.2 }}>{ex.name}</div>
                  <div style={{ fontSize: 11, color: t.text.tertiary, textTransform: 'capitalize' }}>{ex.muscle} · {ex.sets.length} sets</div>
                </div>
              </div>
              <div style={{ padding: '0 16px 10px' }}>
                {ex.sets.map((s, j) => {
                  const isWarmup = s.type === 'warmup';
                  const isDrop = s.type === 'dropset';
                  const improved = s.prev && s.w > s.prev;
                  return (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderTop: j > 0 ? `0.5px solid ${t.bg.border}` : 'none', opacity: isWarmup ? 0.5 : 1 }}>
                      <div style={{ width: 16, fontSize: 11, color: t.text.tertiary, textAlign: 'center', fontWeight: 600 }}>
                        {isWarmup ? 'W' : isDrop ? 'D' : j}
                      </div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.w}<span style={{ fontSize: 11, color: t.text.tertiary, fontWeight: 500 }}>kg</span></div>
                        <div style={{ fontSize: 13, color: t.text.secondary, fontVariantNumeric: 'tabular-nums' }}>× {s.r}</div>
                      </div>
                      {s.pr && <div style={{ fontSize: 10, fontWeight: 700, color: '#1a1a1a', background: '#FFB020', padding: '2px 6px', borderRadius: 4 }}>PR</div>}
                      {improved && !s.pr && <div style={{ fontSize: 10, fontWeight: 600, color: t.status.good }}>↑ +{(s.w - s.prev).toFixed(1)}kg</div>}
                      {s.prev && !improved && !s.pr && <div style={{ fontSize: 10, color: t.text.muted, fontVariantNumeric: 'tabular-nums' }}>↺ {s.prev}kg</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Notes */}
      <div style={{ margin: '14px 16px 0', padding: 16, background: t.bg.surface, border: `0.5px solid ${t.bg.border}`, borderRadius: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: t.text.tertiary, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 }}>Notities</div>
        <div style={{ fontSize: 13, color: t.text.secondary, lineHeight: 1.55 }}>Voelde sterk op bench. Schouder iets vermoeid bij OHP — volgende keer 5 reps eerst proberen.</div>
      </div>
    </div>
  );
}

Object.assign(window, { Workload, Goals, Trends, CheckIn, Settings, WorkoutDetail });
