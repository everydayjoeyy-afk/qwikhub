import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ShoppingCart } from 'iconsax-react'
import styles from './Bundles.module.css'
import BundleSelect, { BUNDLE_OPTIONS } from '../components/BundleSelect/BundleSelect'
import { useCart } from '../context/CartContext'
import { getBundles } from '../lib/db'
import mtn from '../assets/mtn.jpg'
import telecel from '../assets/telecel.jpg'
import tigo from '../assets/tigo.jpg'

const NETWORKS = [
  { id: 'mtn',     name: 'MTN',        fullName: 'MTN Bundles',       logo: mtn,     dbCarrier: 'MTN'        },
  { id: 'telecel', name: 'Telecel',    fullName: 'Telecel Bundles',    logo: telecel, dbCarrier: 'Telecel'    },
  { id: 'tigo',    name: 'AirtelTigo', fullName: 'AirtelTigo Bundles', logo: tigo,    dbCarrier: 'AirtelTigo' },
]

function BundleCard({ network, priceMap }) {
  const [phone, setPhone]   = useState('')
  const [bundle, setBundle] = useState(null)
  const { addToCart } = useCart()

  // While prices are still loading (undefined), show all with hardcoded prices.
  // Once loaded, only show bundles the API actually offers (priceMap has an entry).
  const options = priceMap === undefined
    ? BUNDLE_OPTIONS
    : BUNDLE_OPTIONS
        .filter(opt => priceMap[opt.value] != null)
        .map(opt => ({ ...opt, price: priceMap[opt.value] }))

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

      <BundleSelect value={bundle} onChange={setBundle} options={options} />

      <button
        className={styles.addBtn}
        disabled={!phone.trim() || !bundle}
        onClick={() => {
          const opt = options.find(o => o.value === bundle)
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
  const [priceMaps, setPriceMaps] = useState(undefined)

  useEffect(() => {
    getBundles().then(({ data }) => {
      const maps = { mtn: {}, telecel: {}, tigo: {} }
      for (const bundle of (data ?? [])) {
        const network = NETWORKS.find(n => n.dbCarrier === bundle.carrier)
        if (!network) continue
        const key = bundle.data_size?.toLowerCase()
        if (key) maps[network.id][key] = Number(bundle.platform_price)
      }
      setPriceMaps(maps)
    })
  }, [])

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
        <BundleCard key={activeNetwork.id} network={activeNetwork} priceMap={priceMaps?.[activeNetwork.id]} />
      </div>
    </div>
  )
}
