// Schema, Progress, Coach, Nutrition, Workout Detail screens
const TT = () => window.PulseTokens;

// ─────────── SCHEMA — Variant A: Calendar week view ───────────
function SchemaWeek() {
  const t = TT();
  const { Card, SportDot } = window.PulseAtoms;
  const week = [
    { d: 'Ma', date: '21', sport: 'gym', title: 'Upper A', dur: '58 min', done: true },
    { d: 'Di', date: '22', sport: 'run', title: 'Easy 8 km', dur: '46 min', done: true },
    { d: 'Wo', date: '23', sport: null, title: 'Rust', done: false },
    { d: 'Do', date: '24', sport: 'gym', title: 'Lower A', dur: '62 min', done: false, today: true },
    { d: 'Vr', date: '25', sport: 'run', title: 'Tempo 6 km', dur: '38 min', done: false },
    { d: 'Za', date: '26', sport: 'padel', title: 'Match', dur: '90 min', done: false },
    { d: 'Zo', date: '27', sport: null, title: 'Rust', done: false },
  ];
  return (
    <div style={{ background: t.bg.page, color: t.text.primary, minHeight: '100%', paddingBottom: 100, fontFamily: t.font }}>
      <div style={{ padding: '64px 16px 12px' }}>
        <div style={{ fontSize: 13, color: t.text.tertiary, fontWeight: 500 }}>Schema · Week 17</div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.6, marginTop: 2 }}>Upper/Lower<br/>blok 3</div>
        <div style={{ fontSize: 13, color: t.text.secondary, marginTop: 6 }}>Week 3 van 4 · opbouwfase</div>
        {/* progress bar */}
        <div style={{ marginTop: 14, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '62%', background: 'linear-gradient(90deg, #00E5C7, #7C3AED)', borderRadius: 3 }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: t.text.tertiary, marginTop: 6 }}>
          <span>14 / 24 sessies</span><span>5 dagen te gaan</span>
        </div>
      </div>

      <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {week.map((d, i) => {
          const c = d.sport ? t.sport[d.sport] : null;
          return (
            <div key={i} style={{
              display: 'flex', gap: 14, alignItems: 'center', padding: 14,
              background: d.today ? 'linear-gradient(135deg, rgba(0,229,199,0.10), rgba(124,58,237,0.06))' : t.bg.surface,
              border: `0.5px solid ${d.today ? 'rgba(0,229,199,0.30)' : t.bg.border}`,
              borderRadius: 18, position: 'relative', overflow: 'hidden',
            }}>
              {/* date column */}
              <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.6, color: t.text.tertiary, textTransform: 'uppercase' }}>{d.d}</div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, marginTop: 1, color: d.today ? t.sport.gym.base : t.text.primary }}>{d.date}</div>
              </div>
              {/* sport bar */}
              <div style={{ width: 3, height: 38, borderRadius: 2, background: c ? c.base : 'rgba(255,255,255,0.10)', boxShadow: c ? `0 0 12px ${c.base}` : 'none' }}/>
              {/* content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.text.primary }}>{d.title}</div>
                <div style={{ fontSize: 12, color: t.text.secondary, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {c && <SportDot sport={d.sport} size={6}/>}
                  {d.sport ? <>{d.sport === 'gym' ? 'Krachttraining' : d.sport === 'run' ? 'Hardlopen' : 'Padel'}{d.dur ? ' · ' + d.dur : ''}</> : 'Rustdag'}
                </div>
              </div>
              {/* status */}
              {d.done ? (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: c.base, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7l3 3 5-6" stroke="#000" strokeWidth="2.4" fill="none" strokeLinecap="round"/></svg>
                </div>
              ) : d.today ? (
                <div style={{ fontSize: 11, fontWeight: 600, color: t.sport.gym.base, padding: '5px 10px', background: 'rgba(0,229,199,0.14)', borderRadius: 999 }}>vandaag</div>
              ) : null}
            </div>
          );
        })}

        {/* Coach action */}
        <div style={{ marginTop: 8, padding: 14, borderRadius: 18,
          background: 'linear-gradient(135deg, rgba(255,94,58,0.12), rgba(255,45,135,0.10))',
          border: '0.5px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <window.PulseAtoms.CoachOrb size={28}/>
          <div style={{ flex: 1, fontSize: 13, color: t.text.primary }}>Schema klaar volgende week. Plan blok 4.</div>
          <span style={{ fontSize: 18, color: t.text.tertiary }}>›</span>
        </div>
      </div>
    </div>
  );
}

// ─────────── SCHEMA — Variant B: Workout detail ───────────
function SchemaDetail() {
  const t = TT();
  const exercises = [
    { name: 'Squat', sets: '4 × 6', weight: '90 kg', pr: false, prog: '+2.5kg' },
    { name: 'Romanian Deadlift', sets: '3 × 8', weight: '85 kg', pr: false },
    { name: 'Leg Press', sets: '3 × 10', weight: '180 kg', pr: true },
    { name: 'Walking Lunges', sets: '3 × 12', weight: '20 kg', pr: false },
    { name: 'Calf Raises', sets: '4 × 15', weight: '60 kg', pr: false },
    { name: 'Hanging Leg Raises', sets: '3 × 12', weight: 'BW', pr: false },
  ];
  return (
    <div style={{ background: t.bg.page, color: t.text.primary, minHeight: '100%', paddingBottom: 120, fontFamily: t.font }}>
      {/* hero */}
      <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(80% 100% at 30% 20%, #00E5C7 0%, #1A4F47 40%, #15171F 80%)' }}/>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, #15171F 100%)' }}/>
        <div style={{ position: 'absolute', bottom: 18, left: 20, right: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: '#00E5C7' }}>Donderdag · Gym</div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.6, marginTop: 6 }}>Lower Body A</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
            <span>6 oefeningen</span><span>·</span><span>22 sets</span><span>·</span><span>≈ 62 min</span>
          </div>
        </div>
      </div>

      {/* exercise list */}
      <div style={{ padding: '4px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {exercises.map((e, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px',
            background: t.bg.surface, border: `0.5px solid ${t.bg.border}`, borderRadius: 16,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: 'rgba(0,229,199,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#00E5C7',
            }}>{i+1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
                {e.name}
                {e.pr && <span style={{ fontSize: 9, fontWeight: 700, color: '#FFB020', padding: '2px 6px', background: 'rgba(255,176,32,0.16)', borderRadius: 6, letterSpacing: 0.5 }}>PR</span>}
              </div>
              <div style={{ fontSize: 12, color: t.text.tertiary, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{e.sets} · {e.weight}{e.prog ? ' · ' + e.prog : ''}</div>
            </div>
            <span style={{ fontSize: 18, color: t.text.tertiary }}>›</span>
          </div>
        ))}
      </div>
      {/* CTA */}
      <div style={{ padding: 16, marginTop: 8 }}>
        <button style={{
          width: '100%', height: 54, borderRadius: 18, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #00E5C7, #4FC3F7)', color: '#000',
          fontSize: 16, fontWeight: 700, letterSpacing: -0.2, fontFamily: t.font,
          boxShadow: '0 8px 32px -8px rgba(0,229,199,0.6)',
        }}>Start workout</button>
      </div>
    </div>
  );
}

// ─────────── PROGRESS ───────────
function Progress() {
  const t = TT();
  const { Card } = window.PulseAtoms;
  return (
    <div style={{ background: t.bg.page, color: t.text.primary, minHeight: '100%', paddingBottom: 100, fontFamily: t.font }}>
      <div style={{ padding: '64px 16px 12px' }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.6 }}>Progressie</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 14, padding: 4, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
          {['4 weken', '3 mnd', '6 mnd', 'Jaar'].map((p, i) => (
            <button key={i} style={{
              flex: 1, height: 32, border: 'none', cursor: 'pointer', borderRadius: 8,
              background: i === 1 ? 'rgba(255,255,255,0.10)' : 'transparent',
              color: i === 1 ? t.text.primary : t.text.secondary,
              fontSize: 12, fontWeight: 600, fontFamily: t.font,
            }}>{p}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Strength chart */}
        <Card padding={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: t.text.tertiary }}>Kracht (geschatte 1RM)</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, marginTop: 4 }}>+12.5 kg <span style={{ fontSize: 13, color: t.status.good }}>↑ 8.4%</span></div>
            </div>
          </div>
          <StrengthChart/>
          <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
            {[{ n: 'Push', c: '#FF5E3A' }, { n: 'Pull', c: '#00E5C7' }, { n: 'Squat', c: '#FFB020' }, { n: 'Hinge', c: '#9CFF4F' }].map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: t.text.secondary }}>
                <span style={{ width: 10, height: 2, background: p.c, borderRadius: 1 }}/>{p.n}
              </div>
            ))}
          </div>
        </Card>

        {/* Running */}
        <Card padding={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: t.text.tertiary }}>Hardlopen · gem. pace</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>5:24 <span style={{ fontSize: 13, color: t.status.good }}>↓ 12s/km</span></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: t.text.tertiary }}>Volume</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>34 km</div>
            </div>
          </div>
          <RunChart/>
        </Card>

        {/* PRs */}
        <Card padding={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>Records deze maand</div>
            <span style={{ fontSize: 11, color: t.text.tertiary }}>4 PRs</span>
          </div>
          {[
            { name: 'Bench Press', value: '82.5 kg', delta: '+2.5 kg', sport: 'gym' },
            { name: 'Deadlift', value: '140 kg', delta: '+5 kg', sport: 'gym' },
            { name: '5K', value: '23:18', delta: '−42s', sport: 'run' },
            { name: 'Pull-ups', value: '12 reps', delta: '+2', sport: 'gym' },
          ].map((p, i, a) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? `0.5px solid ${t.bg.border}` : 'none' }}>
              <window.PulseAtoms.SportDot sport={p.sport} size={8} glow/>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{p.name}</div>
              <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{p.value}</div>
              <div style={{ fontSize: 11, color: t.status.good, fontWeight: 600, width: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.delta}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function StrengthChart() {
  const lines = [
    { color: '#FF5E3A', pts: [40, 38, 42, 45, 48, 47, 52, 56, 58, 60, 64, 66] },
    { color: '#00E5C7', pts: [55, 58, 56, 60, 62, 64, 63, 66, 68, 70, 72, 74] },
    { color: '#FFB020', pts: [70, 72, 70, 75, 78, 76, 80, 82, 84, 85, 88, 90] },
    { color: '#9CFF4F', pts: [60, 62, 65, 64, 68, 70, 72, 74, 75, 78, 80, 82] },
  ];
  const W = 320, H = 140, max = 95, min = 35;
  const x = (i) => (i / 11) * W;
  const y = (v) => H - ((v - min) / (max - min)) * H;
  return (
    <svg width="100%" height={H + 20} viewBox={`0 -10 ${W} ${H+20}`} style={{ marginTop: 12 }}>
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1="0" x2={W} y1={H * p} y2={H * p} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="2 4"/>
      ))}
      {lines.map((l, i) => (
        <g key={i}>
          <path d={`M ${l.pts.map((v, j) => `${x(j)} ${y(v)}`).join(' L ')}`}
            fill="none" stroke={l.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx={x(11)} cy={y(l.pts[11])} r="3" fill={l.color}/>
        </g>
      ))}
    </svg>
  );
}

function RunChart() {
  const W = 320, H = 100;
  const km = [4, 6, 5, 8, 7, 10, 6, 8, 12, 9, 11, 14];
  const pace = [350, 348, 345, 342, 340, 338, 336, 332, 330, 328, 326, 324];
  const maxKm = 16;
  const bw = (W - 22) / 12;
  return (
    <svg width="100%" height={H + 20} viewBox={`0 0 ${W} ${H+20}`} style={{ marginTop: 12 }}>
      {km.map((v, i) => (
        <rect key={i} x={i * bw + 2} y={H - (v/maxKm)*H} width={bw - 4} height={(v/maxKm)*H}
          fill="rgba(255,94,58,0.5)" rx="2"/>
      ))}
      <path d={`M ${pace.map((v, i) => `${i * bw + bw/2} ${H - ((v-320)/40)*H}`).join(' L ')}`}
        fill="none" stroke="#00E5C7" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// ─────────── COACH (chat) ───────────
function Coach() {
  const t = TT();
  const messages = [
    { role: 'a', text: 'Goedemorgen Stef. Je readiness is 86 en je HRV staat 4ms boven je basislijn — een goed moment voor een zware sessie.' },
    { role: 'u', text: 'wat moet ik vandaag doen?' },
    { role: 'a', text: 'Volgens schema: **Lower Body A**. Maar ik zie dat je push-volume 3.2× hoger ligt dan pull deze week. Twee opties:', extra: 'options' },
    { role: 'u', text: 'optie 1' },
    { role: 'a', text: 'Top. Ik heb je schema bijgewerkt — extra rij-bewegingen toegevoegd op donderdag. Begin met 4×8 Cable Row @50kg.', insight: true },
  ];
  return (
    <div style={{ background: t.bg.page, color: t.text.primary, minHeight: '100%', display: 'flex', flexDirection: 'column', fontFamily: t.font }}>
      {/* header */}
      <div style={{ padding: '64px 16px 12px', borderBottom: `0.5px solid ${t.bg.border}`,
        background: 'linear-gradient(180deg, rgba(124,58,237,0.10), transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <window.PulseAtoms.CoachOrb size={40}/>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Pulse Coach</div>
            <div style={{ fontSize: 12, color: t.status.good, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.status.good, boxShadow: `0 0 8px ${t.status.good}` }}/>
              Beschikbaar · kent al je data
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'u' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '82%',
              padding: '11px 14px', borderRadius: 18,
              background: m.role === 'u' ? '#fff' : (m.insight ? 'linear-gradient(135deg, rgba(0,229,199,0.18), rgba(124,58,237,0.10))' : 'rgba(255,255,255,0.06)'),
              color: m.role === 'u' ? '#000' : t.text.primary,
              border: m.role === 'u' ? 'none' : '0.5px solid rgba(255,255,255,0.08)',
              fontSize: 14, lineHeight: 1.45,
              borderBottomRightRadius: m.role === 'u' ? 6 : 18,
              borderBottomLeftRadius: m.role === 'a' ? 6 : 18,
            }}>
              {m.text.split('**').map((s, j) => j % 2 ? <b key={j}>{s}</b> : s)}
              {m.extra === 'options' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  <div style={{ padding: 10, borderRadius: 12, background: 'rgba(0,0,0,0.25)', border: '0.5px solid rgba(255,255,255,0.10)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#00E5C7' }}>1 · Pull-focus toevoegen</div>
                    <div style={{ fontSize: 11, color: t.text.secondary, marginTop: 2 }}>+3 sets cable rows aan vandaag</div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 12, background: 'rgba(0,0,0,0.25)', border: '0.5px solid rgba(255,255,255,0.10)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#FFB020' }}>2 · Volgens schema</div>
                    <div style={{ fontSize: 11, color: t.text.secondary, marginTop: 2 }}>Lower zoals gepland</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* suggestions */}
      <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {['Hoe ging mijn week?', 'Plan een nieuw blok', 'Ik voel mijn knie', 'Log: havermout met banaan'].map((s, i) => (
          <button key={i} style={{
            flexShrink: 0, fontSize: 12, padding: '8px 12px', borderRadius: 999,
            background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.10)',
            color: t.text.secondary, cursor: 'pointer', fontFamily: t.font,
          }}>{s}</button>
        ))}
      </div>

      {/* input */}
      <div style={{ padding: 12, borderTop: `0.5px solid ${t.bg.border}`, display: 'flex', gap: 8, alignItems: 'center', background: t.bg.surface }}>
        <div style={{
          flex: 1, height: 44, borderRadius: 22, padding: '0 18px',
          background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.10)',
          display: 'flex', alignItems: 'center', fontSize: 14, color: t.text.tertiary,
        }}>Vraag wat je wilt…</div>
        <button style={{
          width: 44, height: 44, borderRadius: 22, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #00E5C7, #7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 2v14M3 8l6-6 6 6" stroke="#000" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
    </div>
  );
}

// ─────────── NUTRITION ───────────
function Nutrition() {
  const t = TT();
  const { Card } = window.PulseAtoms;
  return (
    <div style={{ background: t.bg.page, color: t.text.primary, minHeight: '100%', paddingBottom: 100, fontFamily: t.font }}>
      <div style={{ padding: '64px 16px 12px' }}>
        <div style={{ fontSize: 13, color: t.text.tertiary }}>Voeding · vandaag</div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.6, marginTop: 2 }}>Op koers</div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Macros donut */}
        <Card padding={18}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <MacroDonut/>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <MacroRow label="Eiwit" value="142" target="165" color="#00E5C7" unit="g"/>
              <MacroRow label="Kool." value="218" target="280" color="#FFB020" unit="g"/>
              <MacroRow label="Vet"   value="62"  target="75"  color="#FF5E3A" unit="g"/>
            </div>
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${t.bg.border}`, display: 'flex', justifyContent: 'space-between', fontVariantNumeric: 'tabular-nums' }}>
            <div><span style={{ fontSize: 11, color: t.text.tertiary }}>Calorieën</span><div style={{ fontSize: 22, fontWeight: 700 }}>1842 / 2200</div></div>
            <div><span style={{ fontSize: 11, color: t.text.tertiary }}>Verbrand</span><div style={{ fontSize: 22, fontWeight: 700 }}>620</div></div>
            <div><span style={{ fontSize: 11, color: t.text.tertiary }}>Netto</span><div style={{ fontSize: 22, fontWeight: 700, color: t.status.good }}>1222</div></div>
          </div>
        </Card>

        {/* AI input */}
        <div style={{
          padding: 14, borderRadius: 18,
          background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(0,229,199,0.10))',
          border: '0.5px solid rgba(255,255,255,0.10)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <window.PulseAtoms.CoachOrb size={20}/>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>Log natuurlijk</span>
          </div>
          <div style={{
            height: 46, padding: '0 16px', borderRadius: 14,
            background: 'rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.10)',
            display: 'flex', alignItems: 'center', fontSize: 14, color: t.text.tertiary,
          }}>"havermout met banaan en honing"</div>
        </div>

        {/* Meals */}
        <Card padding={0}>
          {[
            { time: '08:14', meal: 'Ontbijt', desc: 'Havermout, banaan, peanut butter', kcal: 520, p: 22 },
            { time: '12:30', meal: 'Lunch', desc: 'Hummus wrap, geitenkaas, salade', kcal: 640, p: 28 },
            { time: '16:00', meal: 'Snack', desc: 'Skyr, blauwe bessen', kcal: 220, p: 24 },
            { time: '19:45', meal: 'Diner', desc: 'Tofu pad thai', kcal: 462, p: 35 },
          ].map((m, i, a) => (
            <div key={i} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderTop: i ? `0.5px solid ${t.bg.border}` : 'none' }}>
              <div style={{ width: 38, fontSize: 11, color: t.text.tertiary, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{m.time}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{m.meal}</div>
                <div style={{ fontSize: 12, color: t.text.secondary, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.desc}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{m.kcal}</div>
                <div style={{ fontSize: 10, color: '#00E5C7', fontWeight: 600 }}>{m.p}g eiwit</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function MacroDonut() {
  const W = 110, R = 46, sw = 12, cx = W/2, cy = W/2;
  const c = 2 * Math.PI * R;
  const eiwit = 0.86, kool = 0.78, vet = 0.83;
  return (
    <svg width={W} height={W}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw}/>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#00E5C7" strokeWidth={sw}
        strokeDasharray={`${c*eiwit*0.33} ${c}`} strokeDashoffset="0" transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#FFB020" strokeWidth={sw}
        strokeDasharray={`${c*kool*0.33} ${c}`} strokeDashoffset={-c*0.34} transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#FF5E3A" strokeWidth={sw}
        strokeDasharray={`${c*vet*0.33} ${c}`} strokeDashoffset={-c*0.67} transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="round"/>
      <text x={cx} y={cy-2} textAnchor="middle" fill="#fff" fontSize="20" fontWeight="700" letterSpacing="-0.5">82%</text>
      <text x={cx} y={cy+14} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="9" fontWeight="600">VAN DOEL</text>
    </svg>
  );
}

function MacroRow({ label, value, target, color, unit }) {
  const t = TT();
  const pct = Math.min(parseFloat(value)/parseFloat(target), 1);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: t.text.secondary, fontWeight: 500 }}>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: t.text.primary }}><b style={{ fontWeight: 700 }}>{value}</b><span style={{ color: t.text.tertiary }}>/{target}{unit}</span></span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct*100}%`, background: color, boxShadow: `0 0 8px ${color}` }}/>
      </div>
    </div>
  );
}

window.SchemaWeek = SchemaWeek;
window.SchemaDetail = SchemaDetail;
window.Progress = Progress;
window.Coach = Coach;
window.Nutrition = Nutrition;
