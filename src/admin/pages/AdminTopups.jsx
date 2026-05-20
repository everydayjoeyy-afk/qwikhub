import { useState, useEffect, useMemo } from 'react'
import { SearchNormal1, Wallet2, TickCircle, Warning2 } from 'iconsax-react'
import { adminGetTopups } from '../lib/adminDb'
import styles from './AdminTopups.module.css'

// ── Helpers ──────────────────────────────────────────────────────
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

function formatFullDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function isInPeriod(iso, period) {
  if (period === 'all') return true
  const d = new Date(iso); const today = new Date()
  if (period === 'today') return d.toDateString() === today.toDateString()
  if (period === 'week')  { const w = new Date(today); w.setDate(w.getDate() - 7); return d >= w }
  if (period === 'month') return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  return true
}

function initials(name = '') {
  const parts = name.trim().split(' ')
  return parts.length > 1
    ? parts[0][0].toUpperCase() + parts[1][0].toUpperCase()
    : (parts[0]?.[0] ?? '?').toUpperCase()
}

const PERIODS = [
  { key: 'all',   label: 'All time'   },
  { key: 'today', label: 'Today'      },
  { key: 'week',  label: 'This week'  },
  { key: 'month', label: 'This month' },
]

const PAGE_SIZE = 20

function Pagination({ page, totalPages, total, start, onPage }) {
  const end = Math.min(start + PAGE_SIZE, total)
  const lo  = Math.max(1, Math.min(page - 2, totalPages - 4))
  const hi  = Math.min(totalPages, lo + 4)
  const pages = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  return (
    <div className={styles.pagination}>
      <span className={styles.paginationInfo}>
        Showing {total === 0 ? 0 : start + 1} to {end} of {total} top-ups
      </span>
      <div className={styles.paginationControls}>
        <button className={styles.pageBtn} onClick={() => onPage(page - 1)} disabled={page === 1}>‹</button>
        {pages.map(p => (
          <button key={p} className={`${styles.pageBtn} ${page === p ? styles.pageBtnActive : ''}`} onClick={() => onPage(p)}>{p}</button>
        ))}
        <button className={styles.pageBtn} onClick={() => onPage(page + 1)} disabled={page >= totalPages}>›</button>
      </div>
    </div>
  )
}

export default function AdminTopups() {
  const [topups,  setTopups]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [period,  setPeriod]  = useState('all')
  const [query,   setQuery]   = useState('')
  const [page,    setPage]    = useState(1)

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [period, query])

  async function load() {
    setLoading(true); setError('')
    try {
      const { data, error: err } = await adminGetTopups(300)
      if (err) { setError(err.message); return }
      setTopups(Array.isArray(data) ? data : [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() => topups.filter(t => {
    if (!isInPeriod(t.created_at, period)) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      if (!t.user_name?.toLowerCase().includes(q) && !t.user_phone?.includes(q) && !t.reference?.toLowerCase().includes(q)) return false
    }
    return true
  }), [topups, period, query])

  const stats = useMemo(() => {
    const todayStr   = new Date().toDateString()
    const todayItems = topups.filter(t => new Date(t.created_at).toDateString() === todayStr)
    return {
      totalCount:   topups.length,
      totalVolume:  topups.reduce((s, t) => s + Number(t.amount), 0),
      todayCount:   todayItems.length,
      todayVolume:  todayItems.reduce((s, t) => s + Number(t.amount), 0),
      avgAmount:    topups.length ? topups.reduce((s, t) => s + Number(t.amount), 0) / topups.length : 0,
    }
  }, [topups])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const start      = (page - 1) * PAGE_SIZE
  const paged      = filtered.slice(start, start + PAGE_SIZE)

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Wallet Top-up Monitor</h1>
          <p className={styles.pageSubtitle}>All Paystack wallet credits — catch missed top-ups early</p>
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Today's top-ups</span>
          <span className={styles.statValue}>{loading ? '—' : stats.todayCount}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Today's volume</span>
          <span className={`${styles.statValue} ${styles.statGreen}`}>
            {loading ? '—' : `₵${stats.todayVolume.toFixed(2)}`}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>All-time top-ups</span>
          <span className={styles.statValue}>{loading ? '—' : stats.totalCount}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>All-time volume</span>
          <span className={`${styles.statValue} ${styles.statGreen}`}>
            {loading ? '—' : `₵${stats.totalVolume.toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* Note about failed top-ups */}
      <div className={styles.alertBanner}>
        <Warning2 size={16} color="#f59e0b" variant="Bold" />
        <span>
          This shows <strong>successful</strong> top-ups only (wallet was credited).
          If a user says they paid but their balance didn't update, search their name/phone below — if it's missing, contact Paystack support with the reference from their Paystack receipt.
        </span>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <SearchNormal1 size={15} color="var(--color-text-tertiary)" className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by name, phone or Paystack reference…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className={styles.periodRow}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              className={`${styles.periodBtn} ${period === p.key ? styles.periodBtnActive : ''}`}
              onClick={() => setPeriod(p.key)}
            >{p.label}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.centred}><span className={styles.spin} /></div>
      ) : error ? (
        <div className={styles.centred}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.refreshBtn} onClick={load}>Try again</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.centred}>
          <Wallet2 size={36} color="var(--color-text-tertiary)" variant="Bold" />
          <p className={styles.emptyText}>No top-ups found for this period</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>User</th>
                  <th>Amount credited</th>
                  <th>Paystack reference</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div className={styles.iconWrap}>
                        <TickCircle size={16} color="#22c55e" variant="Bold" />
                      </div>
                    </td>
                    <td>
                      <div className={styles.userCell}>
                        <div className={styles.avatar}>{initials(t.user_name ?? t.user_phone ?? '?')}</div>
                        <div>
                          <div className={styles.userName}>{t.user_name ?? '—'}</div>
                          <div className={styles.userPhone}>{t.user_phone ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className={styles.amountCell}>₵{Number(t.amount).toFixed(2)}</td>
                    <td>
                      <span className={styles.refCode}>{t.reference ?? '—'}</span>
                    </td>
                    <td>
                      <span className={styles.statusBadge}>Credited</span>
                    </td>
                    <td>
                      <span className={styles.dateText} title={formatFullDate(t.created_at)}>
                        {timeAgo(t.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className={styles.cards}>
            {paged.map(t => (
              <div key={t.id} className={styles.card}>
                <div className={styles.iconWrap}>
                  <TickCircle size={18} color="#22c55e" variant="Bold" />
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <span className={styles.userName}>{t.user_name ?? t.user_phone ?? '—'}</span>
                    <span className={styles.amountCell}>₵{Number(t.amount).toFixed(2)}</span>
                  </div>
                  {t.reference && <span className={styles.refCode}>{t.reference}</span>}
                  <div className={styles.cardMeta}>
                    <span className={styles.statusBadge}>Credited</span>
                    <span className={styles.dateText}>{timeAgo(t.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} total={filtered.length} start={start} onPage={setPage} />
        </>
      )}
    </div>
  )
}
