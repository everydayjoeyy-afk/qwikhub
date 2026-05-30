/**
 * App-wide announcements shown to every user in the Updates feed (bell).
 * This is a temporary static source until the admin-managed announcements
 * system (#1) is built — at which point this list is replaced by a DB query.
 *
 * Unread tracking is per-user via localStorage (keyed by user id).
 */

const WHATSAPP_CHANNEL = 'https://whatsapp.com/channel/0029VbCc8oQ545uuu3uM7u3e'

export const ANNOUNCEMENTS = [
  {
    id:    'store-earnings-fix-2026-05',
    title: 'Store earnings now showing',
    body:  "We've fixed the issue where storefront sales weren't reflecting in your balance. Open My Store to see your earnings — your past sales are included.",
    date:  '2026-05-30T09:00:00Z',
  },
  {
    id:    'whatsapp-channel',
    title: 'Join our WhatsApp channel',
    body:  'Get bundle updates, new features and exclusive offers first. Tap to follow our channel.',
    date:  '2026-05-29T12:00:00Z',
    link:  WHATSAPP_CHANNEL,
  },
]

const keyFor = (userId) => `qwikhub_updates_read_${userId}`

export function getReadAnnouncementIds(userId) {
  if (!userId) return []
  try {
    return JSON.parse(localStorage.getItem(keyFor(userId)) || '[]')
  } catch {
    return []
  }
}

export function getUnreadAnnouncementCount(userId) {
  if (!userId) return 0
  const read = getReadAnnouncementIds(userId)
  return ANNOUNCEMENTS.filter(a => !read.includes(a.id)).length
}

export function markAnnouncementsRead(userId) {
  if (!userId) return
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(ANNOUNCEMENTS.map(a => a.id)))
  } catch { /* ignore */ }
}
