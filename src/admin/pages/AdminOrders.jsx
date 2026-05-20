import { useState, useEffect, useMemo } from 'react'
import { SearchNormal1, Clock } from 'iconsax-react'
import { adminGetOrders } from '../lib/adminDb'
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

// Parse wallet transaction description: "1GB → 0244123456 (MTN Bundles)"
function parseDesc(desc = '') {
  const arrowIdx = desc.indexOf(' → ')
  const parenIdx = desc.lastIndexOf(' (')
  if (arrowIdx === -1) return { bundle: desc, phone: '', network: '' }
  const bundle  = desc.slice(0, arrowIdx)
  const phone   = parenIdx > arrowIdx ? desc.slice(arrowIdx + 3, parenIdx) : desc.slice(arrowIdx + 3)
  const network = parenIdx > -1 ? desc.slice(parenIdx + 2, -1) : ''
  return { bundle, phone, network }
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

const NETWORKS = ['MTN', 'Telecel', 'AirtelTigo']

const PERIODS = [
  { key: 'all',   label: 'All time' },
  { key: 'today', label: 'Today'    },
  { key: 'week',  label: 'This week'},
  { key: 'month', label: 'This month'},
]

const TABS = [
  { key: 'all',        label: 'All'        },
  { key: 'storefront', label: 'Storefront' },
  { key: 'wallet',     label: 'Wallet'     },
]

// ── Sub-components ────────────────────────────────────────────────
function TypeBadge({ type }) {
  return (
    <span className={styles.typeBadge} data-type={type}>
      {type === 'storefront' ? 'Store' : 'Wallet'}
    </span>
  )
}

function NetworkBadge({ network }) {
  if (!network) return null
  const n = network.toLowerCase()
  const key = n.includes('mtn') ? 'mtn' : n.includes('telecel') ? 'telecel' : n.includes('airtel') ? 'airtel' : 'other'
  return <span className={styles.networkBadge} data-network={key}>{network}</span>
}

// ── Main component ────────────────────────────────────────────────
export default function AdminOrders() {
  const [orders,   setOrders]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [query,    setQuery]    = useState('')
  const [tab,      setTab]      = useState('all')
  const [network,  setNetwork]  = useState('all')
  const [period,   setPeriod]   = useState('all')
  const [page,     setPage]     = useState(1)
  const PAGE_SIZE = 15

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: err } = await adminGetOrders()
    setLoading(false)
    if (err) { setError(err.message); return }
    setOrders(Array.isArray(data) ? data : [])
  }

  // Normalise each order into a flat display object
  const normalised = useMemo(() => orders.map(o => {
    if (o.order_type === 'wallet') {
      const { bundle, phone, network: net } = parseDesc(o.description ?? '')
      return {
        ...o,
        displayBundle:  bundle,
        displayPhone:   phone || o.buyer_phone || '—',
        displayNetwork: net   || o.network || '',
        displayBuyer:   o.buyer_name || '—',
      }
    }
    // storefront
    return {
      ...o,
      displayBundle:  o.description || '—',
      displayPhone:   o.buyer_phone || '—',
      displayNetwork: o.network || '',
      displayBuyer:   o.store_name ? `via ${o.store_name}` : '—',
    }
  }), [orders])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [tab, network, period, query])

  const filtered = useMemo(() => normalised.filter(o => {
    if (tab !== 'all' && o.order_type !== tab) return false
    if (network !== 'all' && !o.displayNetwork?.toLowerCase().includes(network.toLowerCase())) return false
    if (!isInPeriod(o.created_at, period)) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      if (
        !o.displayPhone?.includes(q) &&
        !o.displayBundle?.toLowerCase().includes(q) &&
        !o.displayNetwork?.toLowerCase().includes(q) &&
        !o.displayBuyer?.toLowerCase().includes(q) &&
        !o.store_name?.toLowerCase().includes(q)
      ) return false
    }
    return true
  }), [normalised, tab, network, period, query])

  // ── Stats (always from full unfiltered set) ─────────────────────
  const todayStr     = new Date().toDateString()
  const todayOrders  = orders.filter(o => new Date(o.created_at).toDateString() === todayStr)
  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.amount), 0)
  const totalRevenue = orders.reduce((s, o) => s + Number(o.amount), 0)

  // ── Pagination ───────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageStart  = (page - 1) * PAGE_SIZE
  const paged      = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Order Feed</h1>
          <p className={styles.pageSubtitle}>All bundle orders across the platform</p>
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
          <span className={styles.statLabel}>Revenue today</span>
          <span className={styles.statValue}>₵{todayRevenue.toFixed(2)}</span>
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

      {/* Search + filters */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <SearchNormal1 size={15} color="var(--color-text-tertiary)" className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by phone, bundle, network or store…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className={styles.filterRow}>
          {/* Network filter */}
          <div className={styles.filterGroup}>
            <button
              className={`${styles.filterPill} ${network === 'all' ? styles.filterPillActive : ''}`}
              onClick={() => setNetwork('all')}
            >All networks</button>
            {NETWORKS.map(n => (
              <button
                key={n}
                className={`${styles.filterPill} ${network === n ? styles.filterPillActive : ''}`}
                onClick={() => setNetwork(network === n ? 'all' : n)}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Period filter */}
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

      {/* Type tabs */}
      <div className={styles.tabs}>
        {TABS.map(t => {
          const count = t.key === 'all'
            ? orders.length
            : orders.filter(o => o.order_type === t.key).length
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
          <p className={styles.emptyText}>No orders match your filters</p>
        </div>
      ) : (
        <>
          {/* ── Desktop table ── */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Bundle · Network</th>
                  <th>Sent to</th>
                  <th>Buyer / Store</th>
                  <th>Amount</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(o => (
                  <tr key={o.order_id}>
                    <td><TypeBadge type={o.order_type} /></td>
                    <td>
                      <div className={styles.bundleCell}>
                        <span className={styles.bundleName}>{o.displayBundle}</span>
                        <NetworkBadge network={o.displayNetwork} />
                      </div>
                    </td>
                    <td className={styles.phoneCell}>{o.displayPhone}</td>
                    <td className={styles.buyerCell}>{o.displayBuyer}</td>
                    <td className={styles.amountCell}>₵{Number(o.amount).toFixed(2)}</td>
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
                    <TypeBadge type={o.order_type} />
                    <NetworkBadge network={o.displayNetwork} />
                  </div>
                  <span className={styles.cardAmount}>₵{Number(o.amount).toFixed(2)}</span>
                </div>
                <div className={styles.cardBundle}>{o.displayBundle}</div>
                <div className={styles.cardMeta}>
                  <span className={styles.cardPhone}>{o.displayPhone}</span>
                  <span className={styles.cardDot}>·</span>
                  <span className={styles.cardBuyer}>{o.displayBuyer}</span>
                </div>
                <div className={styles.cardDate}>{timeAgo(o.created_at)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
