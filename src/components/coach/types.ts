import type { InboxPriority, InboxType } from '@/lib/coach/inbox'

export type InboxStatus = 'unread' | 'read' | 'dismissed' | 'actioned'

export interface CoachInboxItem {
  id: string
  message_text: string
  type: InboxType | string
  priority: InboxPriority
  requires_response: boolean
  status: InboxStatus
  related_entity_id: string | null
  created_at: string
}

export interface CoachInboxResponse {
  items: CoachInboxItem[]
  unreadCount: number
}
