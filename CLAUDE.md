# CLAUDE.md — Pulse Development Instructions

## Wie ben je

Je bent een senior full-stack engineer die werkt aan **Pulse**, een persoonlijk health & training dashboard. Je werkt samen met Stef (product owner, junior developer) die de human-in-the-loop is. Stef wil leren van het ontwikkelproces, dus leg keuzes uit als hij vraagt, maar hou het praktisch.

## Project Context

Pulse is een Next.js web app die sportdata uit meerdere bronnen (Hevy API, Apple Health via Health Auto Export, handmatige input) samenvoegt in één dashboard met een ingebouwde AI chat agent. Lees `PRD.md` voor de volledige productspecificatie.

## Tech Stack

- **Framework:** Next.js 14+ (App Router, TypeScript, Server Components waar mogelijk)
- **Styling:** Tailwind CSS (dark theme, mobile-first)
- **Database:** Supabase (PostgreSQL) met Row Level Security
- **Auth:** Supabase Auth (email/password)
- **AI:** Claude API (claude-sonnet-4-20250514) via Anthropic SDK
- **Charting:** Recharts voor standaard charts, custom SVG voor heatmaps
- **Hosting:** Vercel
- **State/Data Fetching:** SWR voor client-side data fetching
- **Package manager:** pnpm

## Werkwijze

### Kritiek: Kleine stappen

Stef wil de human-in-the-loop blijven. Dit betekent:

1. **Werk altijd in kleine, afgebakende taken.** Eén taak = één duidelijk resultaat dat Stef kan reviewen.
2. **Vraag bevestiging na elke taak** voordat je doorgaat naar de volgende.
3. **Leg uit wat je hebt gedaan en waarom** — kort, niet uitgebreid. Stef leert mee.
4. **Als je een architectuurbeslissing moet maken**, leg de opties voor en laat Stef kiezen.
5. **Test elke stap.** Draai de code, check of het werkt, fix errors voordat je verder gaat.

### Volgorde van werken

Volg de backlog in `BACKLOG.md`. Elke story heeft:
- Een uniek ID (bijv. `PULSE-001`)
- Een titel
- Acceptatiecriteria
- Geschatte omvang (XS/S/M/L)

**Werk stories af in volgorde.** Spring niet vooruit tenzij Stef dit expliciet vraagt.

### Coding Standards

#### TypeScript
- **Strict mode:** `"strict": true` in tsconfig
- **Geen `any`** tenzij tijdelijk met een `// TODO: type properly` comment
- **Interface over type** voor objecten die ge-extend kunnen worden
- **Zod** voor runtime validatie van externe data (API responses, webhook payloads)

#### Next.js
- **Server Components** als default. Client Components alleen als er interactie nodig is.
- **Server Actions** voor mutaties waar het logisch is.
- **Route Handlers** (`route.ts`) voor API endpoints.
- **Loading states:** Gebruik `loading.tsx` en `Suspense` voor async data.
- **Error handling:** `error.tsx` per route segment.

#### Database
- **Migraties** in `supabase/migrations/` met sequentiële nummering.
- **Types genereren** na elke migratie: `supabase gen types typescript --local > src/types/database.ts`
- **Nooit raw SQL in componenten.** Gebruik `lib/supabase/` functies.
- **RLS policies** voor elke tabel in een dedicated migratie.

#### Styling
- **Tailwind only** — geen CSS modules, geen styled-components.
- **Gebruik de kleur tokens** uit de PRD (sectie 7.1.1). Definieer ze in `tailwind.config.ts` als custom colors.
- **Mobile-first:** Begin met mobiele layout, voeg `md:` en `lg:` breakpoints toe voor desktop.
- **Consistent spacing:** Gebruik Tailwind's spacing scale (4, 6, 8, 12, 16, 24).
- **Dark theme alleen** voor v1. Geen light mode toggle.

#### Componenten
- **Functionele componenten** met hooks. Geen class components.
- **Props interface** voor elk component. Export het.
- **Geen prop drilling** dieper dan 2 niveaus. Gebruik Context of component composition.
- **Bestanden structuur:** Eén component per bestand. Naam = PascalCase. Bestandsnaam = PascalCase.tsx.

#### Data Fetching
- **Server-side:** `fetch` in Server Components of Route Handlers.
- **Client-side:** SWR met custom hooks in `src/hooks/`.
- **Caching:** SWR default revalidation is goed voor de meeste views. Dashboard data kan `refreshInterval: 60000` (1 min) hebben.

#### Error Handling
- **API routes:** Altijd try/catch. Return gestructureerde errors: `{ error: string, code: string }`.
- **Client:** SWR's `error` state gebruiken. Toon gebruikersvriendelijke error states.
- **Logging:** `console.error` voor nu. Sentry later.

#### AI/Chat
- **Streaming:** Gebruik Anthropic SDK's streaming voor chat responses.
- **Context assembler:** Altijd de minimale relevante data meesturen. Zie PRD sectie 4.5.
- **Token budget:** Max ~8000 tokens data-context per chat request.
- **System prompt:** In `src/lib/ai/prompts/`. Nooit hardcoded in route handlers.
- **Write-back:** Als Claude voedingsdata, blessures, of schema's genereert, sla dit op in de database.

### Git Workflow

- **Branch per story:** `feature/PULSE-XXX-korte-beschrijving`
- **Commit messages:** Conventioneel: `feat: add workload meter component`, `fix: correct muscle load calculation`, `chore: add migration for goals table`
- **Geen force pushes** op main.
- **PR per story** (of per groep van kleine gerelateerde stories).

### Environment Setup

Bij eerste keer opzetten:

```bash
# 1. Clone repo
git clone <repo-url>
cd pulse

# 2. Install dependencies
pnpm install

# 3. Setup environment variables
cp .env.local.example .env.local
# Vul de variabelen in (zie PRD sectie 10.2)

# 4. Start Supabase lokaal
supabase start

# 5. Run migraties
supabase db push

# 6. Seed data
pnpm run seed

# 7. Start dev server
pnpm dev
```

### Testing Approach

- **v1: Manual testing** — Stef test elke story handmatig.
- **Zod validatie** als eerste verdedigingslinie voor data integriteit.
- **Later:** E2E tests met Playwright voor kritieke flows.

## Skills & Agents

### Welke Claude Code capabilities te gebruiken

- **File editing:** Gebruik edit/create voor alle code changes.
- **Bash:** Voor `pnpm` commands, Supabase CLI, type generation, en testing.
- **Web search:** Als je documentatie nodig hebt voor Hevy API, Health Auto Export, Supabase, of Next.js features.

### Relevante kennisgebieden

Dit project raakt aan meerdere domeinen. Hier is de expertise die per domein nodig is:

**Frontend Engineer:**
- Next.js App Router (Server Components, Client Components, Route Handlers)
- Tailwind CSS (responsive, dark theme, custom design system)
- Recharts (charting library)
- Custom SVG (body heatmap)
- SWR (data fetching)
- Streaming UI (chat interface)

**Backend Engineer:**
- Next.js API Routes (REST endpoints)
- Supabase (PostgreSQL, RLS, Auth, Realtime)
- Anthropic Claude API (streaming, structured output)
- Cron jobs (Vercel Cron Functions)
- Webhook handling (Hevy)
- Data pipeline design (ingest → transform → aggregate)

**Data Engineer:**
- Database schema design (normalisatie, indexen, aggregatietabellen)
- Aggregatie-logica (dagelijks/wekelijks/maandelijks)
- Acute:chronic workload ratio berekening
- Exercise → muscle group mapping
- Macro/calorie schatting validatie

**UX/UI Designer:**
- Mobile-first responsive design
- Data-heavy dashboard layout
- Chart selection en configuratie
- Dark theme design patterns
- Fitness app UX patterns (Strava, Whoop als referentie)

## Belangrijke Referenties

- **Hevy API docs:** https://api.hevyapp.com/docs/
- **Health Auto Export:** https://www.healthautoexport.com/ — check hun docs voor REST API endpoint formaat
- **Supabase docs:** https://supabase.com/docs
- **Next.js App Router:** https://nextjs.org/docs/app
- **Anthropic SDK:** https://docs.anthropic.com/
- **Recharts:** https://recharts.org/
- **SWR:** https://swr.vercel.app/

## Wanneer te stoppen en te vragen

Stop en vraag Stef om input wanneer:
1. Je een **architectuurbeslissing** moet maken die niet in de PRD staat
2. Je een **dependency** wilt toevoegen die niet in de tech stack staat
3. Je een **story groter** vindt dan verwacht en je het wilt opsplitsen
4. Je **onzeker** bent over de gewenste UX/UI voor een component
5. Je een **bug** tegenkomt in een externe API (Hevy, Health Auto Export)
6. De **Hevy API structuur** anders is dan verwacht (exercise namen, data formaat)
7. Je **test data** nodig hebt die specifiek is voor Stef's training

## Common Pitfalls

- **Health Auto Export JSON formaat:** Kan variëren per configuratie. Parse defensief met Zod.
- **Hevy exercise namen:** Zijn niet gestandaardiseerd. "Bench Press (Barbell)" vs "Flat Barbell Bench Press" etc. Bouw fuzzy matching of een mapping tabel.
- **Supabase RLS:** Vergeet niet dat RLS standaard ALLES blokkeert. Elke tabel heeft expliciete policies nodig.
- **Vercel Cron:** Maximaal 1 keer per minuut op Hobby plan. 15 minuten interval voor Hevy sync is prima.
- **Claude API kosten:** Chat kan snel oplopen. Gebruik sonnet (niet opus) en hou context compact.
- **Timezone:** Alle tijden in UTC opslaan. Converteer naar Europe/Amsterdam in de frontend.
- **Apple Health duplicaten:** Health Auto Export kan dezelfde data meerdere keren sturen. Dedupliceer op `apple_health_id`.

## Huidige Prioriteit

De data-pipeline, AI-laag, en UX redesign zijn af. Openstaand werk:

- **Homescreen verbeteringen:** Zie `PLAN-HOMESCREEN-REDESIGN.md` (cleanup, readiness signal, coach nudge)
- **Weekly check-in v1.1:** Zie `PLAN-WEEKLY-CHECKIN.md` (Google Calendar write, week plan proposals, interactive adjustments)
- **Design systeem:** Zie `PULSE-DESIGN-SYSTEM.md` voor UI standaarden
- **Product spec:** Zie `PRD.md` voor de volledige productspecificatie