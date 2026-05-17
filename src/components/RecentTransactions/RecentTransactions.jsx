import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight2 } from 'iconsax-react'
import { useAuth } from '../../context/AuthContext'
import { getTransactions } from '../../lib/db'
import styles from './RecentTransactions.module.css'

function formatAmount(amount, type) {
  const abs = Math.abs(amount).toFixed(2)
  return type === 'credit' ? `+₵${abs}` : `-₵${abs}`
}

function formatTime(isoString) {
  const d = new Date(isoString)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1)   return 'Just now'
  if (diffMins < 60)  return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
}

export default function RecentTransactions({ txKey = 0 }) {
  const navigate = useNavigate()
  const { user, ready } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [internalKey, setInternalKey] = useState(0)

  // Re-fetch when cart payment completes (fired from CartModal)
  useEffect(() => {
    const handler = () => setInternalKey(k => k + 1)
    window.addEventListener('qwikhub:payment', handler)
    return () => window.removeEventListener('qwikhub:payment', handler)
  }, [])

  useEffect(() => {
    if (!user || !ready) return

    setLoading(true)
    const timer = setTimeout(() => setLoading(false), 8000)

    getTransactions(user.id)
      .then(({ data }) => {
        setTransactions((data ?? []).slice(0, 4))
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timer)
        setLoading(false)
      })

    return () => clearTimeout(timer)
  }, [user, ready, txKey, internalKey])

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>Recent Transactions</span>
        <button
          className={styles.seeAll}
          aria-label="See all transactions"
          onClick={() => navigate('/transactions')}
        >
          <ArrowRight2 size={16} color="currentColor" />
        </button>
      </div>

      <div className={styles.list}>
        {loading ? (
          <p className={styles.hint}>Loading…</p>
        ) : transactions.length === 0 ? (
          <p className={styles.hint}>No transactions yet</p>
        ) : (
          transactions.map((tx, i) => (
            <div key={tx.id}>
              <div className={styles.row}>
                <div className={styles.info}>
                  <span className={styles.name}>{tx.description}</span>
                  <span className={styles.time}>{formatTime(tx.created_at)}</span>
                </div>
                <span
                  className={styles.amount}
                  data-positive={tx.type === 'credit' || undefined}
                >
                  {formatAmount(tx.amount, tx.type)}
                </span>
              </div>
              {i < transactions.length - 1 && <div className={styles.divider} />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
