# CLAUDE-AI-LAYER.md — Bouwinstructies voor de Pulse AI-laag

## Context

Je bouwt de AI-laag van Pulse, een persoonlijk health & training dashboard. De data-pipeline (Hevy sync, Apple Health ingest, aggregatie-engine, auth, database) is af. Wat ontbreekt is alles wat met Claude/AI te maken heeft: de chat agent, voedingsanalyse, schema generatie, en de koppeling van dashboard componenten aan echte data.

Lees `PRD-AI-LAYER.md` voor de volledige specificatie van wat er gebouwd moet worden.

## Bestaande codebase

Het project is een Next.js 14+ app met App Router, TypeScript, Tailwind CSS, Supabase (PostgreSQL + Auth), en SWR. De structuur staat in `PRD.md` en de originele `CLAUDE.md`.

**Wat er al werkt:**
- Database schema: 20+ tabellen, migraties, RLS policies, indexen
- Hevy API sync: client, mappers, sync service, webhook, cron
- Apple Health ingest: parser, mappers, API endpoint
- Aggregatie-engine: daily, weekly, monthly berekeningen
- Auth: login/signup, middleware, profiel-trigger
- Navigatie: bottom nav (mobiel) + sidebar (desktop)
- Lege pagina scaffolds voor alle routes
- Exercise definitions seed script

**Wat er NIET werkt / ontbreekt:**
- Geen `@anthropic-ai/sdk` dependency
- Geen `recharts` of `swr` dependency
- Geen `react-markdown` dependency
- Geen AI prompts, geen chat agent, geen voedingsanalyse
- Dashboard/progressie/voeding pagina's zijn lege placeholders
- Geen data hooks (SWR)
- Geen floating mini-chat

## Tech Stack (aanvullingen op bestaand)

```bash
# Installeer EERST deze dependencies
pnpm add @anthropic-ai/sdk recharts swr react-markdown remark-gfm
```

## Werkwijze

### Bouwvolgorde (strikt volgen)

Bouw in deze exacte volgorde. Elke stap bouwt voort op de vorige.

#### Stap 1: Anthropic SDK client
Maak `src/lib/ai/client.ts`:
- Initialiseer Anthropic client met `ANTHROPIC_API_KEY` uit env
- Helper functie voor streaming responses (returns ReadableStream)
- Helper functie voor JSON mode (voor voedingsanalyse)
- Error handling (rate limits, auth errors, timeouts)
- Model: `claude-sonnet-4-20250514`

#### Stap 2: System prompt
Maak `src/lib/ai/prompts/chat-system.ts`:
- Export een functie `buildSystemPrompt(profile, activeSchema, activeInjuries, activeGoals)` die de volledige system prompt retourneert
- De prompt moet ALLE context bevatten uit PRD-AI-LAYER.md sectie 2.2.1
- Stef's profiel, blessures, motivatiepatroon, voedingsdoelen, geleerde lessen
- De prompt is in het Nederlands

**KRITIEK:** De system prompt is het verschil tussen een generieke fitness-bot en een coach die Stef kent. Neem de tijd hiervoor. Alles uit de PRD sectie 2.2.1 moet erin.

#### Stap 3: Vraagtype classifier
Maak `src/lib/ai/classifier.ts`:
- Export `classifyQuestion(message: string): QuestionType`
- Keyword-based matching (geen extra Claude call)
- Types: `nutrition_log`, `nutrition_question`, `injury_report`, `schema_request`, `progress_question`, `weekly_review`, `general_chat`
- Gebruik de trigger keywords uit PRD-AI-LAYER.md sectie 2.2.2

```typescript
export type QuestionType =
  | 'nutrition_log'
  | 'nutrition_question'
  | 'injury_report'
  | 'schema_request'
  | 'progress_question'
  | 'weekly_review'
  | 'general_chat'
```

#### Stap 4: Context assembler
Maak `src/lib/ai/context-assembler.ts`:
- Export `assembleContext(userId: string, questionType: QuestionType): Promise<string>`
- Per vraagtype: de juiste Supabase queries (zie PRD-AI-LAYER.md sectie 2.2.2)
- Compressie: recente data volledig, oudere data samengevat
- Output als geformatteerde tekst string (<8000 tokens)
- Gebruik de admin Supabase client (service role, bypast RLS)

**Data queries per type:**

```typescript
// nutrition_log
- nutrition_logs WHERE date = today
- daily_activity WHERE date = today (calorieën verbrand)
- workouts WHERE started_at = today
- profiles (gewicht, doelen)

// injury_report
- workouts + exercises + sets WHERE started_at > 14 dagen geleden (volledig)
- weekly_aggregations WHERE week_start > 4 weken geleden (spiergroep verdeling)
- injury_logs WHERE body_location = relevant (eerdere blessures)
- training_schemas WHERE is_active = true

// weekly_review
- weekly_aggregations WHERE week_start = deze week
- weekly_aggregations WHERE week_start = vorige 4 weken (vergelijking)
- workouts + exercises + sets van deze week (volledig)
- daily_nutrition_summary van deze week
- injury_logs van deze week
- goals WHERE status = active

// progress_question
- weekly_aggregations (range afhankelijk van vraag)
- personal_records (recent first)
- goals WHERE status = active

// schema_request
- training_schemas WHERE is_active = true (volledig)
- schema_block_summaries (vorige 3)
- weekly_aggregations afgelopen 3 maanden (progressie per bewegingspatroon)
- goals WHERE status = active
- injury_logs WHERE status = active

// general_chat
- profiles
- goals WHERE status = active
- training_schemas WHERE is_active = true (light: alleen titel + week)
```

**Output format per query resultaat:**

```
--- WORKOUTS DEZE WEEK ---
Ma 24/3: Upper A — DB Bench 4x10@16kg, Cable Row 3x12@35kg, ...
Di 25/3: Lower A — Goblet Squat 4x10@18kg, Leg Press 3x12@100kg, ...
[etc.]

--- VOEDING DEZE WEEK (gemiddelden) ---
Gem. calorieën: 2.050 kcal/dag (doel: 2.100)
Gem. eiwit: 128g/dag (doel: 140g)

--- ACTIEVE BLESSURES ---
Rechter schouder: verdenking labrumpathologie, geen overhead pressing, MRI pending
[etc.]

--- PROGRESSIE (vergelijking vorige week) ---
DB Bench: 16kg x 10 → 16kg x 10 (=)
Goblet Squat: 16kg x 10 → 18kg x 10 (↑)
[etc.]
```

#### Stap 5: Chat API route
Maak `src/app/api/chat/route.ts`:
- POST endpoint met streaming (Server-Sent Events)
- Body: `{ message: string, session_id?: string }`
- Auth check via Supabase session
- Flow: classify → assemble context → build prompt → stream → save
- Chat history: haal laatste 20 berichten op uit chat_messages voor de sessie
- Maak/update chat_sessions
- Sla user message + assistant response op in chat_messages

```typescript
// Streaming setup
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// In de route handler:
const stream = anthropic.messages.stream({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  system: systemPrompt,
  messages: [...chatHistory, { role: 'user', content: contextualizedMessage }],
})

// Return als ReadableStream
return new Response(
  new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
        }
      }
      // Na streaming: sla response op
      const finalMessage = await stream.finalMessage()
      // Save to chat_messages...
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
      controller.close()
    }
  }),
  { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
)
```

#### Stap 6: Chat UI componenten
Bouw in deze volgorde:

**`src/hooks/useChat.ts`:**
- SWR voor chat sessies en berichten
- Functie `sendMessage(message)` die POST naar `/api/chat` doet en SSE parsed
- Streaming state management (isStreaming, currentStreamedText)

**`src/components/chat/ChatMessage.tsx`:**
- User berichten: rechts, accent kleur
- Assistant berichten: links, donkere achtergrond
- Markdown rendering via react-markdown + remark-gfm
- Styling consistent met Pulse design tokens

**`src/components/chat/ChatInput.tsx`:**
- Tekstveld + submit button
- Enter = verstuur, Shift+Enter = newline
- Disabled tijdens streaming
- Auto-focus

**`src/components/chat/ChatSuggestions.tsx`:**
- 3-4 klikbare suggesties
- Verdwijnen na eerste bericht
- Context-afhankelijk (check dag van de week)

**`src/components/chat/ChatInterface.tsx`:**
- Combineer Message, Input, Suggestions
- Scroll container met auto-scroll
- Loading state
- Session management

**`src/app/chat/page.tsx`:**
- Full page chat met ChatInterface

#### Stap 7: Voedingsanalyse
**`src/lib/ai/prompts/nutrition-analysis.ts`:**
- Prompt uit PRD-AI-LAYER.md sectie 2.3.1
- Output als JSON

**`src/app/api/nutrition/analyze/route.ts`:**
- POST, body: `{ input: string, date?: string, time?: string }`
- Auth check
- Claude call met JSON mode
- Parse response → opslaan in nutrition_logs
- Herbereken daily_nutrition_summary
- Return gestructureerde response

**Voedings-componenten:**
- NutritionInput, MacroSummary, ProteinTracker, DayIndicator
- Koppel aan echte data via `useNutritionData` hook

#### Stap 8: Dashboard met echte data
**`src/hooks/useDashboardData.ts`:**
- SWR hook die weekly_aggregations, daily_aggregations, actief schema ophaalt
- refreshInterval: 60000 (1 min)

**Dashboard componenten koppelen:**
- WorkloadMeter: ACWR uit weekly_aggregations
- SportSplit: gym/running/padel minuten uit daily_aggregations (week totaal)
- AdherenceTracker: vergelijk schema met voltooide workouts
- WeekSummaryCard: compacte stats

**`src/app/page.tsx`:**
- Grid layout met alle dashboard componenten
- Mobiel: single column
- Desktop: 2-3 kolommen

#### Stap 9: Floating mini-chat
**`src/components/layout/MiniChat.tsx`:**
- Floating button rechtsonder (boven bottom nav op mobiel)
- Klik = expand naar compact chat window (300x400px)
- Zelfde functionaliteit als full chat maar compact
- "Open volledig" link naar `/chat`
- Sluit bij klik buiten het window

Voeg toe aan `src/app/layout.tsx` (binnen `<main>`).

#### Stap 10: Kennismigratie seed script
Maak `scripts/seed-stef-data.ts`:
- Seed Stef's baseline metingen als personal_records
- Seed huidige schema (week 5-8 upper/lower) als training_schema
- Seed block summary week 1-4
- Seed actieve blessures (schouder, knieën, onderrug)
- Seed doelen (pull-up, bench 20kg, plank 2:00, etc.)

---

## Coding Standards (aanvulling op bestaand)

### AI/Chat specifiek
- **Streaming:** Altijd Anthropic SDK streaming, nooit wachten op volledige response
- **System prompt:** In `src/lib/ai/prompts/`, nooit hardcoded in route handlers
- **Context budget:** Max ~8000 tokens data-context per request
- **Write-back:** Als Claude voedingsdata, blessures, of schema's genereert in de chat, sla dit op in de database. Detectie via de classifier, niet via response parsing
- **Model:** `claude-sonnet-4-20250514` voor alles
- **Taal:** Alle prompts en agent-responses in het Nederlands

### Componenten
- **Charts:** Recharts met Pulse design tokens (donkere achtergrond, sport-kleuren)
- **Markdown:** react-markdown + remark-gfm voor chat berichten
- **Data fetching:** SWR met custom hooks in `src/hooks/`
- **Loading states:** Skeleton components voor alle async content

### Belangrijk: Environment variable
Zorg dat `ANTHROPIC_API_KEY` in `.env.local` staat:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Test strategie

Na elke stap: test handmatig.

1. **Na stap 1:** Verificeer dat Anthropic client kan connecten (simpele non-streaming call)
2. **Na stap 5:** Test chat endpoint met curl:
   ```bash
   curl -X POST http://localhost:3000/api/chat \
     -H "Content-Type: application/json" \
     -H "Cookie: [auth cookie]" \
     -d '{"message": "Hoe was mijn week?"}'
   ```
3. **Na stap 6:** Chat UI werkt end-to-end, streaming zichtbaar
4. **Na stap 7:** Voedingsinput → macro's → opgeslagen → zichtbaar op voedingspagina
5. **Na stap 8:** Dashboard toont echte data (of "geen data" states als er nog niks is)

---

## Veelgemaakte fouten (voorkom deze)

1. **Vergeet geen auth check** in API routes. Elke route moet de Supabase session checken.
2. **Gebruik de admin client** voor context assembler queries (service role bypast RLS).
3. **Gebruik de user client** voor client-side data fetching (SWR hooks).
4. **Stream correct:** SSE format is `data: {json}\n\n` met dubbele newline.
5. **Chat history:** Stuur de laatste 20 berichten mee naar Claude, niet alle berichten ooit.
6. **Token budget:** Tel je context. Als het boven ~8000 tokens komt, comprimeer oudere data.
7. **Recharts SSR:** Recharts werkt niet met Server Components. Gebruik `'use client'` directive.
8. **Markdown in chat:** Sanitize niet te agressief — Claude stuurt tabellen, code blocks, bold/italic die allemaal moeten renderen.

---

## Wanneer stoppen en vragen

1. Als de Anthropic API een onverwachte error geeft
2. Als de streaming setup niet werkt (SSE kan tricky zijn met Next.js App Router)
3. Als de context assembler te veel tokens produceert
4. Als je niet zeker bent over de system prompt formulering
5. Als Recharts charts niet renderen in het dark theme
