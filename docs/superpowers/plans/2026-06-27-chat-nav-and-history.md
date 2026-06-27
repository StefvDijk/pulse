# Chat Redesign — Plan 1: Navigation & Session History

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Coach tab the single home for chat — remove the global floating MiniChat, and add a session-history panel so past conversations can be browsed, resumed, and deleted.

**Architecture:** Two new auth-gated API routes (`GET /api/chat/sessions`, `DELETE /api/chat/sessions/[id]`) reuse the repo's existing `createClient`→`getUser`→`createAdminClient` pattern. A new `ChatHistoryPanel` (built on the existing `Sheet` primitive) lists sessions via SWR. `ChatPage` gets a clock-icon trigger and wires selection back into `ChatInterface`, which already accepts a `sessionId` prop and loads it.

**Tech Stack:** Next.js 16 (App Router, route handlers), React 19, TypeScript (strict), Supabase/Postgres (admin client), SWR, Tailwind (dark tokens), Vitest + @testing-library/react, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-27-chat-ux-redesign-design.md` (§3.1, §3.2, §4). This plan covers the foundation only; rich chat UI (cards/write-backs/metadata) and photo attachments are Plans 2 and 3.

## Global Constraints

- TypeScript strict; **no `any`** (use `unknown` + narrowing). Immutable updates only (spread, never mutate).
- Auth on every route: `const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();` → `401 { error: 'Unauthorized', code: 'AUTH_REQUIRED' }` if no user. Data via `createAdminClient()` with an explicit `.eq('user_id', user.id)` on every query.
- Error shape: `{ error: string, code: string }`; 500 fallback `{ error, code: 'INTERNAL_ERROR' }` logged with `console.error`.
- Next 16 dynamic route handler signature: `(_request: Request, { params }: { params: Promise<{ id: string }> })` then `const { id } = await params`.
- Tailwind dark tokens only (`text-text-primary`, `text-text-tertiary`, `bg-gradient-coach`, `border-bg-border`, `status-good`, etc.). No new colors.
- Conventional commits (`feat:`, `chore:`, `test:`). Commit after each task.
- Run from repo root with `pnpm`. Do not run scripts against `.env.local` (production) — tests use mocks; manual checks use local Supabase.

## File Structure

- `src/app/(app)/layout.tsx` — **modify**: drop the global `<MiniChat />`.
- `src/components/layout/MiniChat.tsx` — **delete**.
- `tests/helpers/supabase-mock.ts` — **create**: chainable PostgREST builder mock (reused by route tests).
- `src/app/api/chat/sessions/route.ts` — **create**: `GET` list of the user's sessions.
- `tests/lib/chat/sessions-list.test.ts` — **create**.
- `src/app/api/chat/sessions/[id]/route.ts` — **create**: `DELETE` a session + its messages.
- `tests/lib/chat/sessions-delete.test.ts` — **create**.
- `src/components/chat/ChatHistoryPanel.tsx` — **create**: Sheet-based session list.
- `tests/ui/ChatHistoryPanel.test.tsx` — **create**.
- `src/components/chat/ChatPage.tsx` — **modify**: clock-icon trigger, panel state, resume/new wiring.
- `tests/chat-history.spec.ts` — **create**: Playwright end-to-end.

**Deferred to later plans:** nudge session-anchoring (UX-09) lands in Plan 2 (it touches `CoachCard` + the send response and is cleaner alongside the rich-UI work).

---

### Task 1: Remove the global MiniChat FAB

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Delete: `src/components/layout/MiniChat.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (removal). After this task there is no global chat overlay; chat is reached only via the Coach tab.

- [ ] **Step 1: Remove the import and render of MiniChat in the layout**

Edit `src/app/(app)/layout.tsx` — delete the import line and the `<MiniChat />` element. Result:

```tsx
import { Navigation } from '@/components/layout/Navigation'
import { OnboardingCheck } from '@/components/settings/OnboardingCheck'
import { TimeOfDayTheme } from '@/components/shared/TimeOfDayTheme'
import { SWRProvider } from '@/components/providers/SWRProvider'
import { InstallPrompt } from '@/components/shared/InstallPrompt'

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <SWRProvider>
      <TimeOfDayTheme />
      <Navigation />
      {/* Desktop: offset voor sidebar. Mobile: ruimte voor dynamische tab bar incl. safe-area-bottom. */}
      <main className="lg:pl-56 pb-[var(--nav-height)] min-h-[100dvh] pt-safe pl-safe pr-safe">
        {children}
      </main>
      <OnboardingCheck />
      <InstallPrompt />
    </SWRProvider>
  )
}
```

- [ ] **Step 2: Delete the MiniChat component file**

Run: `git rm src/components/layout/MiniChat.tsx`

- [ ] **Step 3: Verify no remaining references**

Run: `grep -rn "MiniChat" src/`
Expected: no output (exit 1 — nothing found).

- [ ] **Step 4: Verify the app still type-checks and builds**

Run: `rm -rf .next && pnpm typecheck`
Expected: PASS, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/layout.tsx src/components/layout/MiniChat.tsx
git commit -m "refactor(chat): remove global MiniChat FAB — single Coach-tab home"
```

---

### Task 2: `GET /api/chat/sessions` — list the user's sessions

**Files:**
- Create: `tests/helpers/supabase-mock.ts`
- Create: `src/app/api/chat/sessions/route.ts`
- Test: `tests/lib/chat/sessions-list.test.ts`

**Interfaces:**
- Consumes: `createClient` (`@/lib/supabase/server`), `createAdminClient` (`@/lib/supabase/admin`).
- Produces: `GET /api/chat/sessions` → `200 { sessions: Array<{ id: string; title: string | null; last_message_at: string | null; message_count: number }> }`, reverse-chron by `last_message_at`. `401` if unauthenticated. Test helper exports `mockBuilder(result)` and `mockAdmin(tableResults)`.

- [ ] **Step 1: Create the chainable Supabase mock helper**

Create `tests/helpers/supabase-mock.ts`:

```ts
import { vi } from 'vitest'

export interface QueryResult {
  data: unknown
  error: unknown
}

/**
 * Chainable PostgREST query-builder mock. Every builder method returns the same
 * builder; awaiting the builder (it is thenable) or calling .maybeSingle()/.single()
 * resolves to `result`. Covers the `.from(t).select().eq().order().limit()` style
 * used across the app's route handlers.
 */
export function mockBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {}
  const chain = ['select', 'eq', 'neq', 'or', 'order', 'limit', 'delete', 'insert', 'update']
  for (const m of chain) builder[m] = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  builder.single = vi.fn(() => Promise.resolve(result))
  // Make the builder awaitable so `await admin.from(t).select()...` resolves to result.
  builder.then = (resolve: (r: QueryResult) => unknown) => resolve(result)
  return builder
}

/** Admin client whose `.from(table)` returns a builder seeded per table name. */
export function mockAdmin(tableResults: Record<string, QueryResult>) {
  return {
    from: vi.fn((table: string) =>
      mockBuilder(tableResults[table] ?? { data: null, error: null }),
    ),
  }
}

/** Server client whose auth.getUser() resolves to the given user (or null). */
export function mockServerClient(user: { id: string } | null) {
  return {
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user }, error: null })) },
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/lib/chat/sessions-list.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAdmin, mockServerClient } from '../../helpers/supabase-mock'

const createClient = vi.fn()
const createAdminClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: () => createClient() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClient() }))

import { GET } from '@/app/api/chat/sessions/route'

beforeEach(() => {
  createClient.mockReset()
  createAdminClient.mockReset()
})

it('returns the user sessions list', async () => {
  createClient.mockResolvedValue(mockServerClient({ id: 'u1' }))
  createAdminClient.mockReturnValue(
    mockAdmin({
      chat_sessions: {
        data: [
          { id: 's1', title: 'Schema blok 4', last_message_at: '2026-06-25T10:00:00Z', message_count: 14 },
        ],
        error: null,
      },
    }),
  )

  const res = await GET(new Request('http://localhost/api/chat/sessions'))
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body.sessions).toHaveLength(1)
  expect(body.sessions[0].id).toBe('s1')
})

it('returns 401 when unauthenticated', async () => {
  createClient.mockResolvedValue(mockServerClient(null))
  const res = await GET(new Request('http://localhost/api/chat/sessions'))
  expect(res.status).toBe(401)
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run tests/lib/chat/sessions-list.test.ts`
Expected: FAIL — cannot find module `@/app/api/chat/sessions/route`.

- [ ] **Step 4: Implement the route**

Create `src/app/api/chat/sessions/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: sessions, error } = await admin
      .from('chat_sessions')
      .select('id, title, last_message_at, message_count')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return NextResponse.json({ sessions: sessions ?? [] })
  } catch (error) {
    console.error('Chat sessions list error:', error)
    return NextResponse.json(
      { error: 'Failed to load sessions', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run tests/lib/chat/sessions-list.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/supabase-mock.ts src/app/api/chat/sessions/route.ts tests/lib/chat/sessions-list.test.ts
git commit -m "feat(chat): add GET /api/chat/sessions endpoint"
```

---

### Task 3: `DELETE /api/chat/sessions/[id]` — delete a session

**Files:**
- Create: `src/app/api/chat/sessions/[id]/route.ts`
- Test: `tests/lib/chat/sessions-delete.test.ts`

**Interfaces:**
- Consumes: `createClient`, `createAdminClient`, mock helpers from Task 2.
- Produces: `DELETE /api/chat/sessions/[id]` → deletes `chat_messages` (where `session_id` + `user_id`) then `chat_sessions` (where `id` + `user_id`); `200 { ok: true }`; `401` if unauthenticated. Does not assume `ON DELETE CASCADE`.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/chat/sessions-delete.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAdmin, mockServerClient } from '../../helpers/supabase-mock'

const createClient = vi.fn()
const createAdminClient = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: () => createClient() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => createAdminClient() }))

import { DELETE } from '@/app/api/chat/sessions/[id]/route'

beforeEach(() => {
  createClient.mockReset()
  createAdminClient.mockReset()
})

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

it('deletes the session and returns ok', async () => {
  createClient.mockResolvedValue(mockServerClient({ id: 'u1' }))
  const admin = mockAdmin({
    chat_messages: { data: null, error: null },
    chat_sessions: { data: null, error: null },
  })
  createAdminClient.mockReturnValue(admin)

  const res = await DELETE(new Request('http://localhost/api/chat/sessions/s1', { method: 'DELETE' }), ctx('s1'))
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ok: true })
  // both tables were touched
  expect(admin.from).toHaveBeenCalledWith('chat_messages')
  expect(admin.from).toHaveBeenCalledWith('chat_sessions')
})

it('returns 401 when unauthenticated', async () => {
  createClient.mockResolvedValue(mockServerClient(null))
  const res = await DELETE(new Request('http://localhost/api/chat/sessions/s1', { method: 'DELETE' }), ctx('s1'))
  expect(res.status).toBe(401)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/lib/chat/sessions-delete.test.ts`
Expected: FAIL — cannot find module `@/app/api/chat/sessions/[id]/route`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/chat/sessions/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const { id } = await params
    const admin = createAdminClient()

    // Delete messages first (no reliance on ON DELETE CASCADE), then the session.
    const { error: msgError } = await admin
      .from('chat_messages')
      .delete()
      .eq('session_id', id)
      .eq('user_id', user.id)
    if (msgError) throw msgError

    const { error: sessionError } = await admin
      .from('chat_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (sessionError) throw sessionError

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Chat session delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete session', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/lib/chat/sessions-delete.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/chat/sessions/\[id\]/route.ts tests/lib/chat/sessions-delete.test.ts
git commit -m "feat(chat): add DELETE /api/chat/sessions/[id] endpoint"
```

---

### Task 4: `ChatHistoryPanel` — Sheet-based session list

**Files:**
- Create: `src/components/chat/ChatHistoryPanel.tsx`
- Test: `tests/ui/ChatHistoryPanel.test.tsx`

**Interfaces:**
- Consumes: `Sheet` (`@/components/ui/Sheet`), SWR, `GET /api/chat/sessions`, `DELETE /api/chat/sessions/[id]`.
- Produces: `ChatHistoryPanel` with props `{ open: boolean; onClose: () => void; onSelect: (sessionId: string) => void; onNewChat: () => void }`. Rows call `onSelect(id)` then `onClose()`; the "Nieuwe chat" row calls `onNewChat()` then `onClose()`; the trash control fires `DELETE` and revalidates without selecting the row.

- [ ] **Step 1: Write the failing test**

Create `tests/ui/ChatHistoryPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { ChatHistoryPanel } from '@/components/chat/ChatHistoryPanel'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve({ sessions: [
        { id: 's1', title: 'Schema blok 4', last_message_at: new Date().toISOString(), message_count: 14 },
      ] }),
    }),
  ) as unknown as typeof fetch)
})

function renderPanel(props: Partial<React.ComponentProps<typeof ChatHistoryPanel>> = {}) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ChatHistoryPanel open onClose={vi.fn()} onSelect={vi.fn()} onNewChat={vi.fn()} {...props} />
    </SWRConfig>,
  )
}

it('lists sessions and resumes the chosen one', async () => {
  const onSelect = vi.fn()
  renderPanel({ onSelect })
  const row = await screen.findByText('Schema blok 4')
  fireEvent.click(row)
  expect(onSelect).toHaveBeenCalledWith('s1')
})

it('fires onNewChat from the new-chat row', async () => {
  const onNewChat = vi.fn()
  renderPanel({ onNewChat })
  fireEvent.click(await screen.findByText('Nieuwe chat'))
  expect(onNewChat).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/ui/ChatHistoryPanel.test.tsx`
Expected: FAIL — cannot find module `@/components/chat/ChatHistoryPanel`.

- [ ] **Step 3: Implement the component**

Create `src/components/chat/ChatHistoryPanel.tsx`:

```tsx
'use client'

import type { MouseEvent, KeyboardEvent } from 'react'
import useSWR from 'swr'
import { SquarePen, Trash2 } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'

interface SessionRow {
  id: string
  title: string | null
  last_message_at: string | null
  message_count: number
}

interface SessionsResponse {
  sessions: SessionRow[]
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<SessionsResponse>)

function relativeDate(iso: string | null): string {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'vandaag'
  if (days === 1) return 'gisteren'
  if (days < 7) return `${days}d geleden`
  if (days < 30) return `${Math.floor(days / 7)}w geleden`
  return `${Math.floor(days / 30)}mnd geleden`
}

export interface ChatHistoryPanelProps {
  open: boolean
  onClose: () => void
  onSelect: (sessionId: string) => void
  onNewChat: () => void
}

export function ChatHistoryPanel({ open, onClose, onSelect, onNewChat }: ChatHistoryPanelProps) {
  const { data, mutate } = useSWR(open ? '/api/chat/sessions' : null, fetcher)
  const sessions = data?.sessions ?? []

  function select(id: string) {
    onSelect(id)
    onClose()
  }

  async function remove(e: MouseEvent, id: string) {
    e.stopPropagation()
    await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' })
    void mutate()
  }

  function onRowKey(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(id)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Gesprekken" detents={['large']}>
      <div className="flex flex-col gap-1 pb-safe">
        <button
          type="button"
          onClick={() => {
            onNewChat()
            onClose()
          }}
          className="flex items-center gap-2.5 rounded-[13px] border-[0.5px] border-[rgba(0,229,199,0.3)] bg-gradient-coach px-3 py-3 text-left text-body font-semibold text-text-primary"
        >
          <SquarePen size={16} strokeWidth={1.75} /> Nieuwe chat
        </button>

        {sessions.length === 0 ? (
          <p className="px-3 py-6 text-center text-body-s text-text-tertiary">
            Nog geen eerdere gesprekken.
          </p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => select(s.id)}
              onKeyDown={(e) => onRowKey(e, s.id)}
              className="group flex items-center gap-3 rounded-[13px] px-3 py-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sport-gym-base)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-text-primary">
                  {s.title ?? 'Nieuw gesprek'}
                </span>
                <span className="text-caption1 text-text-tertiary">
                  {relativeDate(s.last_message_at)} · {s.message_count} berichten
                </span>
              </span>
              <button
                type="button"
                aria-label="Verwijder gesprek"
                onClick={(e) => remove(e, s.id)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:text-status-bad"
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
            </div>
          ))
        )}
      </div>
    </Sheet>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/ui/ChatHistoryPanel.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/ChatHistoryPanel.tsx tests/ui/ChatHistoryPanel.test.tsx
git commit -m "feat(chat): add ChatHistoryPanel session list"
```

---

### Task 5: Wire ChatPage — clock-icon trigger, panel, resume/new

**Files:**
- Modify: `src/components/chat/ChatPage.tsx`
- Test: `tests/chat-history.spec.ts` (Playwright)

**Interfaces:**
- Consumes: `ChatHistoryPanel` (Task 4), `ChatInterface` (existing `sessionId` prop). 
- Produces: a Coach page whose header has a history (clock) button + new-chat (pencil) button; opening history shows the panel; selecting a session remounts `ChatInterface` with that `sessionId`; "Nieuwe chat" remounts a blank session.

- [ ] **Step 1: Update ChatPage**

Replace `src/components/chat/ChatPage.tsx` with:

```tsx
'use client'

import { useState, useCallback } from 'react'
import { SquarePen, Clock } from 'lucide-react'
import { ChatInterface } from './ChatInterface'
import { ChatHistoryPanel } from './ChatHistoryPanel'
import { CoachOrb } from '@/components/shared/CoachOrb'

interface ChatPageProps {
  initialMessage?: string
  seededAssistant?: string
}

export function ChatPage({ initialMessage, seededAssistant }: ChatPageProps) {
  const [sessionKey, setSessionKey] = useState(0)
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined)
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const handleNewChat = useCallback(() => {
    setActiveSessionId(undefined)
    setSessionKey((k) => k + 1)
  }, [])

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id)
    setSessionKey((k) => k + 1)
  }, [])

  return (
    <div className="flex h-[calc(100dvh-var(--nav-height))] flex-col lg:h-screen">
      <header
        className="sticky top-0 z-30 glass-nav border-b-[0.5px] border-bg-border pt-safe pl-safe pr-safe"
        style={{ background: 'linear-gradient(180deg, rgba(124,58,237,0.14) 0%, var(--color-bg-glass-nav) 100%)' }}
      >
        <div className="flex h-14 items-center gap-3 px-4">
          <CoachOrb size={40} />
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-bold leading-[22px] tracking-[-0.3px] text-text-primary">
              Pulse Coach
            </div>
            <div className="flex items-center gap-1.5 text-body-s text-status-good">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-good"
                style={{ boxShadow: '0 0 8px var(--color-status-good)' }}
              />
              Beschikbaar · kent al je data
            </div>
          </div>
          <button
            type="button"
            aria-label="Gesprekshistorie"
            onClick={() => setHistoryOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-all duration-150 hover:text-text-primary active:scale-95"
          >
            <Clock size={20} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label="Nieuwe chat"
            disabled={isChatLoading}
            onClick={handleNewChat}
            className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-all duration-150 hover:text-text-primary active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            <SquarePen size={20} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ChatInterface
          key={sessionKey}
          sessionId={activeSessionId}
          initialMessage={initialMessage}
          seededAssistant={seededAssistant}
          onLoadingChange={setIsChatLoading}
        />
      </div>

      <ChatHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleSelectSession}
        onNewChat={handleNewChat}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `pnpm typecheck`
Expected: PASS. (`ChatInterface` already accepts `sessionId`; passing `undefined` keeps the fresh-session path.)

- [ ] **Step 3: Write the Playwright end-to-end test**

Create `tests/chat-history.spec.ts`. (Follow the auth-setup pattern used by the existing specs in `tests/*.spec.ts` — reuse their login/storage-state helper; the snippet below assumes an authenticated context like the other specs.)

```ts
import { test, expect } from '@playwright/test'

test('history panel opens, lists sessions, and a new chat resets the thread', async ({ page }) => {
  await page.goto('/chat')

  // History trigger is present and opens the panel
  await page.getByRole('button', { name: 'Gesprekshistorie' }).click()
  await expect(page.getByText('Gesprekken')).toBeVisible()

  // New-chat row inside the panel closes it and shows the empty composer
  await page.getByText('Nieuwe chat').click()
  await expect(page.getByPlaceholder(/Bericht aan coach|Stel een vraag/)).toBeVisible()
})
```

- [ ] **Step 4: Run the e2e test**

Run: `pnpm test:e2e tests/chat-history.spec.ts`
Expected: PASS. If the suite needs auth/storage-state, mirror the setup in the existing `tests/*.spec.ts` specs before asserting.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/ChatPage.tsx tests/chat-history.spec.ts
git commit -m "feat(chat): history panel + resume/new wiring in ChatPage"
```

---

## Self-Review

**1. Spec coverage (§3.1, §3.2, §4):**
- Single home / remove MiniChat → Task 1. ✓
- `GET /api/chat/sessions` → Task 2. ✓
- `DELETE /api/chat/sessions/[id]` → Task 3. ✓
- History panel (open in conversation, clock icon, resume, delete, "Nieuwe chat") → Tasks 4 + 5. ✓
- Opens-in-conversation default → unchanged `ChatInterface` mount in Task 5 (no `sessionId` → loads latest). ✓
- Nudge session-anchoring (UX-09) → explicitly deferred to Plan 2 (noted in File Structure). ✓ (not a gap — out of this plan's scope by design)
- `attachments` migration, cards, suggestions removal → Plans 2/3 (out of scope). ✓

**2. Placeholder scan:** No TBD/TODO. Every code step shows complete code; every command shows expected output. The Playwright spec notes the repo's existing auth-setup must be mirrored — that is a real instruction (the other specs already establish it), not a placeholder.

**3. Type consistency:** `ChatHistoryPanelProps` (`open/onClose/onSelect/onNewChat`) is defined in Task 4 and consumed identically in Task 5. `onSelect(sessionId: string)` matches `handleSelectSession(id: string)`. `SessionRow` fields (`id/title/last_message_at/message_count`) match the `GET` response shape from Task 2. `mockBuilder`/`mockAdmin`/`mockServerClient` defined in Task 2 are reused unchanged in Task 3. `ChatInterface`'s `sessionId?: string` (existing) matches the prop passed in Task 5. ✓

---

## Notes for the implementer

- After all tasks: `pnpm typecheck && pnpm lint && pnpm vitest run` should be green before opening a PR.
- This plan supersedes audit findings **UX-01** and (foundation for) **UX-09**; the standalone UX tasks in `IMPLEMENTATION_PLAN.md` for those should be marked as covered here.
- No DB migration in Plan 1 (`chat_sessions`/`chat_messages` already exist). The first migration arrives in Plan 3 (`attachments`).
