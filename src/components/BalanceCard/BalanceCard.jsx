import { WalletMoney } from 'iconsax-react'
import styles from './BalanceCard.module.css'
import effect from '../../assets/effect.png'

export default function BalanceCard({ balance = '20,983', onAddMoney }) {
  return (
    <div className={styles.card}>
      <img src={effect} alt="" className={styles.effect} aria-hidden="true" />
      <span className={styles.label}>Your available balance is</span>
      <span className={styles.amount}>₵{balance}</span>
      <button className={styles.addMoneyBtn} onClick={onAddMoney}>
        <WalletMoney size={20} color="currentColor" variant="Bold" />
        Add Money
      </button>
    </div>
  )
}
