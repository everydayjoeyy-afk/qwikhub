import { useState, useEffect, useMemo } from 'react'
import { SearchNormal1, Warning2, TickCircle, CloseCircle, InfoCircle } from 'iconsax-react'
import { adminGetFailedOrders } from '../lib/adminDb'
import styles from './AdminFailedOrders.module.css'

// ── Helpers ───────────────────────────────────────────────────────
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

const PERIODS = [
  { key: 'all',   label: 'All time'    },
  { key: 'today', label: 'Today'       },
  { key: 'week',  label: 'This week'   },
  { key: 'month', label: 'This month'  },
]

const STATUS_TABS = [
  { key: 'all',     label: 'All'     },
  { key: 'failed',  label: 'Failed'  },
  { key: 'pending', label: 'Pending' },
]

const PAGE_SIZE = 20

function StatusBadge({ status }) {
  return (
    <span className={styles.statusBadge} data-status={status?.toLowerCase()}>
      {status ?? 'unknown'}
    </span>
  )
}

function TypeBadge({ type }) {
  return (
    <span className={styles.typeBadge} data-type={type?.toLowerCase()}>
      {type === 'storefront' ? 'Store' : type === 'wallet' ? 'Wallet' : type ?? '—'}
    </span>
  )
}

function Pagination({ page, totalPages, total, start, onPage }) {
  const end = Math.min(start + PAGE_SIZE, total)
  const lo  = Math.max(1, Math.min(page - 2, totalPages - 4))
  const hi  = Math.min(totalPages, lo + 4)
  const pages = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  return (
    <div className={styles.pagination}>
      <span className={styles.paginationInfo}>
        Showing {total === 0 ? 0 : start + 1} to {end} of {total} orders
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

export default function AdminFailedOrders() {
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [status,  setStatus]  = useState('all')
  const [period,  setPeriod]  = useState('all')
  const [query,   setQuery]   = useState('')
  const [page,    setPage]    = useState(1)

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [status, period, query])

  async function load() {
    setLoading(true); setError('')
    try {
      const { data, error: err } = await adminGetFailedOrders()
      if (err) { setError(err.message); return }
      setOrders(Array.isArray(data) ? data : [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() => orders.filter(o => {
    if (status !== 'all' && o.status?.toLowerCase() !== status) return false
    if (!isInPeriod(o.created_at, period)) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      if (
        !o.buyer_phone?.includes(q) &&
        !o.user_name?.toLowerCase().includes(q) &&
        !o.description?.toLowerCase().includes(q) &&
        !o.store_name?.toLowerCase().includes(q) &&
        !o.network?.toLowerCase().includes(q)
      ) return false
    }
    return true
  }), [orders, status, period, query])

  const stats = useMemo(() => ({
    failed:     orders.filter(o => o.status?.toLowerCase() === 'failed').length,
    pending:    orders.filter(o => o.status?.toLowerCase() === 'pending').length,
    atRisk:     orders.filter(o => ['failed','pending'].includes(o.status?.toLowerCase()))
                      .reduce((s, o) => s + Number(o.amount_paid ?? o.amount ?? 0), 0),
    total:      orders.length,
  }), [orders])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const start      = (page - 1) * PAGE_SIZE
  const paged      = filtered.slice(start, start + PAGE_SIZE)

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Failed Orders</h1>
          <p className={styles.pageSubtitle}>Storefront orders that failed or are stuck in pending — needs your attention</p>
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={`${styles.statCard} ${styles.statCardRed}`}>
          <span className={styles.statLabel}>Failed</span>
          <span className={`${styles.statValue} ${styles.statRed}`}>{loading ? '—' : stats.failed}</span>
        </div>
        <div className={`${styles.statCard} ${styles.statCardAmber}`}>
          <span className={styles.statLabel}>Pending</span>
          <span className={`${styles.statValue} ${styles.statAmber}`}>{loading ? '—' : stats.pending}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total tracked</span>
          <span className={styles.statValue}>{loading ? '—' : stats.total}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>At-risk amount</span>
          <span className={`${styles.statValue} ${styles.statRed}`}>
            {loading ? '—' : `₵${stats.atRisk.toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* Info banner */}
      <div className={styles.infoBanner}>
        <InfoCircle size={15} color="#3b82f6" variant="Bold" />
        <span>
          This shows <strong>storefront orders</strong> with a <strong>failed</strong> or <strong>pending</strong> status.
          For wallet bundle orders, check the <strong>Transaction Log</strong> — any debit with a bundle description where you haven't yet sent the bundle manually should be investigated.
        </span>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <SearchNormal1 size={15} color="var(--color-text-tertiary)" className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by phone, user, description or store…"
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

      {/* Status tabs */}
      <div className={styles.tabs}>
        {STATUS_TABS.map(t => {
          const count = t.key === 'all'
            ? orders.length
            : orders.filter(o => o.status?.toLowerCase() === t.key).length
          return (
            <button
              key={t.key}
              className={`${styles.tab} ${status === t.key ? styles.tabActive : ''}`}
              onClick={() => setStatus(t.key)}
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
          <TickCircle size={36} color="#22c55e" variant="Bold" />
          <p className={styles.emptyText}>
            {orders.length === 0 ? 'No failed or pending orders — all clear!' : 'No orders match your filters'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Bundle / Description</th>
                  <th>Buyer phone</th>
                  <th>User / Store</th>
                  <th>Amount</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(o => (
                  <tr key={o.order_id}>
                    <td><StatusBadge status={o.status} /></td>
                    <td><TypeBadge type={o.order_type} /></td>
                    <td>
                      <div className={styles.descCell}>
                        <span className={styles.descText}>{o.description ?? '—'}</span>
                        {o.network && <span className={styles.networkTag} data-network={o.network?.toLowerCase().includes('mtn') ? 'mtn' : o.network?.toLowerCase().includes('telecel') ? 'telecel' : 'airtel'}>{o.network}</span>}
                      </div>
                    </td>
                    <td className={styles.phoneCell}>{o.buyer_phone ?? '—'}</td>
                    <td className={styles.userCell}>{o.user_name ?? o.store_name ?? '—'}</td>
                    <td className={styles.amountCell}>₵{Number(o.amount_paid ?? o.amount ?? 0).toFixed(2)}</td>
                    <td>
                      <span className={styles.dateText} title={formatFullDate(o.created_at)}>
                        {timeAgo(o.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className={styles.cards}>
            {paged.map(o => (
              <div key={o.order_id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardBadges}>
                    <StatusBadge status={o.status} />
                    <TypeBadge type={o.order_type} />
                  </div>
                  <span className={styles.amountCell}>₵{Number(o.amount_paid ?? o.amount ?? 0).toFixed(2)}</span>
                </div>
                <div className={styles.cardDesc}>{o.description ?? '—'}</div>
                <div className={styles.cardMeta}>
                  <span className={styles.phoneCell}>{o.buyer_phone ?? '—'}</span>
                  <span className={styles.cardDot}>·</span>
                  <span>{o.user_name ?? o.store_name ?? '—'}</span>
                  <span className={styles.cardDot}>·</span>
                  <span className={styles.dateText}>{timeAgo(o.created_at)}</span>
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
