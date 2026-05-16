import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, SearchNormal1 } from 'iconsax-react'
import { useAuth } from '../context/AuthContext'
import { getTransactions } from '../lib/db'
import styles from './Orders.module.css'

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

function groupByDate(orders) {
  const map = {}
  orders.forEach(o => {
    const key = formatDate(o.created_at)
    if (!map[key]) map[key] = []
    map[key].push(o)
  })
  return Object.entries(map).map(([date, items]) => ({ date, items }))
}

// Parse "1GB Data → 0244123456 (MTN Bundles)" into parts
function parseDescription(desc) {
  const arrowIdx  = desc.indexOf(' → ')
  const parenIdx  = desc.lastIndexOf(' (')
  if (arrowIdx === -1) return { bundle: desc, phone: '', network: '' }
  const bundle  = desc.slice(0, arrowIdx)
  const phone   = parenIdx > arrowIdx ? desc.slice(arrowIdx + 3, parenIdx) : desc.slice(arrowIdx + 3)
  const network = parenIdx > -1 ? desc.slice(parenIdx + 2, -1) : ''
  return { bundle, phone, network }
}

export default function Orders() {
  const navigate   = useNavigate()
  const { user }   = useAuth()
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery]     = useState('')

  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => setLoading(false), 8000)

    getTransactions(user.id)
      .then(({ data }) => {
        // Bundle orders are debit transactions whose description contains '→'
        const bundleOrders = (data ?? []).filter(
          tx => tx.type === 'debit' && tx.description?.includes('→')
        )
        setOrders(bundleOrders)
      })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); setLoading(false) })

    return () => clearTimeout(timer)
  }, [user])

  const filtered = orders.filter(o => {
    if (!query.trim()) return true
    return o.description?.toLowerCase().includes(query.toLowerCase())
  })

  const groups = groupByDate(filtered)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft size={20} color="currentColor" />
        </button>
        <span className={styles.pageTitle}>Orders</span>
        <div style={{ width: 32 }} />
      </div>

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

      <div className={styles.list}>
        {loading ? (
          <span className={styles.empty}>Loading…</span>
        ) : groups.length === 0 ? (
          <span className={styles.empty}>No orders yet</span>
        ) : (
          groups.map(group => (
            <div key={group.date} className={styles.group}>
              <span className={styles.dateLabel}>{group.date}</span>
              <div className={styles.groupItems}>
                {group.items.map((order, i) => {
                  const { bundle, phone, network } = parseDescription(order.description ?? '')
                  return (
                    <div key={order.id}>
                      <div className={styles.row}>
                        <div className={styles.info}>
                          <span className={styles.name}>{bundle}{network ? ` · ${network}` : ''}</span>
                          {phone && <span className={styles.phone}>{phone}</span>}
                          <span className={styles.time}>{formatTime(order.created_at)}</span>
                        </div>
                        <div className={styles.right}>
                          <span className={styles.price}>₵{Number(order.amount).toFixed(2)}</span>
                          <span className={styles.status} data-status="pending">Processing</span>
                        </div>
                      </div>
                      {i < group.items.length - 1 && <div className={styles.divider} />}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
