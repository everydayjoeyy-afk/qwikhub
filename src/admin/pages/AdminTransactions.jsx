import { useState, useEffect, useMemo } from 'react'
import { SearchNormal1, Receipt2 } from 'iconsax-react'
import { adminGetTransactions } from '../lib/adminDb'
import styles from './AdminTransactions.module.css'

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
  const d     = new Date(iso)
  const today = new Date()
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

const TABS = [
  { key: 'all',    label: 'All'     },
  { key: 'debit',  label: 'Debits'  },
  { key: 'credit', label: 'Credits' },
]

const PERIODS = [
  { key: 'all',   label: 'All time'   },
  { key: 'today', label: 'Today'      },
  { key: 'week',  label: 'This week'  },
  { key: 'month', label: 'This month' },
]

const PAGE_SIZE = 20

// ── Pagination ────────────────────────────────────────────────────
function Pagination({ page, totalPages, total, start, onPage }) {
  const end = Math.min(start + PAGE_SIZE, total)
  const lo  = Math.max(1, Math.min(page - 2, totalPages - 4))
  const hi  = Math.min(totalPages, lo + 4)
  const pages = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

  return (
    <div className={styles.pagination}>
      <span className={styles.paginationInfo}>
        Showing {total === 0 ? 0 : start + 1} to {end} of {total} transactions
      </span>
      <div className={styles.paginationControls}>
        <button className={styles.pageBtn} onClick={() => onPage(page - 1)} disabled={page === 1}>‹</button>
        {pages.map(p => (
          <button
            key={p}
            className={`${styles.pageBtn} ${page === p ? styles.pageBtnActive : ''}`}
            onClick={() => onPage(p)}
          >{p}</button>
        ))}
        <button className={styles.pageBtn} onClick={() => onPage(page + 1)} disabled={page >= totalPages}>›</button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export default function AdminTransactions() {
  const [txns,    setTxns]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [tab,     setTab]     = useState('all')
  const [period,  setPeriod]  = useState('all')
  const [query,   setQuery]   = useState('')
  const [page,    setPage]    = useState(1)

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [tab, period, query])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await adminGetTransactions(500)
      if (err) { setError(err.message); return }
      setTxns(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Filtering ─────────────────────────────────────────────────
  const filtered = useMemo(() => txns.filter(tx => {
    if (tab !== 'all' && tx.type !== tab) return false
    if (!isInPeriod(tx.created_at, period)) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      if (
        !tx.description?.toLowerCase().includes(q) &&
        !tx.user_name?.toLowerCase().includes(q) &&
        !tx.user_phone?.includes(q)
      ) return false
    }
    return true
  }), [txns, tab, period, query])

  // ── Stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const todayStr = new Date().toDateString()
    const todayTxns = txns.filter(tx => new Date(tx.created_at).toDateString() === todayStr)
    return {
      total:        txns.length,
      totalDebited: txns.filter(t => t.type === 'debit').reduce((s, t) => s + Number(t.amount), 0),
      totalCredited:txns.filter(t => t.type === 'credit').reduce((s, t) => s + Number(t.amount), 0),
      todayCount:   todayTxns.length,
      todayVolume:  todayTxns.reduce((s, t) => s + Number(t.amount), 0),
    }
  }, [txns])

  // ── Pagination ─────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const start      = (page - 1) * PAGE_SIZE
  const paged      = filtered.slice(start, start + PAGE_SIZE)

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Transaction Log</h1>
          <p className={styles.pageSubtitle}>Every wallet debit and credit across the platform</p>
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Today's transactions</span>
          <span className={styles.statValue}>{loading ? '—' : stats.todayCount}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Today's volume</span>
          <span className={styles.statValue}>{loading ? '—' : `₵${stats.todayVolume.toFixed(2)}`}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total debited</span>
          <span className={`${styles.statValue} ${styles.statDebit}`}>
            {loading ? '—' : `₵${stats.totalDebited.toFixed(2)}`}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total credited</span>
          <span className={`${styles.statValue} ${styles.statCredit}`}>
            {loading ? '—' : `₵${stats.totalCredited.toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <SearchNormal1 size={15} color="var(--color-text-tertiary)" className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by description, user name or phone…"
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

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map(t => {
          const count = t.key === 'all' ? txns.length : txns.filter(tx => tx.type === t.key).length
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
          <Receipt2 size={36} color="var(--color-text-tertiary)" />
          <p className={styles.emptyText}>No transactions match your filters</p>
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
                  <th>Type</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(tx => (
                  <tr key={tx.id}>
                    <td>
                      <div className={`${styles.typeIcon} ${tx.type === 'credit' ? styles.iconCredit : styles.iconDebit}`}>
                        {tx.type === 'credit' ? '↑' : '↓'}
                      </div>
                    </td>
                    <td>
                      <div className={styles.userCell}>
                        <div className={styles.avatar}>{initials(tx.user_name ?? tx.user_phone ?? '?')}</div>
                        <div>
                          <div className={styles.userName}>{tx.user_name ?? '—'}</div>
                          <div className={styles.userPhone}>{tx.user_phone ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.typeBadge} data-type={tx.type}>
                        {tx.type === 'credit' ? 'Credit' : 'Debit'}
                      </span>
                    </td>
                    <td className={styles.descCell}>{tx.description ?? '—'}</td>
                    <td>
                      <span className={`${styles.amount} ${tx.type === 'credit' ? styles.amountCredit : styles.amountDebit}`}>
                        {tx.type === 'credit' ? '+' : '-'}₵{Number(tx.amount).toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.dateText} title={formatFullDate(tx.created_at)}>
                        {timeAgo(tx.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className={styles.cards}>
            {paged.map(tx => (
              <div key={tx.id} className={styles.card}>
                <div className={`${styles.typeIcon} ${tx.type === 'credit' ? styles.iconCredit : styles.iconDebit}`}>
                  {tx.type === 'credit' ? '↑' : '↓'}
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <span className={styles.userName}>{tx.user_name ?? tx.user_phone ?? '—'}</span>
                    <span className={`${styles.amount} ${tx.type === 'credit' ? styles.amountCredit : styles.amountDebit}`}>
                      {tx.type === 'credit' ? '+' : '-'}₵{Number(tx.amount).toFixed(2)}
                    </span>
                  </div>
                  <div className={styles.cardDesc}>{tx.description ?? '—'}</div>
                  <div className={styles.cardMeta}>
                    <span className={styles.typeBadge} data-type={tx.type}>
                      {tx.type === 'credit' ? 'Credit' : 'Debit'}
                    </span>
                    <span className={styles.dateText}>{timeAgo(tx.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            start={start}
            onPage={setPage}
          />
        </>
      )}
    </div>
  )
}
