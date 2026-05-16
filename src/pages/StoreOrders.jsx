import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, SearchNormal1, Filter } from 'iconsax-react'
import FilterSheet from '../components/FilterSheet/FilterSheet'
import styles from './StoreOrders.module.css'

const STORE_ORDERS = [
  { id:  1, network: 'MTN',        bundle: '5GB',  phone: '0244***234', time: '10 mins ago', date: 'Today',     amountPaid: 18.00, profit: 3.00, status: 'Delivered' },
  { id:  2, network: 'MTN',        bundle: '10GB', phone: '0244***111', time: '32 mins ago', date: 'Today',     amountPaid: 33.00, profit: 3.00, status: 'Delivered' },
  { id:  3, network: 'Telecel',    bundle: '2GB',  phone: '0201***900', time: '1 hr ago',    date: 'Today',     amountPaid: 12.00, profit: 2.00, status: 'Pending'   },
  { id:  4, network: 'MTN',        bundle: '1GB',  phone: '0557***410', time: '2 hrs ago',   date: 'Today',     amountPaid:  6.50, profit: 0.50, status: 'Delivered' },
  { id:  5, network: 'AirtelTigo', bundle: '5GB',  phone: '0271***780', time: '3 hrs ago',   date: 'Today',     amountPaid: 18.00, profit: 3.00, status: 'Delivered' },
  { id:  6, network: 'Telecel',    bundle: '6GB',  phone: '0201***334', time: '5 hrs ago',   date: 'Today',     amountPaid: 24.00, profit: 4.00, status: 'Delivered' },
  { id:  7, network: 'MTN',        bundle: '10GB', phone: '0244***520', time: '8:14 AM',     date: 'Yesterday', amountPaid: 33.00, profit: 3.00, status: 'Delivered' },
  { id:  8, network: 'AirtelTigo', bundle: '2GB',  phone: '0277***067', time: '7:52 AM',     date: 'Yesterday', amountPaid: 12.00, profit: 2.00, status: 'Delivered' },
  { id:  9, network: 'Telecel',    bundle: '5GB',  phone: '0201***441', time: '6:30 AM',     date: 'Yesterday', amountPaid: 18.00, profit: 3.00, status: 'Pending'   },
  { id: 10, network: 'MTN',        bundle: '1GB',  phone: '0550***899', time: '11:45 PM',    date: '2 days ago', amountPaid:  6.50, profit: 0.50, status: 'Delivered' },
  { id: 11, network: 'MTN',        bundle: '5GB',  phone: '0243***312', time: '9:20 PM',     date: '2 days ago', amountPaid: 18.00, profit: 3.00, status: 'Delivered' },
  { id: 12, network: 'AirtelTigo', bundle: '10GB', phone: '0270***654', time: '4:05 PM',     date: '2 days ago', amountPaid: 33.00, profit: 3.00, status: 'Delivered' },
]

const FILTER_SECTIONS = [
  { key: 'network', label: 'Network', options: ['All', 'MTN', 'Telecel', 'AirtelTigo'] },
  { key: 'status',  label: 'Status',  options: ['All', 'Delivered', 'Pending'] },
  { key: 'date',    label: 'Date',    options: ['All', 'Today', 'Yesterday', '2 days ago'] },
]

const DEFAULT_FILTERS = { network: 'All', status: 'All', date: 'All' }

function groupByDate(orders) {
  const map = {}
  orders.forEach(o => {
    if (!map[o.date]) map[o.date] = []
    map[o.date].push(o)
  })
  return Object.entries(map).map(([date, items]) => ({ date, items }))
}

export default function StoreOrders() {
  const navigate = useNavigate()
  const [query, setQuery]           = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters]       = useState(DEFAULT_FILTERS)

  const hasActiveFilter = filters.network !== 'All' || filters.status !== 'All' || filters.date !== 'All'

  const filtered = STORE_ORDERS.filter(o => {
    if (query.trim() && !(
      o.network.toLowerCase().includes(query.toLowerCase()) ||
      o.bundle.toLowerCase().includes(query.toLowerCase()) ||
      o.phone.includes(query)
    )) return false
    if (filters.network !== 'All' && o.network !== filters.network) return false
    if (filters.status  !== 'All' && o.status  !== filters.status)  return false
    if (filters.date    !== 'All' && o.date    !== filters.date)    return false
    return true
  })

  const groups       = groupByDate(filtered)
  const totalOrders  = filtered.length
  const totalProfit  = filtered.reduce((s, o) => s + o.profit, 0)

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
        {groups.length === 0 ? (
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
                        <span className={styles.name}>{order.network} {order.bundle} Bundle</span>
                        <span className={styles.phone}>{order.phone} · MoMo</span>
                        <span className={styles.time}>{order.time}</span>
                      </div>
                      <div className={styles.right}>
                        <span className={styles.amountPaid}>₵{order.amountPaid.toFixed(2)}</span>
                        <span className={styles.profit}>+₵{order.profit.toFixed(2)}</span>
                        <span className={styles.status} data-status={order.status.toLowerCase()}>
                          {order.status}
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
