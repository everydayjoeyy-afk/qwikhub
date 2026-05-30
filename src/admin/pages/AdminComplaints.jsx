import { useState, useEffect, useMemo } from 'react'
import { SearchNormal1, Messages2 } from 'iconsax-react'
import { adminGetComplaints, adminReplyComplaint, adminSetComplaintStatus } from '../lib/adminDb'
import styles from './AdminOrders.module.css'
import c from './AdminComplaints.module.css'

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 30)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TABS = [
  { key: 'all',      label: 'All'      },
  { key: 'open',     label: 'Open'     },
  { key: 'resolved', label: 'Resolved' },
]

export default function AdminComplaints() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [tab, setTab]         = useState('open')
  const [query, setQuery]     = useState('')
  const [drafts, setDrafts]   = useState({})   // { [id]: replyText }
  const [busyId, setBusyId]   = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError('')
    const { data, error: err } = await adminGetComplaints()
    setLoading(false)
    if (err) { setError(err.message); return }
    setRows(Array.isArray(data) ? data : [])
  }

  async function handleReply(row) {
    const text = (drafts[row.id] ?? '').trim()
    if (!text) return
    setBusyId(row.id)
    const { error: err } = await adminReplyComplaint(row.id, text, true)
    setBusyId(null)
    if (err) { alert(`Failed to send reply: ${err.message}`); return }
    setRows(prev => prev.map(r =>
      r.id === row.id ? { ...r, admin_reply: text, status: 'resolved', replied_at: new Date().toISOString() } : r
    ))
    setDrafts(d => ({ ...d, [row.id]: '' }))
  }

  async function handleToggleStatus(row) {
    const next = row.status === 'open' ? 'resolved' : 'open'
    setBusyId(row.id)
    const { error: err } = await adminSetComplaintStatus(row.id, next)
    setBusyId(null)
    if (err) { alert(`Failed to update status: ${err.message}`); return }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: next } : r))
  }

  const openCount     = rows.filter(r => r.status === 'open').length
  const resolvedCount = rows.filter(r => r.status === 'resolved').length

  const filtered = useMemo(() => rows.filter(r => {
    if (tab !== 'all' && r.status !== tab) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      if (
        !r.user_name?.toLowerCase().includes(q) &&
        !r.user_phone?.includes(q) &&
        !r.message?.toLowerCase().includes(q) &&
        !r.category?.toLowerCase().includes(q)
      ) return false
    }
    return true
  }), [rows, tab, query])

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Complaints</h1>
          <p className={styles.pageSubtitle}>Customer complaints — reply and resolve</p>
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Open</span>
          <span className={styles.statValue}>{openCount}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Resolved</span>
          <span className={styles.statValue}>{resolvedCount}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total</span>
          <span className={styles.statValue}>{rows.length}</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <SearchNormal1 size={15} color="var(--color-text-tertiary)" className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by name, phone, category or message…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map(t => {
          const count = t.key === 'all' ? rows.length : rows.filter(r => r.status === t.key).length
          return (
            <button
              key={t.key}
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span className={styles.tabCount}>{count}</span>
            </button>
          )
        })}
        <span className={styles.tabRight}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className={styles.centred}><span className={styles.spin} /></div>
      ) : error ? (
        <div className={styles.centred}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.refreshBtn} onClick={load}>Try again</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.centred}>
          <Messages2 size={36} color="var(--color-text-tertiary)" />
          <p className={styles.emptyText}>No complaints here</p>
        </div>
      ) : (
        <div className={c.list}>
          {filtered.map(row => (
            <div key={row.id} className={`${c.card} ${row.status === 'open' ? c.cardOpen : ''}`}>
              <div className={c.head}>
                <div className={c.userInfo}>
                  <span className={c.userName}>{row.user_name ?? 'Unknown'}</span>
                  <span className={c.userPhone}>{row.user_phone ?? '—'}</span>
                </div>
                <div className={c.headRight}>
                  <span className={c.statusBadge} data-status={row.status}>
                    {row.status === 'resolved' ? 'Resolved' : 'Open'}
                  </span>
                  <span className={c.time}>{timeAgo(row.created_at)}</span>
                </div>
              </div>

              <span className={c.catBadge}>{row.category}</span>
              <p className={c.message}>{row.message}</p>

              {row.admin_reply && (
                <div className={c.replyExisting}>
                  <span className={c.replyLabel}>Your reply</span>
                  <p className={c.replyText}>{row.admin_reply}</p>
                </div>
              )}

              <div className={c.replyBox}>
                <textarea
                  className={c.textarea}
                  placeholder={row.admin_reply ? 'Send another reply…' : 'Type your reply to the customer…'}
                  value={drafts[row.id] ?? ''}
                  onChange={e => setDrafts(d => ({ ...d, [row.id]: e.target.value }))}
                />
                <div className={c.actions}>
                  <button
                    className={c.sendBtn}
                    disabled={busyId === row.id || !(drafts[row.id] ?? '').trim()}
                    onClick={() => handleReply(row)}
                  >
                    <Messages2 size={15} color="currentColor" variant="Bold" />
                    {busyId === row.id ? 'Sending…' : 'Send reply'}
                  </button>
                  <button
                    className={c.statusBtn}
                    disabled={busyId === row.id}
                    onClick={() => handleToggleStatus(row)}
                  >
                    {row.status === 'open' ? 'Mark resolved' : 'Reopen'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
