import { useState, useEffect } from 'react'
import { ArrowDown2, ShoppingCart } from 'iconsax-react'
import BundleSelect, { BUNDLE_OPTIONS } from '../BundleSelect/BundleSelect'
import { useCart } from '../../context/CartContext'
import { getBundles } from '../../lib/db'
import styles from './BundleList.module.css'
import mtn     from '../../assets/mtn.jpg'
import telecel from '../../assets/telecel.jpg'
import tigo    from '../../assets/tigo.jpg'

const NETWORKS = [
  { id: 'mtn',     label: 'Buy MTN Bundles',       fullName: 'MTN Bundles',       logo: mtn,     dbCarrier: 'MTN'        },
  { id: 'telecel', label: 'Buy Telecel Bundles',    fullName: 'Telecel Bundles',   logo: telecel, dbCarrier: 'Telecel'    },
  { id: 'tigo',    label: 'Buy AirtelTigo Bundles', fullName: 'AirtelTigo Bundles',logo: tigo,    dbCarrier: 'AirtelTigo' },
]

export default function BundleList() {
  const [expanded,  setExpanded]  = useState(null)
  const [priceMaps, setPriceMaps] = useState(undefined)
  const [costMaps,  setCostMaps]  = useState({})

  useEffect(() => {
    getBundles().then(({ data }) => {
      const maps  = { mtn: {}, telecel: {}, tigo: {} }
      const costs = { mtn: {}, telecel: {}, tigo: {} }
      for (const bundle of (data ?? [])) {
        const network = NETWORKS.find(n => n.dbCarrier === bundle.carrier)
        if (!network) continue
        const key = bundle.data_size?.toLowerCase() // '1GB' → '1gb'
        if (key) {
          maps[network.id][key]  = Number(bundle.platform_price)
          costs[network.id][key] = Number(bundle.cost_price ?? 0)
        }
      }
      setPriceMaps(maps)
      setCostMaps(costs)
    })
  }, [])

  const toggle = (id) => setExpanded(prev => prev === id ? null : id)

  return (
    <div className={styles.list}>
      {NETWORKS.map((network) => (
        <BundleCard
          key={network.id}
          network={network}
          isOpen={expanded === network.id}
          onToggle={() => toggle(network.id)}
          priceMap={priceMaps?.[network.id]}
          costMap={costMaps[network.id] ?? {}}
        />
      ))}
    </div>
  )
}

function BundleCard({ network, isOpen, onToggle, priceMap, costMap = {} }) {
  const [phone, setPhone]   = useState('')
  const [bundle, setBundle] = useState(null)
  const { addToCart }       = useCart()

  const phoneValid = /^0[235]\d{8}$/.test(phone.trim())

  // While loading (undefined): show all with hardcoded prices.
  // Once loaded: only show bundles the API actually offers at real prices.
  const options = priceMap === undefined
    ? BUNDLE_OPTIONS
    : BUNDLE_OPTIONS
        .filter(opt => priceMap[opt.value] != null)
        .map(opt => ({ ...opt, price: priceMap[opt.value] }))

  const handleAdd = () => {
    const opt = options.find(o => o.value === bundle)
    if (!opt) return
    addToCart({
      networkId:   network.id,
      networkName: network.fullName,
      networkLogo: network.logo,
      bundleValue: bundle,
      bundleLabel: opt.label,
      price:       opt.price,
      costPrice:   costMap[bundle] ?? 0,
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
              className={`${styles.input} ${phone.length > 0 && !phoneValid ? styles.inputError : ''}`}
              placeholder="eg. 024XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              maxLength={10}
              autoFocus
            />
            {phone.length > 0 && !phoneValid && (
              <span className={styles.inputHint}>Enter a valid 10-digit Ghana number (05X, 02X, 03X)</span>
            )}
          </div>

          <BundleSelect value={bundle} onChange={setBundle} options={options} />

          <button
            className={styles.addBtn}
            disabled={!phoneValid || !bundle}
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
