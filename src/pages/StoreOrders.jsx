import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, SearchNormal1, Filter } from 'iconsax-react'
import FilterSheet from '../components/FilterSheet/FilterSheet'
import { useAuth } from '../context/AuthContext'
import { getMyStore, getStoreOrders } from '../lib/db'
import styles from './StoreOrders.module.css'

const FILTER_SECTIONS = [
  { key: 'network', label: 'Network', options: ['All', 'MTN', 'Telecel', 'AirtelTigo'] },
  { key: 'status',  label: 'Status',  options: ['All', 'Delivered', 'Pending', 'Failed'] },
  { key: 'period',  label: 'Period',  options: ['All', 'Today', 'This week', 'This month'] },
]

const DEFAULT_FILTERS = { network: 'All', status: 'All', period: 'All' }

function formatDate(isoStr) {
  const d         = new Date(isoStr)
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString())     return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  const diffDays = Math.floor((today - d) / 86400000)
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function isInPeriod(isoStr, period) {
  if (period === 'All') return true
  const d     = new Date(isoStr)
  const today = new Date()
  if (period === 'Today') return d.toDateString() === today.toDateString()
  if (period === 'This week') {
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)
    return d >= weekAgo
  }
  if (period === 'This month') {
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  }
  return true
}

function groupByDate(orders) {
  const map = {}
  orders.forEach(o => {
    const key = formatDate(o.created_at)
    if (!map[key]) map[key] = []
    map[key].push(o)
  })
  return Object.entries(map).map(([date, items]) => ({ date, items }))
}

export default function StoreOrders() {
  const navigate     = useNavigate()
  const { user } = useAuth()
  const [orders, setOrders]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [query, setQuery]           = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters]       = useState(DEFAULT_FILTERS)

  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => setLoading(false), 8000)

    ;(async () => {
      try {
        const { data: store } = await getMyStore(user.id)
        if (!store) { setLoading(false); return }

        const { data } = await getStoreOrders(store.id)
        setOrders(data ?? [])
      } catch (_) {}
      finally {
        clearTimeout(timer)
        setLoading(false)
      }
    })()

    return () => clearTimeout(timer)
  }, [user])

  const hasActiveFilter = filters.network !== 'All' || filters.status !== 'All' || filters.period !== 'All'

  const filtered = orders.filter(o => {
    const network  = o.bundle?.carrier ?? ''
    const bundle   = o.bundle?.data_size ?? ''
    const phone    = o.buyer_phone ?? ''
    const status   = o.status ?? ''

    if (query.trim() && !(
      network.toLowerCase().includes(query.toLowerCase()) ||
      bundle.toLowerCase().includes(query.toLowerCase()) ||
      phone.includes(query)
    )) return false
    if (filters.network !== 'All' && network !== filters.network) return false
    if (filters.status  !== 'All' && status.toLowerCase() !== filters.status.toLowerCase()) return false
    if (!isInPeriod(o.created_at, filters.period)) return false
    return true
  })

  const groups      = groupByDate(filtered)
  // Totals always from all orders, not filtered (same fix as Withdrawals #3)
  const totalOrders = orders.length
  const totalProfit = orders.reduce((s, o) => s + Number(o.profit ?? 0), 0)

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/my-store')} aria-label="Go back">
          <ArrowLeft size={20} color="currentColor" />
        </button>
        <span className={styles.pageTitle}>Store Orders</span>
        <button
          className={`${styles.filterBtn} ${hasActiveFilter ? styles.filterBtnActive : ''}`}
          aria-label="Filter"
          onClick={() => setFilterOpen(true)}
        >
          <Filter size={20} color="currentColor" />
        </button>
      </div>

      {/* Summary */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryBox}>
          <span className={styles.summaryValue}>{totalOrders}</span>
          <span className={styles.summaryLabel}>Orders</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryBox}>
          <span className={styles.summaryValue}>₵{totalProfit.toFixed(2)}</span>
          <span className={styles.summaryLabel}>Your profit</span>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <SearchNormal1 size={16} color="currentColor" className={styles.searchIcon} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search by network, bundle or phone"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {/* Grouped list */}
      <div className={styles.list}>
        {loading ? (
          <span className={styles.empty}>Loading…</span>
        ) : groups.length === 0 ? (
          <span className={styles.empty}>No orders found</span>
        ) : (
          groups.map(group => (
            <div key={group.date} className={styles.group}>
              <span className={styles.dateLabel}>{group.date}</span>
              <div className={styles.groupItems}>
                {group.items.map((order, i) => (
                  <div key={order.id}>
                    <div className={styles.row}>
                      <div className={styles.info}>
                        <span className={styles.name}>
                          {order.bundle?.carrier} {order.bundle?.data_size} Bundle
                        </span>
                        <span className={styles.phone}>{order.buyer_phone} · MoMo</span>
                        <span className={styles.time}>{formatTime(order.created_at)}</span>
                      </div>
                      <div className={styles.right}>
                        <span className={styles.amountPaid}>₵{Number(order.amount_paid).toFixed(2)}</span>
                        <span className={styles.profit}>+₵{Number(order.profit ?? 0).toFixed(2)}</span>
                        <span
                          className={styles.status}
                          data-status={(order.status ?? 'pending').toLowerCase()}
                        >
                          {order.status
                            ? order.status.charAt(0).toUpperCase() + order.status.slice(1)
                            : 'Pending'}
                        </span>
                      </div>
                    </div>
                    {i < group.items.length - 1 && <div className={styles.divider} />}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        sections={FILTER_SECTIONS}
        values={filters}
        onApply={newFilters => { setFilters(newFilters); setFilterOpen(false) }}
      />
    </div>
  )
}
