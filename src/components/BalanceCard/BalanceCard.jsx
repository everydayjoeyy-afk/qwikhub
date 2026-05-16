import { useState } from 'react'
import { WalletMoney, Refresh } from 'iconsax-react'
import styles from './BalanceCard.module.css'
import effect from '../../assets/effect.png'

export default function BalanceCard({ balance = '0.00', onAddMoney, onRefresh }) {
  const [spinning, setSpinning] = useState(false)

  const handleRefresh = async () => {
    if (spinning) return
    setSpinning(true)
    await onRefresh?.()
    setTimeout(() => setSpinning(false), 800)
  }

  return (
    <div className={styles.card}>
      <img src={effect} alt="" className={styles.effect} aria-hidden="true" />
      <span className={styles.label}>Your available balance is</span>
      <span className={styles.amount}>₵{balance}</span>

      <div className={styles.actions}>
        <button className={styles.addMoneyBtn} onClick={onAddMoney}>
          <WalletMoney size={20} color="currentColor" variant="Bold" />
          Add Money
        </button>

        <button
          className={styles.refreshBtn}
          onClick={handleRefresh}
          aria-label="Refresh balance"
        >
          <Refresh
            size={18}
            color="currentColor"
            variant="Bold"
            className={spinning ? styles.spinning : ''}
          />
        </button>
      </div>
    </div>
  )
}
