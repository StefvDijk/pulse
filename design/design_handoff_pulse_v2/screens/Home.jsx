// Home screen variants — uses window.PulseTokens
const T = () => window.PulseTokens;

// ─────────── Shared atoms ───────────
function Card({ children, style = {}, padding = 16, glow }) {
  const t = T();
  return (
    <div style={{
      background: t.bg.surface,
      border: `0.5px solid ${t.bg.border}`,
      borderRadius: t.radius.lg,
      padding,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: glow ? `0 0 48px -12px ${glow}` : 'none',
      ...style,
    }}>{children}</div>
  );
}

function GlassCard({ children, style = {}, padding = 16 }) {
  const t = T();
  return (
    <div style={{
      background: t.bg.glass,
      backdropFilter: 'blur(20px) saturate(140%)',
      WebkitBackdropFilter: 'blur(20px) saturate(140%)',
      border: `0.5px solid ${t.bg.borderStrong}`,
      borderRadius: t.radius.lg,
      padding,
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}>{children}</div>
  );
}

function SportDot({ sport, size = 8, glow = false }) {
  const c = T().sport[sport]?.base || '#888';
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: c, boxShadow: glow ? `0 0 12px ${c}` : 'none',
    }} />
  );
}

function MiniRing({ value = 0.7, size = 22, color = '#FF5E3A', stroke = 3 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c * (1 - value)} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
}

// ─────────── VARIANT A: Cinematic Aurora Hero ───────────
function HomeAurora() {
  const t = T();
  return (
    <div style={{ background: t.bg.page, color: t.text.primary, minHeight: '100%', paddingBottom: 100, fontFamily: t.font }}>
      {/* Hero gradient ribbon */}
      <div style={{ position: 'relative', height: 360, marginTop: -1 }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(120% 80% at 30% 20%, #FF5E3A 0%, #FF2D87 30%, #7C3AED 55%, #2A2F45 80%, #15171F 100%)',
        }} />
        {/* noise overlay */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.18, mixBlendMode: 'overlay',
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)',
          backgroundSize: '3px 3px',
        }} />
        {/* fade to page */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, #15171F 100%)' }} />

        {/* content */}
        <div style={{ position: 'relative', padding: '64px 20px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: 0.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
            Dinsdag 28 april
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.05, marginTop: 6, letterSpacing: -0.8 }}>
            Goedemorgen,<br/>Stef.
          </div>

          {/* Readiness orb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 28 }}>
            <ReadinessOrb value={0.86} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Readiness</div>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1, lineHeight: 1 }}>86<span style={{ fontSize: 18, opacity: 0.6, fontWeight: 500 }}>/100</span></div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Goed hersteld · push het vandaag</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12, marginTop: -32, position: 'relative', zIndex: 2 }}>
        {/* Today workout — cinematic card */}
        <TodayWorkoutHero />

        {/* Week ring */}
        <WeekStrip />

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <StatCard label="Belasting" value="1.12" sub="Optimaal" tone="good" big={
            <LoadGauge value={0.62}/>
          }/>
          <StatCard label="HRV" value="58" sub="ms · +4 vs basis" tone="good"/>
          <StatCard label="Eiwit" value="142g" sub="van 165g" progress={0.86} progressColor={t.sport.gym.base}/>
          <StatCard label="Stappen" value="6.2k" sub="van 10k" progress={0.62} progressColor={t.sport.run.base}/>
        </div>

        {/* Body heatmap card */}
        <BodyHeatmapCard />

        {/* Coach insight */}
        <CoachInsight />
      </div>
    </div>
  );
}

// ─────────── Readiness Orb (animated SVG) ───────────
function ReadinessOrb({ value = 0.86, size = 96 }) {
  const r1 = (size/2) - 4;
  const c1 = 2 * Math.PI * r1;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* glow */}
      <div style={{
        position: 'absolute', inset: -10, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,229,199,0.5), transparent 70%)',
        filter: 'blur(8px)',
      }} />
      <svg width={size} height={size} style={{ position: 'relative' }}>
        <defs>
          <linearGradient id="orb-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00E5C7"/>
            <stop offset="100%" stopColor="#4FC3F7"/>
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r1} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
        <circle cx={size/2} cy={size/2} r={r1-2} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"/>
        <circle cx={size/2} cy={size/2} r={r1-2} fill="none" stroke="url(#orb-grad)" strokeWidth="4"
          strokeDasharray={c1} strokeDashoffset={c1 * (1 - value)} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} />
        {/* inner pulse */}
        <circle cx={size/2} cy={size/2} r={(r1-2)*0.55} fill="rgba(0,229,199,0.15)"/>
        <circle cx={size/2} cy={size/2} r={(r1-2)*0.35} fill="rgba(0,229,199,0.25)"/>
      </svg>
    </div>
  );
}

function LoadGauge({ value = 0.62 }) {
  const r = 22, cx = 30, cy = 30, c = Math.PI * r;
  return (
    <svg width="60" height="36" viewBox="0 0 60 36">
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" strokeLinecap="round"/>
      <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="#22D67A" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - value)} />
    </svg>
  );
}

function StatCard({ label, value, sub, tone, progress, progressColor, big }) {
  const t = T();
  const toneColor = tone === 'good' ? t.status.good : tone === 'warn' ? t.status.warn : tone === 'bad' ? t.status.bad : t.text.primary;
  return (
    <Card padding={14}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: t.text.tertiary }}>{label}</div>
        {big && big}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, marginTop: 6, color: t.text.primary }}>{value}</div>
      <div style={{ fontSize: 12, color: tone ? toneColor : t.text.secondary, fontWeight: tone ? 500 : 400, marginTop: 2 }}>{sub}</div>
      {progress !== undefined && (
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress*100}%`, background: progressColor, borderRadius: 2 }}/>
        </div>
      )}
    </Card>
  );
}

function TodayWorkoutHero() {
  const t = T();
  return (
    <div style={{
      borderRadius: t.radius.xl, overflow: 'hidden', position: 'relative',
      background: '#1E2230',
      border: `0.5px solid ${t.bg.borderStrong}`,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(80% 100% at 100% 0%, rgba(0,229,199,0.32), transparent 60%), radial-gradient(60% 80% at 0% 100%, rgba(124,58,237,0.25), transparent 60%)',
      }}/>
      <div style={{ position: 'relative', padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SportDot sport="gym" size={8} glow/>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: t.sport.gym.base }}>Vandaag · Gym</span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.6, marginTop: 8 }}>Upper Body A</div>
        <div style={{ fontSize: 13, color: t.text.secondary, marginTop: 4 }}>6 oefeningen · 22 sets · ≈ 58 min</div>

        {/* exercise pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
          {['Bench Press 4×8', 'OHP 3×10', 'Pull-ups 4×F', 'Cable Row 3×12', 'Lateral Raise 3×15'].map((e,i) => (
            <span key={i} style={{
              fontSize: 11, fontWeight: 500, padding: '5px 10px', borderRadius: 999,
              background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.85)',
            }}>{e}</span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button style={{
            flex: 1, height: 48, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: '#fff', color: '#000', fontSize: 15, fontWeight: 600, fontFamily: t.font,
          }}>Start workout</button>
          <button style={{
            width: 48, height: 48, borderRadius: 14, border: '0.5px solid rgba(255,255,255,0.14)',
            background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer', fontSize: 18,
          }}>›</button>
        </div>
      </div>
    </div>
  );
}

function WeekStrip() {
  const t = T();
  const days = [
    { d: 'M', sport: 'gym', done: true },
    { d: 'D', sport: 'run', done: true },
    { d: 'W', sport: null, done: false },
    { d: 'D', sport: 'gym', done: false, today: true },
    { d: 'V', sport: 'run', done: false },
    { d: 'Z', sport: 'padel', done: false },
    { d: 'Z', sport: null, done: false },
  ];
  return (
    <Card padding={14}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: t.text.tertiary }}>Deze week</div>
        <div style={{ fontSize: 11, color: t.text.secondary }}>2 / 6 voltooid</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 12 }}>
        {days.map((day, i) => {
          const c = day.sport ? t.sport[day.sport].base : 'rgba(255,255,255,0.10)';
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: day.done ? c : 'transparent',
                border: day.done ? 'none' : `1.5px ${day.sport ? 'solid' : 'dashed'} ${day.sport ? c : 'rgba(255,255,255,0.16)'}`,
                position: 'relative',
                boxShadow: day.today ? `0 0 0 2px ${t.bg.page}, 0 0 0 3px ${day.sport ? t.sport[day.sport].base : '#fff'}` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {day.done && (
                  <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7l3 3 5-6" stroke="#000" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </div>
              <div style={{ fontSize: 11, color: day.today ? t.text.primary : t.text.tertiary, fontWeight: day.today ? 600 : 500 }}>{day.d}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function BodyHeatmapCard() {
  const t = T();
  return (
    <Card padding={16}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: t.text.tertiary }}>Belasting per spiergroep</div>
          <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>Push zwaar belast</div>
        </div>
        <span style={{ fontSize: 11, color: t.status.warn, padding: '4px 8px', background: 'rgba(255,176,32,0.12)', borderRadius: 8, fontWeight: 600 }}>balans</span>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 12 }}>
        <BodySVG />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { name: 'Borst', sets: 14, intensity: 0.95 },
            { name: 'Schouders', sets: 9, intensity: 0.7 },
            { name: 'Triceps', sets: 7, intensity: 0.55 },
            { name: 'Rug', sets: 4, intensity: 0.3 },
            { name: 'Benen', sets: 0, intensity: 0 },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 64, color: t.text.secondary }}>{m.name}</span>
              <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${m.intensity*100}%`, background: m.intensity > 0.8 ? '#FF5E3A' : m.intensity > 0.5 ? '#FFB020' : m.intensity > 0 ? '#00E5C7' : 'transparent', borderRadius: 2 }}/>
              </div>
              <span style={{ width: 28, textAlign: 'right', color: t.text.tertiary, fontVariantNumeric: 'tabular-nums' }}>{m.sets}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function BodySVG() {
  // Stylized body silhouette with heat zones
  return (
    <svg width="92" height="160" viewBox="0 0 92 160" style={{ flexShrink: 0 }}>
      <defs>
        <radialGradient id="heat-hot"><stop offset="0%" stopColor="#FF5E3A" stopOpacity="0.95"/><stop offset="100%" stopColor="#FF5E3A" stopOpacity="0"/></radialGradient>
        <radialGradient id="heat-mid"><stop offset="0%" stopColor="#FFB020" stopOpacity="0.7"/><stop offset="100%" stopColor="#FFB020" stopOpacity="0"/></radialGradient>
        <radialGradient id="heat-low"><stop offset="0%" stopColor="#00E5C7" stopOpacity="0.5"/><stop offset="100%" stopColor="#00E5C7" stopOpacity="0"/></radialGradient>
      </defs>
      {/* body */}
      <g fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8">
        <circle cx="46" cy="14" r="10"/>
        <path d="M30 28 L62 28 L66 50 L62 80 L56 110 L52 152 L40 152 L36 110 L30 80 L26 50 Z"/>
        <path d="M28 30 L18 56 L20 86 L26 86 L30 56 Z"/>
        <path d="M64 30 L74 56 L72 86 L66 86 L62 56 Z"/>
      </g>
      {/* heat overlays */}
      <ellipse cx="46" cy="44" rx="18" ry="11" fill="url(#heat-hot)"/>
      <circle cx="32" cy="34" r="9" fill="url(#heat-mid)"/>
      <circle cx="60" cy="34" r="9" fill="url(#heat-mid)"/>
      <ellipse cx="22" cy="68" rx="6" ry="10" fill="url(#heat-low)"/>
      <ellipse cx="70" cy="68" rx="6" ry="10" fill="url(#heat-low)"/>
    </svg>
  );
}

function CoachInsight() {
  const t = T();
  return (
    <div style={{
      borderRadius: t.radius.lg, padding: 16, position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(0,229,199,0.10))',
      border: `0.5px solid rgba(255,255,255,0.10)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <CoachOrb size={28} />
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>Coach</div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: t.text.tertiary }}>net nu</div>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.4, marginTop: 10, color: t.text.primary }}>
        Je <span style={{ fontWeight: 600 }}>push-volume</span> staat 3.2× hoger dan pull deze week. Wil je donderdag's workout zwaarder maken op rij-bewegingen?
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <CoachChip>Pas schema aan</CoachChip>
        <CoachChip>Niet nu</CoachChip>
      </div>
    </div>
  );
}

function CoachChip({ children, primary }) {
  return (
    <button style={{
      fontSize: 12, fontWeight: 500, padding: '7px 12px', borderRadius: 999,
      background: primary ? '#fff' : 'rgba(255,255,255,0.08)', color: primary ? '#000' : '#fff',
      border: primary ? 'none' : '0.5px solid rgba(255,255,255,0.14)', cursor: 'pointer',
      fontFamily: T().font,
    }}>{children}</button>
  );
}

function CoachOrb({ size = 24 }) {
  // Claude / Anthropic logo mark
  const s = size;
  return (
    <div style={{
      width: s, height: s, borderRadius: '50%', flexShrink: 0,
      background: '#D97757',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(217,119,87,0.35)',
    }}>
      <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 24 24" fill="none">
        <path d="M4.79 16.97L9.32 14.43L9.4 14.2L9.32 14.08H9.09L8.32 14.03L5.69 13.96L3.42 13.86L1.22 13.74L0.67 13.62L0.15 12.94L0.21 12.59L0.67 12.28L1.34 12.34L2.81 12.44L5.02 12.59L6.62 12.69L8.99 12.94H9.36L9.41 12.81L9.28 12.71L9.18 12.62L6.93 11.09L4.49 9.48L3.21 8.55L2.52 8.07L2.17 7.63L2.02 6.66L2.65 5.96L3.5 6.02L3.72 6.08L4.59 6.75L6.45 8.19L8.88 9.98L9.23 10.28L9.37 10.18L9.39 10.11L9.23 9.85L7.92 7.48L6.52 5.07L5.9 4.07L5.73 3.47C5.67 3.22 5.63 3.01 5.63 2.76L6.34 1.79L6.74 1.66L7.69 1.79L8.09 2.14L8.69 3.5L9.65 5.64L11.15 8.56L11.59 9.43L11.82 10.24L11.91 10.49H12.06V10.35L12.18 8.74L12.4 6.76L12.62 4.21L12.69 3.49L13.04 2.65L13.74 2.19L14.28 2.45L14.73 3.09L14.67 3.5L14.4 5.27L13.88 7.97L13.54 9.78H13.74L13.96 9.56L14.86 8.37L16.36 6.49L17.02 5.74L17.79 4.93L18.29 4.54H19.22L19.91 5.56L19.6 6.61L18.62 7.85L17.81 8.9L16.65 10.46L15.93 11.71L16 11.81L16.18 11.79L18.96 11.2L20.46 10.93L22.25 10.62L23.06 11L23.15 11.38L22.83 12.16L20.93 12.63L18.71 13.07L15.4 13.85L15.36 13.88L15.4 13.93L16.89 14.07L17.53 14.1H19.09L21.99 14.32L22.75 14.82L23.21 15.43L23.13 15.9L21.97 16.5L20.4 16.13L16.74 15.26L15.49 14.95H15.32V15.05L16.36 16.07L18.27 17.79L20.66 20.01L20.78 20.56L20.47 21L20.14 20.95L18.02 19.36L17.2 18.64L15.34 17.07H15.22V17.23L15.65 17.86L17.93 21.29L18.05 22.34L17.88 22.69L17.29 22.9L16.63 22.78L15.28 20.89L13.9 18.77L12.78 16.86L12.65 16.94L12 23.85L11.7 24.21L11 24.48L10.42 24.04L10.11 23.32L10.42 21.91L10.79 20.07L11.09 18.61L11.36 16.81L11.52 16.21V16.17H11.41L10.27 17.74L8.54 20.08L7.18 21.54L6.85 21.67L6.29 21.38L6.34 20.86L6.65 20.4L8.54 17.99L9.68 16.51L10.42 15.65L10.41 15.53H10.38L5.92 18.46L5.13 18.56L4.79 18.24L4.83 17.71Z"
              fill="#FFFFFF"/>
      </svg>
    </div>
  );
}

// ─────────── VARIANT B: Data-dense Athlytic-style ───────────
function HomeData() {
  const t = T();
  return (
    <div style={{ background: t.bg.page, color: t.text.primary, minHeight: '100%', paddingBottom: 100, fontFamily: t.font }}>
      <div style={{ padding: '64px 16px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.6 }}>Vandaag</div>
            <div style={{ fontSize: 13, color: t.text.secondary, marginTop: 2 }}>Dinsdag 28 april · Week 17</div>
          </div>
          <CoachOrb size={32}/>
        </div>
      </div>

      {/* Big Readiness card */}
      <div style={{ padding: '0 16px 12px' }}>
        <Card padding={18} style={{ background: 'linear-gradient(135deg, #1E2230 0%, #2A3340 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <ReadinessOrb value={0.86} size={108}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: t.text.tertiary }}>Readiness</div>
              <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1.2, lineHeight: 1 }}>86</div>
              <div style={{ fontSize: 12, color: t.status.good, fontWeight: 500, marginTop: 2 }}>↑ 12 · goed hersteld</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 18, paddingTop: 14, borderTop: `0.5px solid ${t.bg.border}` }}>
            <MicroStat label="HRV" value="58" delta="+4" good/>
            <MicroStat label="RHR" value="48" delta="−2" good/>
            <MicroStat label="Slaap" value="7u 42m" delta="86%" good/>
            <MicroStat label="Stress" value="laag" />
          </div>
        </Card>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Strain bar */}
        <Card padding={14}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: t.text.tertiary }}>Belasting (acute:chronic)</div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.6, marginTop: 4 }}>1.12 <span style={{ fontSize: 13, color: t.status.good, fontWeight: 500 }}>optimaal</span></div>
            </div>
            <div style={{ fontSize: 12, color: t.text.tertiary }}>doel 0.8–1.3</div>
          </div>
          <ZoneBar value={0.62} />
        </Card>

        <TodayWorkoutHero />
        <WeekStrip />
        <BodyHeatmapCard />
      </div>
    </div>
  );
}

function MicroStat({ label, value, delta, good }) {
  const t = T();
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: t.text.tertiary }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, letterSpacing: -0.3 }}>{value}</div>
      {delta && <div style={{ fontSize: 10, color: good ? t.status.good : t.text.secondary, fontWeight: 500 }}>{delta}</div>}
    </div>
  );
}

function ZoneBar({ value }) {
  const zones = [
    { from: 0, to: 0.25, color: '#FF4D6D', label: 'laag' },
    { from: 0.25, to: 0.42, color: '#FFB020', label: '' },
    { from: 0.42, to: 0.78, color: '#22D67A', label: 'optimaal' },
    { from: 0.78, to: 0.92, color: '#FFB020', label: '' },
    { from: 0.92, to: 1, color: '#FF4D6D', label: 'risico' },
  ];
  return (
    <div style={{ marginTop: 14, position: 'relative', height: 20 }}>
      <div style={{ position: 'absolute', inset: '8px 0', display: 'flex', borderRadius: 6, overflow: 'hidden', gap: 1.5 }}>
        {zones.map((z,i) => (
          <div key={i} style={{ flex: z.to - z.from, background: z.color, opacity: 0.65 }}/>
        ))}
      </div>
      <div style={{ position: 'absolute', left: `${value*100}%`, top: 0, transform: 'translateX(-50%)' }}>
        <div style={{ width: 3, height: 20, background: '#fff', borderRadius: 2, boxShadow: '0 0 12px rgba(255,255,255,0.6)' }}/>
      </div>
    </div>
  );
}

// ─────────── VARIANT C: Soft / Gentler-Streak inspired ───────────
function HomeSoft() {
  const t = T();
  return (
    <div style={{ background: t.bg.page, color: t.text.primary, minHeight: '100%', paddingBottom: 100, fontFamily: t.font }}>
      {/* breathing pulse hero */}
      <div style={{ position: 'relative', padding: '64px 20px 12px' }}>
        <div style={{ fontSize: 13, color: t.text.secondary }}>Goedemorgen</div>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.6, marginTop: 2 }}>Het is een goede dag<br/>om te bewegen.</div>
      </div>

      <div style={{ position: 'relative', height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <BreathingPulse/>
        <div style={{ position: 'absolute', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: t.text.tertiary }}>Lichaam zegt</div>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.6, marginTop: 4 }}>ga ervoor</div>
          <div style={{ fontSize: 13, color: t.text.secondary, marginTop: 6 }}>readiness 86 · HRV 58</div>
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TodayWorkoutHero/>
        <WeekStrip/>
        <CoachInsight/>
      </div>
    </div>
  );
}

function BreathingPulse() {
  return (
    <svg width="280" height="280" viewBox="0 0 280 280">
      <defs>
        <radialGradient id="bp1"><stop offset="0%" stopColor="#00E5C7" stopOpacity="0.6"/><stop offset="100%" stopColor="#00E5C7" stopOpacity="0"/></radialGradient>
        <radialGradient id="bp2"><stop offset="0%" stopColor="#7C3AED" stopOpacity="0.4"/><stop offset="100%" stopColor="#7C3AED" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="140" cy="140" r="130" fill="url(#bp2)">
        <animate attributeName="r" values="120;135;120" dur="6s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.3;0.5;0.3" dur="6s" repeatCount="indefinite"/>
      </circle>
      <circle cx="140" cy="140" r="90" fill="url(#bp1)">
        <animate attributeName="r" values="80;100;80" dur="4s" repeatCount="indefinite"/>
      </circle>
      <circle cx="140" cy="140" r="55" fill="rgba(0,229,199,0.15)" stroke="rgba(0,229,199,0.4)" strokeWidth="0.5">
        <animate attributeName="r" values="55;62;55" dur="3s" repeatCount="indefinite"/>
      </circle>
    </svg>
  );
}

window.HomeAurora = HomeAurora;
window.HomeData = HomeData;
window.HomeSoft = HomeSoft;
window.PulseAtoms = { Card, GlassCard, SportDot, MiniRing, ReadinessOrb, CoachOrb, StatCard, WeekStrip, TodayWorkoutHero, BodyHeatmapCard, ZoneBar };
