import { useState, useEffect } from 'react'
import { Notification } from 'iconsax-react'
import { adminGetAnnouncements, adminCreateAnnouncement, adminDeleteAnnouncement } from '../lib/adminDb'
import styles from './AdminOrders.module.css'
import c from './AdminAnnouncements.module.css'

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminAnnouncements() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [title, setTitle]     = useState('')
  const [body, setBody]       = useState('')
  const [link, setLink]       = useState('')
  const [posting, setPosting] = useState(false)
  const [formError, setFormError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError('')
    const { data, error: err } = await adminGetAnnouncements()
    setLoading(false)
    if (err) { setError(err.message); return }
    setRows(Array.isArray(data) ? data : [])
  }

  async function handlePost() {
    if (!title.trim() || !body.trim()) { setFormError('Title and message are required.'); return }
    setPosting(true); setFormError('')
    const { error: err } = await adminCreateAnnouncement(title.trim(), body.trim(), link.trim() || null)
    setPosting(false)
    if (err) { setFormError(err.message); return }
    setTitle(''); setBody(''); setLink('')
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this announcement? Users will no longer see it.')) return
    setDeletingId(id)
    const { error: err } = await adminDeleteAnnouncement(id)
    setDeletingId(null)
    if (err) { alert(`Failed to delete: ${err.message}`); return }
    setRows(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Announcements</h1>
          <p className={styles.pageSubtitle}>Post updates shown to all users in their Updates feed</p>
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Composer */}
      <div className={c.composer}>
        <span className={c.label}>Title</span>
        <input
          className={c.input}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Scheduled maintenance tonight"
          maxLength={120}
        />
        <span className={c.label}>Message</span>
        <textarea
          className={c.textarea}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="What do you want users to know?"
          maxLength={1000}
        />
        <span className={c.label}>Link (optional — makes it tappable)</span>
        <input
          className={c.input}
          value={link}
          onChange={e => setLink(e.target.value)}
          placeholder="https://…"
        />
        {formError && <p className={c.errorNote}>{formError}</p>}
        <button className={c.sendBtn} onClick={handlePost} disabled={posting}>
          {posting ? 'Posting…' : 'Post announcement'}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className={styles.centred}><span className={styles.spin} /></div>
      ) : error ? (
        <div className={styles.centred}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.refreshBtn} onClick={load}>Try again</button>
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.centred}>
          <Notification size={36} color="var(--color-text-tertiary)" variant="Bold" />
          <p className={styles.emptyText}>No announcements yet</p>
        </div>
      ) : (
        <div className={c.list}>
          {rows.map(a => (
            <div key={a.id} className={c.item}>
              <div className={c.itemBody}>
                <span className={c.itemTitle}>{a.title}</span>
                <p className={c.itemText}>{a.body}</p>
                {a.link && <span className={c.itemLink}>{a.link}</span>}
                <span className={c.itemMeta}>{formatDate(a.created_at)}</span>
              </div>
              <button
                className={c.deleteBtn}
                disabled={deletingId === a.id}
                onClick={() => handleDelete(a.id)}
              >
                {deletingId === a.id ? '…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
