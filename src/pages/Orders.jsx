import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'iconsax-react'
import styles from './Orders.module.css'

export default function Orders() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft size={20} color="currentColor" />
        </button>
        <span className={styles.pageTitle}>Orders</span>
        <div style={{ width: 32 }} />
      </div>

      <div className={styles.list}>
        <span className={styles.empty}>No orders yet</span>
      </div>
    </div>
  )
}
