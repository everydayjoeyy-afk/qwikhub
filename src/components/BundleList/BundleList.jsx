import { useState } from 'react'
import { ArrowDown2, ShoppingCart } from 'iconsax-react'
import BundleSelect, { BUNDLE_OPTIONS } from '../BundleSelect/BundleSelect'
import { useCart } from '../../context/CartContext'
import styles from './BundleList.module.css'
import mtn     from '../../assets/mtn.jpg'
import telecel from '../../assets/telecel.jpg'
import tigo    from '../../assets/tigo.jpg'

const NETWORKS = [
  { id: 'mtn',     label: 'Buy MTN Bundles',       fullName: 'MTN Bundles',        logo: mtn     },
  { id: 'telecel', label: 'Buy Telecel Bundles',    fullName: 'Telecel Bundles',    logo: telecel },
  { id: 'tigo',    label: 'Buy AirtelTigo Bundles', fullName: 'AirtelTigo Bundles', logo: tigo    },
]

export default function BundleList() {
  const [expanded, setExpanded] = useState(null)

  const toggle = (id) => setExpanded(prev => prev === id ? null : id)

  return (
    <div className={styles.list}>
      {NETWORKS.map((network) => (
        <BundleCard
          key={network.id}
          network={network}
          isOpen={expanded === network.id}
          onToggle={() => toggle(network.id)}
        />
      ))}
    </div>
  )
}

function BundleCard({ network, isOpen, onToggle }) {
  const [phone, setPhone]   = useState('')
  const [bundle, setBundle] = useState(null)
  const { addToCart }       = useCart()

  const handleAdd = () => {
    const opt = BUNDLE_OPTIONS.find(o => o.value === bundle)
    if (!opt) return
    addToCart({
      networkId:   network.id,
      networkName: network.fullName,
      networkLogo: network.logo,
      bundleValue: bundle,
      bundleLabel: opt.label,
      price:       opt.price,
      phone,
    })
  }

  return (
    <div className={`${styles.card} ${isOpen ? styles.cardOpen : ''}`}>

      {/* ── Header row — tap to expand/collapse ── */}
      <button className={styles.cardHeader} onClick={onToggle} aria-expanded={isOpen}>
        <img src={network.logo} alt={network.id} className={styles.logo} />
        <span className={styles.label}>{network.label}</span>
        <ArrowDown2
          size={18}
          color="currentColor"
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
        />
      </button>

      {/* ── Expandable body ── */}
      {isOpen && (
        <div className={styles.body}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor={`phone-${network.id}`}>
              Phone Number
            </label>
            <input
              id={`phone-${network.id}`}
              type="tel"
              className={styles.input}
              placeholder="eg. 024XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={12}
              autoFocus
            />
          </div>

          <BundleSelect value={bundle} onChange={setBundle} />

          <button
            className={styles.addBtn}
            disabled={!phone.trim() || !bundle}
            onClick={handleAdd}
          >
            <ShoppingCart size={20} color="currentColor" variant="Bold" />
            Add to Cart
          </button>
        </div>
      )}
    </div>
  )
}
