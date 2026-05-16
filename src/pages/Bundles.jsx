import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ShoppingCart } from 'iconsax-react'
import styles from './Bundles.module.css'
import BundleSelect, { BUNDLE_OPTIONS } from '../components/BundleSelect/BundleSelect'
import { useCart } from '../context/CartContext'
import mtn from '../assets/mtn.jpg'
import telecel from '../assets/telecel.jpg'
import tigo from '../assets/tigo.jpg'

const NETWORKS = [
  { id: 'mtn',     name: 'MTN',        fullName: 'MTN Bundles',       logo: mtn     },
  { id: 'telecel', name: 'Telecel',    fullName: 'Telecel Bundles',    logo: telecel },
  { id: 'tigo',    name: 'AirtelTigo', fullName: 'AirtelTigo Bundles', logo: tigo    },
]

function BundleCard({ network }) {
  const [phone, setPhone]   = useState('')
  const [bundle, setBundle] = useState(null)
  const { addToCart } = useCart()

  return (
    <div className={styles.card}>
      <div className={styles.networkRow}>
        <img src={network.logo} alt={network.name} className={styles.logo} />
        <span className={styles.networkName}>{network.fullName}</span>
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
            networkName: network.fullName,
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
  const { sub } = useParams()

  // Determine active network from URL param; default to first
  const activeNetwork = NETWORKS.find(n => n.id === sub) ?? NETWORKS[0]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')} aria-label="Go back">
          <ArrowLeft size={20} color="currentColor" />
        </button>
        <span className={styles.pageTitle}>Buy Bundles</span>
      </div>

      {/* Network tab bar */}
      <div className={styles.tabs}>
        {NETWORKS.map((network) => {
          const isActive = network.id === activeNetwork.id
          return (
            <button
              key={network.id}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => navigate(`/bundles/${network.id}`)}
            >
              <span className={styles.tabName}>{network.name}</span>
            </button>
          )
        })}
      </div>

      {/* Show only the selected network's card */}
      <div className={styles.list}>
        <BundleCard key={activeNetwork.id} network={activeNetwork} />
      </div>
    </div>
  )
}
