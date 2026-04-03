import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidTokens, createOAuthClient } from '@/lib/google/oauth'
import { listEvents } from '@/lib/google/calendar'
import { google } from 'googleapis'
import { z } from 'zod'

/* ── GET: list calendar events ──────────────────────────── */

const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

const ListQuerySchema = z.object({
  start: DateParam,
  end: DateParam,
})

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      )
    }

    const { searchParams } = new URL(request.url)
    const parsed = ListQuerySchema.safeParse({
      start: searchParams.get('start'),
      end: searchParams.get('end'),
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', code: 'BAD_REQUEST', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const tokens = await getValidTokens(user.id)
    if (!tokens) {
      return NextResponse.json(
        { error: 'Google Calendar not connected', code: 'NOT_CONNECTED' },
        { status: 400 },
      )
    }

    const events = await listEvents(user.id, parsed.data.start, parsed.data.end)

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Calendar events GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendar events', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}

/* ── POST: create calendar events ───────────────────────── */

const EventSchema = z.object({
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  description: z.string().optional(),
})

const RequestSchema = z.object({
  events: z.array(EventSchema).min(1).max(10),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, { status: 401 })
    }

    const tokens = await getValidTokens(user.id)
    if (!tokens) {
      return NextResponse.json(
        { error: 'Google Calendar not connected', code: 'NOT_CONNECTED' },
        { status: 400 },
      )
    }

    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', code: 'BAD_REQUEST', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const oauth2Client = createOAuthClient()
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    const results = await Promise.all(
      parsed.data.events.map(async (evt) => {
        const startDateTime = `${evt.date}T${evt.startTime}:00`
        const endDateTime = `${evt.date}T${evt.endTime}:00`

        const { data } = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: evt.title,
            description: evt.description ?? '',
            start: { dateTime: startDateTime, timeZone: 'Europe/Amsterdam' },
            end: { dateTime: endDateTime, timeZone: 'Europe/Amsterdam' },
          },
        })

        return { id: data.id, title: evt.title, htmlLink: data.htmlLink }
      }),
    )

    return NextResponse.json({ created: results }, { status: 201 })
  } catch (error) {
    console.error('Calendar events API error:', error)
    return NextResponse.json(
      { error: 'Failed to create calendar events', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
}
