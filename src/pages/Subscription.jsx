import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart } from 'iconsax-react'
import SubscriptionSelect from '../components/SubscriptionSelect/SubscriptionSelect'
import { useCart } from '../context/CartContext'
import styles from './Subscription.module.css'

export default function Subscription() {
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const [selected, setSelected] = useState(null)
  const [email, setEmail] = useState('')

  const handleAdd = () => {
    if (!selected) return
    addToCart({
      type:        'subscription',
      bundleLabel: selected.label,
      bundleValue: selected.value,
      price:       selected.price,
      networkLogo: selected.logo,
      phone:       email,
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')} aria-label="Go back">
          <ArrowLeft size={20} color="currentColor" />
        </button>
        <span className={styles.pageTitle}>Premium Orders</span>
      </div>

      <div className={styles.card}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Service</label>
          <SubscriptionSelect
            value={selected?.value ?? null}
            onChange={setSelected}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor="sub-email">Email</label>
          <input
            id="sub-email"
            type="email"
            className={styles.input}
            placeholder="eg. johdoe@qwikhub.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Price</label>
          <div className={styles.priceDisplay}>
            {selected ? `₵${selected.price.toFixed(2)}` : '—'}
          </div>
        </div>

        <button className={styles.addBtn} onClick={handleAdd} disabled={!selected}>
          <ShoppingCart size={20} color="currentColor" variant="Bold" />
          Add to Cart
        </button>
      </div>
    </div>
  )
}
