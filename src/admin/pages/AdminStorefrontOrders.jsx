import { useState, useEffect, useMemo } from 'react'
import { SearchNormal1, Clock } from 'iconsax-react'
import { adminGetStorefrontOrders, adminSetOrderDeliveryStatus } from '../lib/adminDb'
import styles from './AdminOrders.module.css'

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

const PERIODS = [
  { key: 'all',   label: 'All time'  },
  { key: 'today', label: 'Today'     },
  { key: 'week',  label: 'This week' },
  { key: 'month', label: 'This month'},
]

const STATUS_TABS = [
  { key: 'all',        label: 'All'        },
  { key: 'delivered',  label: 'Delivered'  },
  { key: 'processing', label: 'Processing' },
  { key: 'failed',     label: 'Needs review' },
]

// delivery_status → tab key
const statusToTab = (s) =>
  s === 'delivered' ? 'delivered' :
  s === 'pending_verification' ? 'failed' :
  'processing'

function NetworkBadge({ network }) {
  if (!network) return null
  const n = network.toLowerCase()
  const key = n.includes('mtn') ? 'mtn' : n.includes('telecel') ? 'telecel' : n.includes('airtel') ? 'airtel' : 'other'
  return <span className={styles.networkBadge} data-network={key}>{network}</span>
}

function StatusBadge({ status }) {
  const label =
    status === 'delivered' ? 'Delivered' :
    status === 'pending_verification' ? 'Needs review' :
    status === 'pending' ? 'Processing' :
    status || 'Unknown'
  const key =
    status === 'delivered' ? 'delivered' :
    status === 'pending_verification' ? 'failed' :
    status === 'pending' ? 'pending' : 'na'
  return <span className={styles.statusBadge} data-status={key}>{label}</span>
}

// ── Main component ────────────────────────────────────────────────
export default function AdminStorefrontOrders() {
  const [orders,   setOrders]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [query,    setQuery]    = useState('')
  const [tab,      setTab]      = useState('all')
  const [period,   setPeriod]   = useState('all')
  const [page,     setPage]     = useState(1)
  const [updating, setUpdating] = useState(null)
  const PAGE_SIZE = 15

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: err } = await adminGetStorefrontOrders()
    setLoading(false)
    if (err) { setError(err.message); return }
    setOrders(Array.isArray(data) ? data : [])
  }

  async function handleStatusChange(orderId, newStatus) {
    setUpdating(orderId)
    const { error: err } = await adminSetOrderDeliveryStatus(orderId, newStatus)
    setUpdating(null)
    if (err) { alert(`Failed to update status: ${err.message}`); return }
    setOrders(prev => prev.map(o =>
      o.order_id === orderId ? { ...o, delivery_status: newStatus } : o
    ))
  }

  useEffect(() => { setPage(1) }, [tab, period, query])

  const filtered = useMemo(() => orders.filter(o => {
    if (tab !== 'all' && statusToTab(o.delivery_status) !== tab) return false
    if (!isInPeriod(o.created_at, period)) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      if (
        !o.buyer_phone?.includes(q) &&
        !o.data_size?.toLowerCase().includes(q) &&
        !o.carrier?.toLowerCase().includes(q) &&
        !o.store_name?.toLowerCase().includes(q) &&
        !o.owner_name?.toLowerCase().includes(q) &&
        !o.paystack_ref?.toLowerCase().includes(q) &&
        !o.transaction_code?.toLowerCase().includes(q)
      ) return false
    }
    return true
  }), [orders, tab, period, query])

  // ── Stats (from full unfiltered set) ────────────────────────────
  const todayStr      = new Date().toDateString()
  const todayOrders   = orders.filter(o => new Date(o.created_at).toDateString() === todayStr)
  const revenueToday  = todayOrders.reduce((s, o) => s + Number(o.amount_paid ?? 0), 0)
  const totalProfit   = orders.reduce((s, o) => s + Number(o.profit ?? 0), 0)
  const needsReview   = orders.filter(o => o.delivery_status !== 'delivered').length

  // ── Pagination ──────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageStart  = (page - 1) * PAGE_SIZE
  const paged      = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  const bundleLabel = (o) => `${o.data_size ?? '—'}${o.carrier ? '' : ''}`

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Storefront Orders</h1>
          <p className={styles.pageSubtitle}>Every order placed through reseller storefronts</p>
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
          <span className={styles.statLabel}>Sales today</span>
          <span className={styles.statValue}>₵{revenueToday.toFixed(2)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Seller profit (all)</span>
          <span className={styles.statValue}>₵{totalProfit.toFixed(2)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Needs review</span>
          <span className={styles.statValue}>{needsReview}</span>
        </div>
      </div>

      {/* Search + period */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <SearchNormal1 size={15} color="var(--color-text-tertiary)" className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by phone, store, owner, bundle or reference…"
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
          const count = t.key === 'all'
            ? orders.length
            : orders.filter(o => statusToTab(o.delivery_status) === t.key).length
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
          <p className={styles.emptyText}>No storefront orders match your filters</p>
        </div>
      ) : (
        <>
          {/* ── Desktop table ── */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Bundle · Network</th>
                  <th>Sent to</th>
                  <th>Amount</th>
                  <th>Profit</th>
                  <th>Status</th>
                  <th>Txn code</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(o => (
                  <tr key={o.order_id}>
                    <td className={styles.buyerCell}>
                      <div className={styles.bundleCell}>
                        <span className={styles.bundleName}>{o.store_name ?? '—'}</span>
                        {o.owner_name && (
                          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                            {o.owner_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.bundleCell}>
                        <span className={styles.bundleName}>{bundleLabel(o)}</span>
                        <NetworkBadge network={o.carrier} />
                      </div>
                    </td>
                    <td className={styles.phoneCell}>{o.buyer_phone ?? '—'}</td>
                    <td className={styles.amountCell}>₵{Number(o.amount_paid ?? 0).toFixed(2)}</td>
                    <td className={styles.amountCell} style={{ color: '#16a34a' }}>
                      +₵{Number(o.profit ?? 0).toFixed(2)}
                    </td>
                    <td><StatusBadge status={o.delivery_status} /></td>
                    <td>
                      <span
                        title={o.transaction_code ?? ''}
                        style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--color-text-tertiary)' }}
                      >
                        {o.transaction_code ? `${o.transaction_code.slice(0, 10)}…` : '—'}
                      </span>
                    </td>
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
                            disabled={updating === o.order_id}
                            onClick={() => handleStatusChange(o.order_id, 'delivered')}
                          >
                            {updating === o.order_id ? '…' : '✓ Delivered'}
                          </button>
                          {o.delivery_status !== 'pending_verification' && (
                            <button
                              className={styles.actionBtn}
                              data-action="fail"
                              disabled={updating === o.order_id}
                              onClick={() => handleStatusChange(o.order_id, 'pending_verification')}
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

          {/* ── Pagination ── */}
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Showing {filtered.length === 0 ? 0 : pageStart + 1} to {Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length} orders
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

          {/* ── Mobile cards ── */}
          <div className={styles.cards}>
            {paged.map(o => (
              <div key={o.order_id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardTopLeft}>
                    <NetworkBadge network={o.carrier} />
                  </div>
                  <span className={styles.cardAmount}>₵{Number(o.amount_paid ?? 0).toFixed(2)}</span>
                </div>
                <div className={styles.cardBundle}>{bundleLabel(o)}</div>
                <div className={styles.cardMeta}>
                  <span className={styles.cardPhone}>{o.buyer_phone ?? '—'}</span>
                  <span className={styles.cardDot}>·</span>
                  <span className={styles.cardBuyer}>{o.store_name ?? '—'}</span>
                  <span className={styles.cardDot}>·</span>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>+₵{Number(o.profit ?? 0).toFixed(2)}</span>
                </div>
                <div className={styles.cardBottom}>
                  <span className={styles.cardDate}>{timeAgo(o.created_at)}</span>
                  <StatusBadge status={o.delivery_status} />
                </div>
                {o.delivery_status !== 'delivered' && (
                  <div className={styles.actionBtns}>
                    <button
                      className={styles.actionBtn}
                      data-action="deliver"
                      disabled={updating === o.order_id}
                      onClick={() => handleStatusChange(o.order_id, 'delivered')}
                    >
                      {updating === o.order_id ? '…' : '✓ Delivered'}
                    </button>
                    {o.delivery_status !== 'pending_verification' && (
                      <button
                        className={styles.actionBtn}
                        data-action="fail"
                        disabled={updating === o.order_id}
                        onClick={() => handleStatusChange(o.order_id, 'pending_verification')}
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
