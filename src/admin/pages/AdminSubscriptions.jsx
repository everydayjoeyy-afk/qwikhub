import { useState, useEffect, useMemo } from 'react'
import { SearchNormal1, Clock } from 'iconsax-react'
import { adminGetSubscriptionOrders, adminUpdateSubStatus } from '../lib/adminDb'
import styles from './AdminSubscriptions.module.css'

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

// Parse "[Sub] Netflix Premium → 0244123456 (Netflix)"
function parseSub(desc = '') {
  const clean = desc.replace(/^\[Sub\]\s*/, '')
  const arrowIdx = clean.indexOf(' → ')
  const parenIdx = clean.lastIndexOf(' (')
  if (arrowIdx === -1) return { plan: clean, phone: '', service: '' }
  const plan    = clean.slice(0, arrowIdx)
  const phone   = parenIdx > arrowIdx ? clean.slice(arrowIdx + 3, parenIdx) : clean.slice(arrowIdx + 3)
  const service = parenIdx > -1 ? clean.slice(parenIdx + 2, -1) : ''
  return { plan, phone, service }
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

const PERIODS = [
  { key: 'all',   label: 'All time' },
  { key: 'today', label: 'Today'    },
  { key: 'week',  label: 'This week'},
  { key: 'month', label: 'This month'},
]

const STATUS_TABS = [
  { key: 'all',       label: 'All'       },
  { key: 'pending',   label: 'Pending'   },
  { key: 'delivered', label: 'Fulfilled' },
  { key: 'failed',    label: 'Failed'    },
]

function StatusBadge({ status }) {
  const label =
    status === 'delivered' ? 'Fulfilled' :
    status === 'pending_verification' ? 'Failed' :
    status === 'not_applicable' ? 'Pending' :
    status === 'pending' ? 'Pending' :
    status || 'Pending'
  const key =
    status === 'delivered' ? 'delivered' :
    status === 'pending_verification' ? 'failed' : 'pending'
  return <span className={styles.statusBadge} data-status={key}>{label}</span>
}

// ── Main component ────────────────────────────────────────────────
export default function AdminSubscriptions() {
  const [orders,   setOrders]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [query,    setQuery]    = useState('')
  const [statusTab, setStatusTab] = useState('all')
  const [period,   setPeriod]   = useState('all')
  const [page,     setPage]     = useState(1)
  const [updating, setUpdating] = useState(null)
  const PAGE_SIZE = 15

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: err } = await adminGetSubscriptionOrders()
    setLoading(false)
    if (err) { setError(err.message); return }
    setOrders(Array.isArray(data) ? data : [])
  }

  async function handleStatusChange(id, newStatus) {
    setUpdating(id)
    const { error: err } = await adminUpdateSubStatus(id, newStatus)
    setUpdating(null)
    if (err) { alert(`Failed to update: ${err.message}`); return }
    setOrders(prev => prev.map(o =>
      o.id === id ? { ...o, delivery_status: newStatus } : o
    ))
  }

  // Parse each order
  const parsed = useMemo(() => orders.map(o => {
    const { plan, phone, service } = parseSub(o.description ?? '')
    return { ...o, plan, phone: phone || '—', service: service || '—' }
  }), [orders])

  useEffect(() => { setPage(1) }, [statusTab, period, query])

  const filtered = useMemo(() => parsed.filter(o => {
    // Status tab filter
    if (statusTab === 'pending'   && o.delivery_status !== 'not_applicable' && o.delivery_status !== 'pending') return false
    if (statusTab === 'delivered' && o.delivery_status !== 'delivered') return false
    if (statusTab === 'failed'    && o.delivery_status !== 'pending_verification') return false
    if (!isInPeriod(o.created_at, period)) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      if (
        !o.plan?.toLowerCase().includes(q) &&
        !o.phone?.includes(q) &&
        !o.service?.toLowerCase().includes(q) &&
        !o.buyer_name?.toLowerCase().includes(q)
      ) return false
    }
    return true
  }), [parsed, statusTab, period, query])

  // Stats
  const todayStr     = new Date().toDateString()
  const todayOrders  = orders.filter(o => new Date(o.created_at).toDateString() === todayStr)
  const pendingCount = orders.filter(o => o.delivery_status === 'not_applicable' || o.delivery_status === 'pending').length
  const totalRevenue = orders.reduce((s, o) => s + Number(o.amount), 0)

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageStart  = (page - 1) * PAGE_SIZE
  const paged      = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Subscription Orders</h1>
          <p className={styles.pageSubtitle}>Netflix, Spotify, and other subscription purchases</p>
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Orders today</span>
          <span className={styles.statValue}>{todayOrders.length}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pending fulfilment</span>
          <span className={styles.statValue}>{pendingCount}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total orders</span>
          <span className={styles.statValue}>{orders.length}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total revenue</span>
          <span className={styles.statValue}>₵{totalRevenue.toFixed(2)}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <SearchNormal1 size={15} color="var(--color-text-tertiary)" className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by plan, phone, service or buyer…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className={styles.filterRow}>
          <div className={styles.filterGroup}>
            {PERIODS.map(p => (
              <button
                key={p.key}
                className={`${styles.filterPill} ${period === p.key ? styles.filterPillActive : ''}`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className={styles.tabs}>
        {STATUS_TABS.map(t => {
          const count =
            t.key === 'all' ? orders.length :
            t.key === 'pending' ? orders.filter(o => o.delivery_status === 'not_applicable' || o.delivery_status === 'pending').length :
            t.key === 'delivered' ? orders.filter(o => o.delivery_status === 'delivered').length :
            orders.filter(o => o.delivery_status === 'pending_verification').length
          return (
            <button
              key={t.key}
              className={`${styles.tab} ${statusTab === t.key ? styles.tabActive : ''}`}
              onClick={() => setStatusTab(t.key)}
            >
              {t.label}
              <span className={styles.tabCount}>{count}</span>
            </button>
          )
        })}
        <span className={styles.tabRight}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
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
          <Clock size={36} color="var(--color-text-tertiary)" />
          <p className={styles.emptyText}>No subscription orders match your filters</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Plan</th>
                  <th>Sent to</th>
                  <th>Buyer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(o => (
                  <tr key={o.id}>
                    <td><span className={styles.serviceBadge}>{o.service}</span></td>
                    <td className={styles.planCell}>{o.plan}</td>
                    <td className={styles.phoneCell}>{o.phone}</td>
                    <td className={styles.buyerCell}>{o.buyer_name || '—'}</td>
                    <td className={styles.amountCell}>₵{Number(o.amount).toFixed(2)}</td>
                    <td><StatusBadge status={o.delivery_status} /></td>
                    <td>
                      <span className={styles.dateText} title={formatFullDate(o.created_at)}>
                        {timeAgo(o.created_at)}
                      </span>
                    </td>
                    <td>
                      {o.delivery_status !== 'delivered' && (
                        <div className={styles.actionBtns}>
                          <button
                            className={styles.actionBtn}
                            data-action="deliver"
                            disabled={updating === o.id}
                            onClick={() => handleStatusChange(o.id, 'delivered')}
                          >
                            {updating === o.id ? '…' : '✓ Fulfilled'}
                          </button>
                          {o.delivery_status !== 'pending_verification' && (
                            <button
                              className={styles.actionBtn}
                              data-action="fail"
                              disabled={updating === o.id}
                              onClick={() => handleStatusChange(o.id, 'pending_verification')}
                            >
                              ✗ Failed
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Showing {filtered.length === 0 ? 0 : pageStart + 1} to {Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className={styles.paginationControls}>
              <button className={styles.pageBtn} onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const lo = Math.max(1, Math.min(page - 2, totalPages - 4))
                const p  = lo + i
                if (p > totalPages) return null
                return (
                  <button
                    key={p}
                    className={`${styles.pageBtn} ${page === p ? styles.pageBtnActive : ''}`}
                    onClick={() => setPage(p)}
                  >{p}</button>
                )
              })}
              <button className={styles.pageBtn} onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>›</button>
            </div>
          </div>

          {/* Mobile cards */}
          <div className={styles.cards}>
            {paged.map(o => (
              <div key={o.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardTopLeft}>
                    <span className={styles.serviceBadge}>{o.service}</span>
                    <StatusBadge status={o.delivery_status} />
                  </div>
                  <span className={styles.cardAmount}>₵{Number(o.amount).toFixed(2)}</span>
                </div>
                <div className={styles.cardPlan}>{o.plan}</div>
                <div className={styles.cardMeta}>
                  <span className={styles.cardPhone}>{o.phone}</span>
                  <span className={styles.cardDot}>·</span>
                  <span className={styles.cardBuyer}>{o.buyer_name || '—'}</span>
                </div>
                <div className={styles.cardBottom}>
                  <span className={styles.cardDate}>{timeAgo(o.created_at)}</span>
                </div>
                {o.delivery_status !== 'delivered' && (
                  <div className={styles.actionBtns}>
                    <button
                      className={styles.actionBtn}
                      data-action="deliver"
                      disabled={updating === o.id}
                      onClick={() => handleStatusChange(o.id, 'delivered')}
                    >
                      {updating === o.id ? '…' : '✓ Fulfilled'}
                    </button>
                    {o.delivery_status !== 'pending_verification' && (
                      <button
                        className={styles.actionBtn}
                        data-action="fail"
                        disabled={updating === o.id}
                        onClick={() => handleStatusChange(o.id, 'pending_verification')}
                      >
                        ✗ Failed
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
