# Chat UX Redesign — Design Spec

**Datum:** 2026-06-27 · **Status:** afgestemd met Stef (brainstorm), klaar voor implementatieplan · **Context:** voortgekomen uit `AUDIT.md` (chat-UX bleek te versnipperd in de findings) — Stef's kernklacht: "chats zitten overal en nergens, geen historie, en de chat-UI zelf is mager."

## 1. Probleem & doel

De coach-chat is functioneel sterk (streaming, markdown, CoachOrb) maar:
- **Versnipperd:** ≥5 ingangen met inconsistent gedrag; een globale MiniChat-FAB op élk scherm naast een aparte Coach-tab.
- **Geen historie:** alle sessies staan in de DB (`chat_sessions` met titel/teller/timestamps) maar er is geen UI om eerdere gesprekken te zien of te hervatten.
- **Mager:** coach-antwoorden zijn platte markdown (geen datakaarten), geen zichtbare bevestiging bij write-backs, kale lege-/error-staten, geen bericht-metadata.

**Doel:** één heldere thuisbasis voor de chat, met sessie-historie en een rijkere, betrouwbaardere chat-ervaring — incrementeel gebouwd op bestaande patronen.

## 2. Beslissingen (vastgesteld met Stef)

| # | Onderwerp | Besluit |
|---|---|---|
| 1 | **Thuisbasis** | Eén ingang: de **Coach-tab**. Globale MiniChat-FAB **verwijderen**. Nudges (CoachCard, schema) openen de Coach-tab, eventueel geseed. |
| 2 | **Historie-model** | Coach-tab **opent in het actieve/laatste gesprek**; **klok-icoon** in de header opent een historie-paneel (bottom-sheet) om eerdere sessies te hervatten. |
| 3 | **Rijkheid** | Volledig: **inline datakaarten**, **write-back-bevestiging**, **rijke lege staat** (hero, géén starter-chips), **bericht-metadata + betere errors**. |
| 4 | **Suggestie-chips** | **Verwijderd** — Stef typt zelf. Lege staat = rustige hero. |
| 5 | **Bijlagen** | **Paperclip-icoon** (geen camera) in de invoerbalk. Gebruik: **maaltijdfoto's** (→ macro's + loggen), **form-/techniekcheck**, **algemeen/screenshots**. Géén voortgangsfoto's. |
| 6 | **Video** | Form-check via video = **fase-2/optioneel** (Claude ingestt geen video; vereist frame-sampling of alleen-opslaan). Aparte beslissing later. |
| 7 | **Bouwaanpak** | **Incrementeel**, voortbouwend op het bestaande write-back-tag-mechanisme. |

## 3. Ontwerp

### 3.1 Ingang & navigatie
- De **Coach-tab** onderin is de enige vaste ingang naar `/chat`.
- `src/components/layout/MiniChat.tsx` verwijderen + de mount in `src/app/(app)/layout.tsx`.
- Het CoachOrb-icoon in de home-header blijft als shortcut naar de Coach-tab (zelfde bestemming, geen overlap).
- Nudges (`CoachCard`, schema-nudge) openen de Coach-tab met hun seed. Per nudge-signaal onthouden we de sessie-id (localStorage, gekoppeld aan `signalId`); dezelfde nudge nogmaals tikken → **hervat** dat gesprek i.p.v. een orphan-sessie. (Lost audit **UX-09**.)

### 3.2 Sessie-historie
- Coach-tab opent in de actieve/laatste sessie (huidig gedrag).
- Header: naast "nieuwe chat" (✎) een **klok-icoon** → opent `ChatHistoryPanel` (bottom-sheet, conform bestaand `Sheet`-patroon).
- Paneel: bovenaan "Nieuwe chat", daaronder sessies nieuw→oud met **titel + relatieve datum + berichtenteller**. Tik = hervat. **Vegen = verwijderen.**
- Titels bestaan al (auto-gegenereerd); we tónen ze alleen. **Geen** hernoemen/zoeken in v1 (YAGNI).
- Lost audit **UX-01**.

### 3.3 Chat-UI & states
- **Lege staat:** rustige hero (grote CoachOrb + "Hoi Stef 👋" + subregel "Stel een vraag, log een maaltijd, of stuur een foto via 📎"). Géén starter-chips.
- **Berichten:** bestaande bubbel-stijl (user rechts/neutraal, coach links/gradient + kleine CoachOrb) + **timestamps** en een **tijd-scheider**. (Lost audit **UX-03** aria-live mee in de implementatie.)
- **Invoer:** paperclip-bijlageknop links; textarea krijgt `aria-label` + zichtbare focus-ring; `autoFocus` weg. (Lost audit **UX-04**, **UX-08**.)
- **Errors:** duidelijke fout-/credit-melding + retry (sluit aan op audit AI-03).
- Stijl volgt `design/design_handoff_pulse_v2` (Coach-scherm): dark, CoachOrb coral `#D97757`, teal `#00E5C7`, gradient-bubbels.

### 3.4 Datakaarten (mechanisme)
Uitbreiding van het bestaande write-back-tag-mechanisme (`writebacks.ts`), twee soorten:
1. **Bevestigingskaarten (write-backs):** `WritebackOutcome` krijgt een `card`-veld; bij succes sturen we na de stream een SSE-event `data: {"__card": {...}}`. De frontend hangt 'm als teal "✓ gelogd"-chip onder het coach-bericht. (Lost audit **UX-02**.)
2. **Informatiekaarten:** een **gesloten set** getypte tags die de coach mag uitschrijven: `<workout_card>`, `<weekplan_card>`, `<stat_card>`. Elk met (a) een Zod-schema, (b) een React-component. `createStreamTagStripper` wordt uitgebreid zodat deze tags uit de zichtbare tekst verdwijnen.

**Levering:** beide soorten kaarten bereiken de frontend via hetzelfde `__card`-SSE-kanaal (write-back-kaarten en geëxtraheerde informatiekaarten worden na de prozatekst toegevoegd), zodat er één render-pad is.

**Registry (frontend):** `CardRenderer` mapt `card.type` → component in `src/components/chat/cards/` (één bestand per type + `index.ts`). Onbekend type → niets tonen (graceful). Kaarten renderen **onderaan** het coach-bericht (na de prozatekst).

**Contract:** instructie wanneer/hoe de coach deze tags uitschrijft komt in `src/lib/ai/prompts/chat-system.ts` (bij de bestaande write-back-contracten). Gesloten set + Zod = geen gehallucineerde kaarten.

### 3.5 Foto's / bijlagen
- **Upload:** paperclip → bestandskiezer (`image/*`); client verkleint (max ~1568px, Claude-vision-richtlijn) → upload naar privé **Supabase Storage-bucket** `chat-attachments/{user_id}/{uuid}` (owner-only policy).
- **Naar de coach:** als **multimodaal image-block** in het bericht (Sonnet 4.6 = vision).
- **Rendering:** thumbnail in de gebruikersbubbel (signed URL).
- **Maaltijdfoto → loggen:** de coach schrijft gewoon `<nutrition_log>` uit → **hergebruikt het bestaande nutrition-write-back-pad**. Form-check & screenshots = puur analyse, geen write-back.
- **Privacy/kosten:** foto's gaan naar Anthropic (vision) + privé-opslag — past binnen de single-user/hygiëne-keuze. Beeldinhoud niet loggen; foto-tokens vallen onder de per-request cost-cap (plan T1.2).

## 4. Data-model & API

**Migratie** `supabase/migrations/<ts>_chat_attachments.sql`:
- `chat_messages.attachments jsonb` (default `[]`) — array van `{ path, mime, w, h }`.
- Privé Storage-bucket `chat-attachments` + RLS-policy (owner-only op `{user_id}/...`).
- (`chat_sessions` bestaat al — geen wijziging nodig.)

**Endpoints:**
- `GET /api/chat/sessions` → `[{ id, title, last_message_at, message_count }]`, reverse-chron, auth-gated.
- `DELETE /api/chat/sessions/[id]` → sessie + bijbehorende berichten verwijderen, owner-check. (FK `chat_messages → chat_sessions` bij implementatie verifiëren; expliciet `chat_messages` verwijderen als die niet `ON DELETE CASCADE` is.)
- `POST /api/chat/attachments` → signed upload / opslag-referentie (of directe Supabase-client-upload met signed URL).
- `GET /api/chat/history?session_id=` → ongewijzigd (laadt gekozen sessie).
- `POST /api/chat` → uitgebreid: accepteert attachment-refs, bouwt multimodaal bericht, emit `__card`-events, `after()` voor fire-and-forget extractors (neemt audit **AI-01** mee).

## 5. Data-flow
- **Versturen:** typen/bijlage → (foto naar Storage) → `POST /api/chat` (tekst + attachment-refs) → route bouwt multimodaal bericht → Sonnet streamt → stripper haalt kaart/write-back-tags uit zichtbare tekst → bij stream-close: `applyWritebacks` + `__card`-events → berichten (+`attachments`) opslaan → `after()` draait memory/belief-extractors.
- **Laden:** Coach-tab mount → `GET /api/chat/history` (laatste) of gekozen sessie. Klok → `GET /api/chat/sessions` → paneel → kies → laad via `session_id`.

## 6. Bestandsstructuur

*Weg:* `src/components/layout/MiniChat.tsx`, mount in `src/app/(app)/layout.tsx`, `src/components/chat/ChatSuggestions.tsx`.
*Nieuw:* `src/app/api/chat/sessions/route.ts`, `src/app/api/chat/sessions/[id]/route.ts`, `src/app/api/chat/attachments/route.ts`, `src/components/chat/ChatHistoryPanel.tsx`, `src/components/chat/cards/{CardRenderer,WorkoutCard,WeekplanCard,StatCard,WritebackCard,index}.{tsx,ts}`, `src/lib/ai/chat/cards.ts`, migratie `<ts>_chat_attachments.sql`.
*Gewijzigd:* `src/components/chat/{ChatPage,ChatInterface,ChatMessage,ChatInput}.tsx`, `src/components/dashboard/v2/CoachCard.tsx`, `src/lib/ai/chat/writebacks.ts`, `src/app/api/chat/route.ts`, `src/lib/ai/prompts/chat-system.ts`.

## 7. Teststrategie (TDD waar het telt)
- **Unit (vitest):** kaart-parser + Zod (geldig/ongeldig/afgekapt); stripper verwijdert nieuwe tags over chunk-grenzen; `WritebackOutcome.card`-mapping; sessions-endpoint (lijst/delete) met gemockte Supabase; attachment-validatie.
- **Component:** `CardRenderer` (types + onbekend-fallback); `ChatMessage` (kaart + thumbnail + timestamp).
- **E2E (playwright):** Coach-tab → historie-paneel → hervat sessie; bericht → kaart rendert; foto → thumbnail in bubbel; nieuwe chat reset.

## 8. Buiten scope / later
- **Video** voor form-check (fase-2; aparte beslissing — frame-sampling vs. alleen-opslaan).
- Sessies **hernoemen** en **zoeken** (auto-titel volstaat v1).
- **Voortgangs-/fysiekfoto's** + vergelijk-galerij (niet gekozen).
- Suggestie-chips / `/api/chat/suggestions` (vervalt; endpoint kan blijven of opgeruimd worden).

## 9. Relatie tot de audit
Deze redesign vervangt de losse UX-findings uit `AUDIT.md` door één samenhangend werkblok en neemt mee: **UX-01** (sessielijst), **UX-02** (write-back-bevestiging), **UX-03** (aria-live), **UX-04** (input a11y), **UX-08** (autoFocus), **UX-09** (sessie-continuïteit), en **AI-01** (fire-and-forget met `after()`, in de chat-route). **UX-07** (MiniChat-dialog-a11y) vervalt — MiniChat wordt verwijderd. **UX-05/UX-06** (contrast/focus-ring tokens) blijven losse audit-taken (design-token-beslissing).

## 10. Open punten
- **Video-beslissing** (fase-2): frame-sampling of alleen-opslaan?
- **Drempels:** max foto-grootte/aantal per bericht (valt onder cost-cap T1.2).
