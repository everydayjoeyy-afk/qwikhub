import { useState } from 'react'
import { WalletMoney, Refresh, TickCircle } from 'iconsax-react'
import styles from './BalanceCard.module.css'
import effect from '../../assets/effect.png'

export default function BalanceCard({ balance = '0.00', onAddMoney, onRefresh }) {
  // 'idle' | 'spinning' | 'done'
  const [refreshState, setRefreshState] = useState('idle')

  const handleRefresh = async () => {
    if (refreshState !== 'idle') return
    setRefreshState('spinning')
    try {
      await onRefresh?.()
    } finally {
      setRefreshState('done')
      setTimeout(() => setRefreshState('idle'), 1500)
    }
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
          className={`${styles.refreshBtn} ${refreshState === 'done' ? styles.refreshDone : ''}`}
          onClick={handleRefresh}
          aria-label="Refresh balance"
          disabled={refreshState !== 'idle'}
        >
          {refreshState === 'done' ? (
            <TickCircle size={20} color="currentColor" variant="Bold" />
          ) : (
            <Refresh
              size={20}
              color="currentColor"
              variant="Bold"
              className={refreshState === 'spinning' ? styles.spinning : ''}
            />
          )}
        </button>
      </div>
    </div>
  )
}
