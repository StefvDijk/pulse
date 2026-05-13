---
name: audit-prod-readiness
description: Beoordeelt of een Next.js + Supabase + AI app klaar is voor 100+ externe betalende klanten. Checkt infra-tier limieten, multi-tenancy, billing, observability, GDPR, support. Gebruik tijdens fase 6 van de Pulse audit.
---

# Pulse Productie-gereedheid voor 100+ Klanten

Doel: een go/no-go per categorie + concrete roadmap.

## Werkstappen

### 1. Infra-tier reality check
Lees `vercel.json` en bestaande configuratie. Vergelijk met:

**Vercel Hobby:**
- 100 GB-hours / maand serverless function execution
- 2 cron jobs (Pulse heeft er 3 — BLOCKER)
- 100 GB bandwidth
- Geen team-features

**Vercel Pro** ($20/mo per member):
- 1000 GB-hours
- Unlimited cron
- Logs retention 1 dag
- Geen SOC 2 (nodig voor enterprise)

**Vercel Enterprise:** $$$, vereist voor SOC 2 / SSO / dedicated support.

**Supabase Free:**
- 500 MB DB
- 1 GB storage
- 50K monthly active users
- 7 dagen log retention
- **Project paused na 1 week inactiviteit** — BLOCKER voor productie

**Supabase Pro:** $25/mo, 8GB DB, geen pause.

Bij 100 users met dagelijkse Hevy + HAE syncs:
- Schatting: 500MB-2GB aan data per maand toegevoegd
- Aggregaties + chat_messages + workout data tellen op

### 2. Multi-tenancy audit
Voor de seed scripts (`scripts/seed-*.ts`):
- Worden ze per-user gedraaid bij signup?
- `exercise_definitions` is gedeeld of per user?
- Custom instructions in `user_settings` per user — gecheckt?

### 3. Onboarding flow
Loop door /auth/signup en daarna:
- Wat ziet een nieuwe user op `/`? Lege home?
- Hoe verbinden ze Hevy? Documentatie?
- HAE installatie-guide? (iOS-app extern, ze moeten zelf de push-endpoint configureren)
- Google Calendar OAuth — wordt 'ie tijdens onboarding gevraagd of pas in /settings?

Time-to-value meten:
- Stap 1: signup → 30 sec
- Stap 2: API key Hevy invullen → 5 min (moet ze ophalen)
- Stap 3: HAE installeren + configureren → 15 min, iOS-only
- Stap 4: eerste workout sync → wachten op cron of trigger
- **Total: 20+ min voor eerste "aha". TE LANG.**

Verbetering: demo-mode met seed-data zodat user direct iets ziet?

### 4. Billing
Geen Stripe integration aanwezig? Plan?
- Stripe Checkout voor self-serve
- Subscription levels
- Wat bij billing-failure (downgrade vs lockout)?
- Tax (EU VAT) — Stripe Tax of merchant of record (Paddle, Lemon Squeezy)?

### 5. Email / transactional
- Welke provider? (Resend / SendGrid / Postmark)
- Welke emails verstuurd?
  - Account verification?
  - Wachtwoord reset?
  - Weekly digest (zou differentiator zijn)?
  - Billing receipts?

### 6. Observability
**Error tracking:** Sentry geconfigureerd? Anders: P0, want je weet niet wat er stuk gaat in productie.

**Logging:** structured logs naar Axiom/Datadog/Better Stack of gewoon console.log?

**Uptime:** uptime-monitor op `/api/health` endpoint? Bestaat dat endpoint?

**Performance:** Vercel Analytics, Speed Insights?

**Status page:** statuspage.io / Atlassian / instatus.com?

### 7. Data lifecycle / GDPR
- Backup strategie: Supabase Pro = daily automatic. PITR (point-in-time-recovery) vereist Pro+.
- Export endpoint (`GET /api/me/export`)? Klaar voor GDPR DSAR.
- Delete endpoint (`DELETE /api/me`)? Echt cascade-delete van alle user-data, of soft-delete?
- DPA's getekend met: Anthropic, Supabase, Vercel, Hevy, Health Auto Export, Google?

### 8. Legal
- Privacy Policy + ToS — heeft Stef die? Pulse verwerkt health-adjacent data, dat is gevoelig.
- Cookie consent flow (EU verplicht voor third-party cookies)?
- AI Act (EU, in werking 2026) — Pulse is GPAI-downstream, low risk, maar transparantieverplichtingen.

### 9. Support / feedback
- Helpdesk (Intercom / Plain / gewoon email)?
- In-app feedback (sentry user feedback, productlogic, etc.)?
- Documentatie / FAQ pagina?

### 10. Security baseline
Cross-check met security audit:
- 2FA voor users?
- Rate limiting op login/signup?
- Account recovery flow?

## Output
`06-production-readiness.md`:

### Sectie 1: Stoplicht-overzicht
| Categorie | Status | Blocker | Tijd to fix |
|-----------|--------|---------|-------------|
| Infra | 🔴 | Vercel Hobby + Supabase Free niet productie-rijp | 1 dag (config) + €45/mo (tiers) |
| Multi-tenancy | 🟡 | RLS-coverage check nodig | 1-3 dagen |
| Onboarding | 🔴 | 20+ min time-to-value | 1-2 weken |
| Billing | 🔴 | Geen Stripe | 1 week |
| Email | 🟡 | Provider ja, content nee | 3 dagen |
| Observability | 🔴 | Geen Sentry, geen uptime | 1 dag |
| GDPR | 🔴 | Geen export/delete | 1 week |
| Legal | 🔴 | Geen PP/ToS | 3 dagen (template + lawyer review) |
| Support | 🟡 | Geen helpdesk | 1 dag |

### Sectie 2: Go/no-go
Schrijf brutaal: "Pulse is op dit moment NIET productie-gereed voor 100 betalende klanten. De top 3 blockers zijn: [...]"

### Sectie 3: Roadmap-voorstel
- Week 1: Infra upgrade + Sentry + Stripe scaffolding
- Week 2: Onboarding herwerk + email flows
- Week 3: GDPR endpoints + legal docs
- Week 4: Beta-testing met 10 users
- Week 5-6: Open beta met 50 users
- Week 7+: Launch
