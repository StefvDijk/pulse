import { google } from 'googleapis'
import { createOAuthClient, getValidTokens } from './oauth'

/* ── Types ──────────────────────────────────────────────── */

export interface CalendarEvent {
  id: string
  title: string
  start: string        // ISO datetime or date
  end: string          // ISO datetime or date
  allDay: boolean
  location: string | null
  description: string | null
}

/* ── List events ────────────────────────────────────────── */

export async function listEvents(
  userId: string,
  startDate: string,   // YYYY-MM-DD
  endDate: string,     // YYYY-MM-DD
): Promise<CalendarEvent[]> {
  const tokens = await getValidTokens(userId)
  if (!tokens) {
    throw new Error('Google Calendar not connected')
  }

  const oauth2Client = createOAuthClient()
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  })

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  const { data } = await calendar.events.list({
    calendarId: 'primary',
    timeMin: `${startDate}T00:00:00`,
    timeMax: `${endDate}T23:59:59`,
    timeZone: 'Europe/Amsterdam',
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  })

  const items = data.items ?? []

  return items.map((event) => {
    const allDay = Boolean(event.start?.date)

    return {
      id: event.id ?? '',
      title: event.summary ?? 'Untitled',
      start: allDay ? event.start!.date! : event.start!.dateTime!,
      end: allDay ? event.end!.date! : event.end!.dateTime!,
      allDay,
      location: event.location ?? null,
      description: event.description ?? null,
    }
  })
}
