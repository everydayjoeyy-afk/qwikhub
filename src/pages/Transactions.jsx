import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, SearchNormal1, Filter } from 'iconsax-react'
import FilterSheet from '../components/FilterSheet/FilterSheet'
import { useAuth } from '../context/AuthContext'
import { getTransactions } from '../lib/db'
import styles from './Transactions.module.css'

const FILTER_SECTIONS = [
  { key: 'type',   label: 'Type',   options: ['All', 'Credit', 'Debit'] },
  { key: 'period', label: 'Period', options: ['All', 'Today', 'This week', 'This month'] },
]

const DEFAULT_FILTERS = { type: 'All', period: 'All' }

function formatDate(dateStr) {
  const d         = new Date(dateStr)
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString())     return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  const diffDays = Math.floor((today - d) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function isInPeriod(dateStr, period) {
  if (period === 'All') return true
  const d     = new Date(dateStr)
  const today = new Date()
  if (period === 'Today')      return d.toDateString() === today.toDateString()
  if (period === 'This week')  { const w = new Date(today); w.setDate(w.getDate() - 7); return d >= w }
  if (period === 'This month') return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  return true
}

function groupByDate(txs) {
  const map = {}
  txs.forEach(tx => {
    const key = formatDate(tx.created_at)
    if (!map[key]) map[key] = []
    map[key].push(tx)
  })
  return Object.entries(map).map(([date, items]) => ({ date, items }))
}

export default function Transactions() {
  const navigate        = useNavigate()
  const { user }        = useAuth()
  const [txs, setTxs]   = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery]     = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters]       = useState(DEFAULT_FILTERS)

  useEffect(() => {
    if (!user) return
    getTransactions(user.id).then(({ data }) => {
      setTxs(data ?? [])
      setLoading(false)
    })
  }, [user])

  const hasActiveFilter = filters.type !== 'All' || filters.period !== 'All'

  const filtered = txs.filter(tx => {
    if (query.trim() && !tx.description?.toLowerCase().includes(query.toLowerCase())) return false
    if (filters.type !== 'All' && tx.type !== filters.type.toLowerCase()) return false
    if (!isInPeriod(tx.created_at, filters.period)) return false
    return true
  })

  const groups = groupByDate(filtered)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')} aria-label="Go back">
          <ArrowLeft size={20} color="currentColor" />
        </button>
        <span className={styles.pageTitle}>Transactions</span>
        <button
          className={`${styles.filterBtn} ${hasActiveFilter ? styles.filterBtnActive : ''}`}
          aria-label="Filter"
          onClick={() => setFilterOpen(true)}
        >
          <Filter size={20} color="currentColor" />
        </button>
      </div>

      <div className={styles.searchWrap}>
        <SearchNormal1 size={16} color="currentColor" className={styles.searchIcon} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search transactions"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.list}>
        {loading ? (
          <span className={styles.empty}>Loading…</span>
        ) : groups.length === 0 ? (
          <span className={styles.empty}>No transactions yet</span>
        ) : (
          groups.map(group => (
            <div key={group.date} className={styles.group}>
              <span className={styles.dateLabel}>{group.date}</span>
              <div className={styles.groupItems}>
                {group.items.map((tx, i) => (
                  <div key={tx.id}>
                    <div className={styles.row}>
                      <div className={styles.info}>
                        <span className={styles.name}>{tx.description ?? tx.type}</span>
                        <span className={styles.time}>{formatTime(tx.created_at)}</span>
                      </div>
                      <span
                        className={styles.amount}
                        data-positive={tx.type === 'credit' || undefined}
                      >
                        {tx.type === 'credit' ? '+' : '-'}₵{Number(tx.amount).toFixed(2)}
                      </span>
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
