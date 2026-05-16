import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, SearchNormal1 } from 'iconsax-react'
import { useAuth } from '../context/AuthContext'
import { getTransactions } from '../lib/db'
import styles from './BillingHistory.module.css'

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

function groupByDate(items) {
  const map = {}
  items.forEach(tx => {
    const key = formatDate(tx.created_at)
    if (!map[key]) map[key] = []
    map[key].push(tx)
  })
  return Object.entries(map).map(([date, items]) => ({ date, items }))
}

export default function BillingHistory() {
  const navigate   = useNavigate()
  const { user }   = useAuth()
  const [bills, setBills]     = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery]     = useState('')

  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => setLoading(false), 8000)

    getTransactions(user.id)
      .then(({ data }) => {
        // Billing history = credit transactions (wallet top-ups via Paystack)
        const credits = (data ?? []).filter(tx => tx.type === 'credit')
        setBills(credits)
      })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); setLoading(false) })

    return () => clearTimeout(timer)
  }, [user])

  const filtered = bills.filter(tx => {
    if (!query.trim()) return true
    return tx.description?.toLowerCase().includes(query.toLowerCase())
  })

  const groups = groupByDate(filtered)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft size={20} color="currentColor" />
        </button>
        <span className={styles.pageTitle}>Billing History</span>
        <div style={{ width: 32 }} />
      </div>

      <div className={styles.searchWrap}>
        <SearchNormal1 size={16} color="currentColor" className={styles.searchIcon} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search billing history"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.list}>
        {loading ? (
          <span className={styles.empty}>Loading…</span>
        ) : groups.length === 0 ? (
          <span className={styles.empty}>No billing history yet</span>
        ) : (
          groups.map(group => (
            <div key={group.date} className={styles.group}>
              <span className={styles.dateLabel}>{group.date}</span>
              <div className={styles.groupItems}>
                {group.items.map((tx, i) => (
                  <div key={tx.id}>
                    <div className={styles.row}>
                      <div className={styles.info}>
                        <span className={styles.name}>{tx.description ?? 'Wallet top-up'}</span>
                        <span className={styles.time}>{formatTime(tx.created_at)}</span>
                      </div>
                      <div className={styles.right}>
                        <span className={styles.price}>+₵{Number(tx.amount).toFixed(2)}</span>
                        <span className={styles.status} data-status="delivered">Completed</span>
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
    </div>
  )
}
