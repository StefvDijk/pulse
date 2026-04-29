// Pulse v2 Design Tokens — Cinematic dark, vivid sport accents
window.PulseTokens = {
  // Backgrounds — softer dark, slightly lifted
  bg: {
    page: '#15171F',           // app background — softer than near-black
    surface: '#1E2230',        // card base
    elevated: '#272C3B',       // elevated card
    glass: 'rgba(255,255,255,0.05)',
    glassStrong: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.12)',
  },
  text: {
    primary: '#F5F5F7',
    secondary: 'rgba(245,245,247,0.66)',
    tertiary: 'rgba(245,245,247,0.46)',
    muted: 'rgba(245,245,247,0.26)',
  },
  // Sport colors — saturated, modern, vivid
  sport: {
    gym:   { base: '#00E5C7', light: 'rgba(0,229,199,0.18)', glow: 'rgba(0,229,199,0.5)', dark: '#0A4F45' },
    run:   { base: '#FF5E3A', light: 'rgba(255,94,58,0.18)', glow: 'rgba(255,94,58,0.55)', dark: '#5C1F11' },
    padel: { base: '#FFB020', light: 'rgba(255,176,32,0.18)', glow: 'rgba(255,176,32,0.5)', dark: '#5C3D08' },
    cycle: { base: '#9CFF4F', light: 'rgba(156,255,79,0.18)', glow: 'rgba(156,255,79,0.5)', dark: '#314E18' },
  },
  status: {
    good: '#22D67A',
    warn: '#FFB020',
    bad: '#FF4D6D',
  },
  // Hero gradients — Apple Fitness+ inspired aurora
  gradients: {
    aurora: 'linear-gradient(135deg, #FF5E3A 0%, #FF2D87 35%, #7C3AED 70%, #00E5C7 100%)',
    fire:   'linear-gradient(135deg, #FFB020 0%, #FF5E3A 50%, #FF2D87 100%)',
    cool:   'linear-gradient(135deg, #00E5C7 0%, #4FC3F7 50%, #7C3AED 100%)',
    ember:  'radial-gradient(circle at 30% 30%, #FF5E3A 0%, #7C2D12 50%, transparent 80%)',
  },
  // Apple system font stack — SF Pro on Apple, system fallback elsewhere
  font: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Helvetica Neue", sans-serif',
  fontMono: 'ui-monospace, "SF Mono", Menlo, monospace',
  radius: { sm: 10, md: 16, lg: 22, xl: 28 },
};
