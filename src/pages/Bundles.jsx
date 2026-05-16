import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart } from 'iconsax-react'
import styles from './Bundles.module.css'
import BundleSelect, { BUNDLE_OPTIONS } from '../components/BundleSelect/BundleSelect'
import { useCart } from '../context/CartContext'
import mtn from '../assets/mtn.jpg'
import telecel from '../assets/telecel.jpg'
import tigo from '../assets/tigo.jpg'

const NETWORKS = [
  { id: 'mtn',     name: 'MTN Bundles',       logo: mtn     },
  { id: 'telecel', name: 'Telecel Bundles',    logo: telecel },
  { id: 'tigo',    name: 'AirtelTigo Bundles', logo: tigo    },
]

function BundleCard({ network }) {
  const [phone, setPhone]   = useState('')
  const [bundle, setBundle] = useState(null)
  const { addToCart } = useCart()

  return (
    <div className={styles.card}>
      <div className={styles.networkRow}>
        <img src={network.logo} alt={network.name} className={styles.logo} />
        <span className={styles.networkName}>{network.name}</span>
      </div>

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
        />
      </div>

      <BundleSelect value={bundle} onChange={setBundle} />

      <button
        className={styles.addBtn}
        disabled={!phone.trim() || !bundle}
        onClick={() => {
          const opt = BUNDLE_OPTIONS.find(o => o.value === bundle)
          addToCart({
            networkId:   network.id,
            networkName: network.name,
            networkLogo: network.logo,
            bundleValue: bundle,
            bundleLabel: opt.label,
            price:       opt.price,
            phone,
          })
        }}
      >
        <ShoppingCart size={20} color="currentColor" variant="Bold" />
        Add to Cart
      </button>
    </div>
  )
}

export default function Bundles() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')} aria-label="Go back">
          <ArrowLeft size={20} color="currentColor" />
        </button>
        <span className={styles.pageTitle}>All Bundles</span>
      </div>

      <div className={styles.list}>
        {NETWORKS.map((n) => (
          <BundleCard key={n.id} network={n} />
        ))}
      </div>
    </div>
  )
}
