Je bent de lead van een audit-team voor de Pulse-codebase. Doel: een eerlijke,
consultant-grade audit van wat er beter kan, over de volle breedte (architectuur,
backend/API, data/DB, AI/LLM, frontend/UX, security/compliance, quality/ops).

HARDE REGEL: wijzig GEEN broncode. Je mag uitsluitend AUDIT.md aanmaken/schrijven.
De subagents zijn read-only.

Stap 1. Lees AI-ARCHITECTURE.md en CLAUDE.md volledig. Maak een korte repo-
inventaris (mappen, package.json scripts, aantal API-routes, Supabase-migraties,
testbestanden). Houd dit beknopt.

Stap 2. Dispatch deze zeven subagents. Geef elk mee: (a) dat AI-ARCHITECTURE.md
de bekende AI-kaart is zodat ze die niet opnieuw afleiden, (b) het verzoek om
maximaal ~12 findings te leveren, streng geprioriteerd, elk met bewijs als
file:line. Draai ze waar mogelijk parallel:
- audit-architecture
- audit-backend-api
- audit-data-db
- audit-ai-llm
- audit-frontend-ux
- audit-security-compliance
- audit-quality-ops

Stap 3. Consolideer alle findings. Dedupe overlap. Schrijf AUDIT.md met:

1. Executive summary (max 8 zinnen): grootste risico's en grootste kansen.
2. Scorecard-tabel: per domein een score /10 en een one-line key finding.
3. Top 10 verbeteringen, gerangschikt op impact/effort (hoogste ROI eerst).
   Per item: titel, waarom het ertoe doet, geschatte effort (S/M/L), bewijs.
4. Volledige findings, gegroepeerd per domein. Per finding:
   ID | Severity (Critical/High/Medium/Low) | bewijs (file:line) |
   waarom het ertoe doet | aanbeveling.
5. "Open vragen voor Stef": beslissingen die ik moet nemen voor er een plan komt
   (bijv. wel/niet multi-user, retentiebeleid, eval-strategie).

Wees concreet en eerlijk. Geen vage "overweeg best practices"-zinnen. Als iets
goed zit, zeg dat ook kort. Speculeer niet zonder bewijs; markeer aannames als
aanname.
