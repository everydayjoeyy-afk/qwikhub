import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'iconsax-react'
import styles from './BillingHistory.module.css'

export default function BillingHistory() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft size={20} color="currentColor" />
        </button>
        <span className={styles.pageTitle}>Billing History</span>
        <div style={{ width: 32 }} />
      </div>

      <div className={styles.list}>
        <span className={styles.empty}>No billing history yet</span>
      </div>
    </div>
  )
}
