import { useNavigate } from 'react-router-dom'
import { ArrowRight2 } from 'iconsax-react'
import { TRANSACTIONS, formatAmount } from '../../data/transactions'
import styles from './RecentTransactions.module.css'

const RECENT = TRANSACTIONS.slice(0, 4)

export default function RecentTransactions() {
  const navigate = useNavigate()

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
        {RECENT.map((tx, i) => (
          <div key={tx.id}>
            <div className={styles.row}>
              <div className={styles.info}>
                <span className={styles.name}>{tx.name}</span>
                <span className={styles.time}>{tx.time}</span>
              </div>
              <span
                className={styles.amount}
                data-positive={tx.amount >= 0 || undefined}
              >
                {formatAmount(tx.amount)}
              </span>
            </div>
            {i < RECENT.length - 1 && <div className={styles.divider} />}
          </div>
        ))}
      </div>
    </div>
  )
}
