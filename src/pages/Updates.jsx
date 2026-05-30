import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Notification, Messages2 } from 'iconsax-react'
import { useAuth } from '../context/AuthContext'
import {
  getMyComplaints, markComplaintRepliesRead,
  getAnnouncements, markAnnouncementsRead,
} from '../lib/db'
import styles from './Updates.module.css'

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

export default function Updates() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    // Snapshot the last-read marker now so per-item "unread" dots reflect
    // state at page open (we mark everything read below).
    const lastRead = profile?.announcements_last_read_at
      ? new Date(profile.announcements_last_read_at).getTime()
      : 0
    ;(async () => {
      const [{ data: anns }, { data: complaints }] = await Promise.all([
        getAnnouncements(),
        getMyComplaints(),
      ])
      if (cancelled) return

      const announcementItems = (Array.isArray(anns) ? anns : []).map(a => ({
        id:     `ann-${a.id}`,
        kind:   'announcement',
        title:  a.title,
        body:   a.body,
        date:   a.created_at,
        link:   a.link ?? null,
        unread: new Date(a.created_at).getTime() > lastRead,
      }))

      const replyItems = (Array.isArray(complaints) ? complaints : [])
        .filter(c => c.admin_reply)
        .map(c => ({
          id:     `complaint-${c.id}`,
          kind:   'reply',
          title:  `Reply to your complaint · ${c.category}`,
          body:   c.admin_reply,
          date:   c.replied_at ?? c.created_at,
          link:   null,
          unread: !c.reply_read,
        }))

      const merged = [...announcementItems, ...replyItems]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
      setItems(merged)
      setLoading(false)

      // Mark everything read, then tell the bell to refresh its badge
      await markAnnouncementsRead()
      await markComplaintRepliesRead()
      window.dispatchEvent(new Event('qwikhub:updates-read'))
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')} aria-label="Go back">
          <ArrowLeft size={20} color="currentColor" />
        </button>
        <span className={styles.pageTitle}>Updates</span>
        <div className={styles.spacer} />
      </div>

      {loading ? (
        <p className={styles.hint}>Loading…</p>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <Notification size={40} color="var(--color-text-tertiary)" variant="Bold" />
          <p className={styles.emptyText}>You're all caught up</p>
          <span className={styles.emptySub}>Replies to your complaints and app updates will show here.</span>
        </div>
      ) : (
        <div className={styles.list}>
          {items.map(it => {
            const Icon = it.kind === 'reply' ? Messages2 : Notification
            const inner = (
              <>
                <div className={styles.itemIcon}>
                  <Icon size={18} color="#8a6800" variant="Bold" />
                </div>
                <div className={styles.itemBody}>
                  <div className={styles.itemTopRow}>
                    <span className={styles.itemTitle}>{it.title}</span>
                    {it.unread && <span className={styles.dot} aria-label="Unread" />}
                  </div>
                  <p className={styles.itemText}>{it.body}</p>
                  <span className={styles.itemTime}>
                    {timeAgo(it.date)}{it.link ? ' · Tap to open' : ''}
                  </span>
                </div>
              </>
            )
            return it.link ? (
              <a
                key={it.id}
                href={it.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.item} ${styles.itemLink} ${it.unread ? styles.itemUnread : ''}`}
              >
                {inner}
              </a>
            ) : (
              <div key={it.id} className={`${styles.item} ${it.unread ? styles.itemUnread : ''}`}>
                {inner}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
