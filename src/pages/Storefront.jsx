import { useState, useEffect, useRef } from 'react'

function isValidGhanaPhone(raw) {
  const digits = raw.replace(/[\s\-]/g, '')
  return /^0(2[0-9]|5[0-9])\d{7}$/.test(digits)
}
import { useParams } from 'react-router-dom'
import { ShoppingCart, Trash, ArrowDown2, TickCircle } from 'iconsax-react'
import { THEMES } from '../components/CreateStoreModal/CreateStoreModal'
import { BUNDLE_OPTIONS } from '../components/BundleSelect/BundleSelect'
import { getStoreBySlug, getStoreBundles, getBundles, createOrder, creditEarnings } from '../lib/db'
import { deliverStorefrontBundle } from '../lib/cheapBundles'
import { openPaystackPopup } from '../lib/paystack'
import mtnLogo     from '../assets/mtn.jpg'
import telecelLogo from '../assets/telecel.jpg'
import tigoLogo    from '../assets/tigo.jpg'
import styles from './Storefront.module.css'

const NETWORKS = [
  { id: 'mtn',        name: 'MTN',        logo: mtnLogo      },
  { id: 'telecel',    name: 'Telecel',     logo: telecelLogo  },
  { id: 'airteltigo', name: 'AirtelTigo',  logo: tigoLogo     },
]

// DB carrier → NETWORKS id
const CARRIER_TO_NETWORK = { MTN: 'mtn', Telecel: 'telecel', AirtelTigo: 'airteltigo' }

const makeDefaultNetworkPrices = () =>
  Object.fromEntries(BUNDLE_OPTIONS.map(o => [o.value, (o.price * 1.15).toFixed(2)]))

const DEFAULT_ALL_PRICES = {
  mtn:        makeDefaultNetworkPrices(),
  telecel:    makeDefaultNetworkPrices(),
  airteltigo: makeDefaultNetworkPrices(),
}

function BundleDropdown({ value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find(o => o.value === value)

  return (
    <div className={styles.selectWrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.selectTrigger} ${open ? styles.selectOpen : ''}`}
        onClick={() => setOpen(p => !p)}
      >
        <span className={selected ? styles.selectValue : styles.selectPlaceholder}>
          {selected ? `${selected.label} — ₵${parseFloat(selected.price).toFixed(2)}` : 'Choose a bundle'}
        </span>
        <ArrowDown2
          size={16}
          color="currentColor"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
        />
      </button>
      {open && (
        <ul className={styles.selectDropdown}>
          {options.map(opt => (
            <li
              key={opt.value}
              className={`${styles.selectOption} ${opt.value === value ? styles.selectOptionActive : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false) }}
            >
              {opt.label} — ₵{parseFloat(opt.price).toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Storefront() {
  const { slug } = useParams()

  const [store, setStore]               = useState(null)
  const [prices, setPrices]             = useState(null)
  // bundleIdMap: { networkId: { bundleValue: bundleUUID } }
  const [bundleIdMap, setBundleIdMap]   = useState({})
  // platformPriceMap: { networkId: { bundleValue: basePrice } }
  const [platPriceMap, setPlatPriceMap] = useState({})
  const [activeNetwork, setActiveNetwork] = useState('mtn')
  const [phone, setPhone]               = useState('')
  const [bundle, setBundle]             = useState('')
  const [cart, setCart]                 = useState([])
  const [paying, setPaying]             = useState(false)
  const [paid, setPaid]                 = useState(false)
  const [payError, setPayError]         = useState('')
  const [loadingStore, setLoadingStore] = useState(true)

  // ── Load store + prices from Supabase ───────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: storeData, error } = await getStoreBySlug(slug)

      if (cancelled) return

      if (error || !storeData) {
        // Fallback: try localStorage (owner previewing their own store)
        try {
          const local  = JSON.parse(localStorage.getItem('qwikhub_store') ?? 'null')
          const pLocal = JSON.parse(localStorage.getItem('qwikhub_prices') ?? 'null')
          if (local?.slug === slug) {
            setStore({ ...local, name: local.name, store_name: local.name, store_slug: local.slug, id: null, user_id: null })
            setPrices(pLocal ?? DEFAULT_ALL_PRICES)
          } else {
            setStore({ name: `${slug}'s Store`, store_name: `${slug}'s Store`, store_slug: slug, theme: 'midnight', id: null, user_id: null })
            setPrices(DEFAULT_ALL_PRICES)
          }
        } catch {
          setStore({ name: `${slug}'s Store`, store_name: `${slug}'s Store`, store_slug: slug, theme: 'midnight', id: null, user_id: null })
          setPrices(DEFAULT_ALL_PRICES)
        }
        setLoadingStore(false)
        return
      }

      // Build prices + maps from store_bundles + master bundles (for IDs)
      const [{ data: storeBundles }, { data: masterBundles }] = await Promise.all([
        getStoreBundles(storeData.id),
        getBundles(),
      ])

      const p   = { mtn: {}, telecel: {}, airteltigo: {} }
      const bId = { mtn: {}, telecel: {}, airteltigo: {} }
      const pp  = { mtn: {}, telecel: {}, airteltigo: {} }

      // Seed price, bundleId, and platformPrice from active master bundles only.
      // Only bundles active in DB (available via API) get an entry — others are hidden.
      if (masterBundles) {
        for (const mb of masterBundles) {
          const networkId   = CARRIER_TO_NETWORK[mb.carrier]
          const bundleValue = mb.data_size?.toLowerCase()
          if (networkId && bundleValue) {
            bId[networkId][bundleValue] = mb.id
            pp[networkId][bundleValue]  = mb.platform_price ?? 0
            p[networkId][bundleValue]   = Number(mb.platform_price ?? 0).toFixed(2)
          }
        }
      }

      // Then, override prices with any custom store_bundle prices
      if (storeBundles) {
        for (const sb of storeBundles) {
          const networkId   = CARRIER_TO_NETWORK[sb.bundle?.carrier]
          const bundleValue = sb.bundle?.data_size?.toLowerCase()
          if (networkId && bundleValue) {
            p[networkId][bundleValue] = Number(sb.custom_price).toFixed(2)
            // bId and pp already set from master bundles above
          }
        }
      }

      if (!cancelled) {
        setStore({ ...storeData, name: storeData.store_name, slug: storeData.store_slug })
        setPrices(p)
        setBundleIdMap(bId)
        setPlatPriceMap(pp)
        setLoadingStore(false)
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  useEffect(() => { setBundle('') }, [activeNetwork])

  if (loadingStore || !store || !prices) return null

  const theme         = THEMES.find(t => t.id === store.theme) ?? THEMES[0]
  const network       = NETWORKS.find(n => n.id === activeNetwork)
  const networkPrices = prices[activeNetwork] ?? {}

  const bundleOptions = BUNDLE_OPTIONS.filter(o => networkPrices[o.value] != null).map(o => ({
    value: o.value,
    label: o.label,
    price: networkPrices[o.value],
  }))

  const canAdd = isValidGhanaPhone(phone) && bundle !== ''

  const handleAdd = () => {
    if (!canAdd) return
    const opt          = BUNDLE_OPTIONS.find(o => o.value === bundle)
    const customPrice  = parseFloat(networkPrices[bundle])
    const platformPrice = platPriceMap[activeNetwork]?.[bundle] ?? opt?.price ?? customPrice
    setCart(c => [...c, {
      id:            Date.now(),
      networkId:     network.id,
      networkName:   network.name,
      networkLogo:   network.logo,
      bundleValue:   bundle,
      bundleLabel:   opt?.label ?? bundle,
      bundleId:      bundleIdMap[activeNetwork]?.[bundle] ?? null,
      price:         customPrice,
      platformPrice,
      phone:         phone.trim(),
    }])
    setPhone('')
    setBundle('')
  }

  const handleRemove = (id) => setCart(c => c.filter(item => item.id !== id))

  const total = cart.reduce((s, i) => s + i.price, 0)

  const handlePay = async () => {
    if (cart.length === 0 || paying) return
    setPaying(true)
    setPayError('')

    let reference = null

    try {
      const result = await openPaystackPopup({
        email:       null,
        amount:      total,
        phone:       cart[0].phone,
        bundleLabel: cart.map(i => `${i.networkName} ${i.bundleLabel}`).join(', '),
      })
      reference = result.reference
    } catch (err) {
      // Payment cancelled or popup failed — nothing was charged
      if (err?.message !== 'Payment cancelled') {
        setPayError('Payment failed. Please try again.')
      }
      setPaying(false)
      return
    }

    // Payment confirmed — record orders
    // Errors here are logged but don't block the success screen
    // (customer has paid; store owner reconciles via Paystack dashboard)
    if (store.id) {
      for (const item of cart) {
        // Deduct 2% Paystack processing fee from the store owner's profit so
        // QwikHub isn't left absorbing it. The fee is proportional to the sale price.
        const paystackFee = item.price * 0.02
        const profit = Math.max(0, item.price - item.platformPrice - paystackFee)
        const { error: orderErr } = await createOrder({
          buyerPhone:  item.phone,
          bundleId:    item.bundleId,
          storeId:     store.id,
          amountPaid:  item.price,
          profit,
          paystackRef: reference,
        })
        if (orderErr) {
          console.error('[Storefront] createOrder failed:', orderErr.message)
        }

        // Deliver bundle via Edge Function — fire-and-forget after order is recorded.
        // On failure the order row is marked pending_verification; admin reviews before refunding.
        if (!orderErr && item.bundleId) {
          deliverStorefrontBundle({
            paystackRef: reference,
            buyerPhone:  item.phone,
            bundleId:    item.bundleId,
            networkId:   item.networkId,
            bundleValue: item.bundleValue,
          }).catch(err => console.error('[Storefront] delivery error:', err))
        }
      }
    }

    // Credit seller earnings balance with total profit (withdrawable, separate from deposits)
    // Profit is after deducting the 2% Paystack fee proportional to each item's sale price.
    const totalProfit = cart.reduce(
      (s, item) => s + Math.max(0, item.price - item.platformPrice - item.price * 0.02), 0
    )
    if (totalProfit > 0 && store.user_id) {
      const { error: earningsErr } = await creditEarnings(
        store.user_id,
        totalProfit,
        `Sale from store (${cart.length} item${cart.length > 1 ? 's' : ''})`,
        reference,
      )
      if (earningsErr) {
        console.error('[Storefront] creditEarnings failed — profit not credited:', earningsErr)
      }
    }

    setPaid(true)
    setCart([])
    setPaying(false)
  }

  const accentText = theme.accent === '#FFCC08' ? '#000' : '#fff'

  return (
    <div className={styles.page}>
      {/* Store header */}
      <div className={styles.storeHeader} style={{ background: theme.primary }}>
        <span className={styles.poweredText}>Powered by QwikHub</span>
        <h1 className={styles.storeName}>{store.name}</h1>
      </div>

      <div className={styles.content}>
        {/* Network tabs */}
        <div className={styles.networkTabs}>
          {NETWORKS.map(n => (
            <button
              key={n.id}
              className={`${styles.networkTab} ${activeNetwork === n.id ? styles.networkTabActive : ''}`}
              style={activeNetwork === n.id ? { borderColor: theme.accent } : {}}
              onClick={() => setActiveNetwork(n.id)}
            >
              <img src={n.logo} alt={n.name} className={styles.networkTabLogo} />
              <span style={activeNetwork === n.id ? { color: theme.accent === '#FFCC08' ? '#000' : theme.accent, fontWeight: 700 } : {}}>
                {n.name}
              </span>
            </button>
          ))}
        </div>

        {/* Form card */}
        <div className={styles.formCard}>
          <div className={styles.formCardHeader}>
            <img src={network.logo} alt={network.name} className={styles.formNetworkLogo} />
            <span className={styles.formNetworkName}>{network.name} Bundles</span>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Phone Number</label>
            <input
              type="tel"
              className={styles.input}
              placeholder="eg. 024XXXXXXXX"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              maxLength={15}
            />
          </div>

          <BundleDropdown value={bundle} onChange={setBundle} options={bundleOptions} />

          <button
            className={styles.addBtn}
            style={{ background: canAdd ? theme.accent : undefined, color: canAdd ? accentText : undefined }}
            disabled={!canAdd}
            onClick={handleAdd}
          >
            <ShoppingCart size={18} color="currentColor" variant="Bold" />
            Add to Cart
          </button>
        </div>

        {/* Order summary */}
        {cart.length > 0 && (
          <div className={styles.summarySection}>
            <span className={styles.summaryTitle}>Order Summary</span>
            <div className={styles.summaryCard}>
              {cart.map((item, i) => (
                <div key={item.id}>
                  <div className={styles.cartRow}>
                    <img src={item.networkLogo} alt={item.networkName} className={styles.cartLogo} />
                    <div className={styles.cartInfo}>
                      <span className={styles.cartNetworkName}>{item.networkName} Bundles</span>
                      <span className={styles.cartBundle}>{item.bundleLabel}</span>
                      <span className={styles.cartPhone}>{item.phone}</span>
                    </div>
                    <span className={styles.cartPrice}>₵{item.price.toFixed(2)}</span>
                    <button className={styles.removeBtn} onClick={() => handleRemove(item.id)} aria-label="Remove">
                      <Trash size={16} color="currentColor" variant="Bold" />
                    </button>
                  </div>
                  {i < cart.length - 1 && <div className={styles.divider} />}
                </div>
              ))}
            </div>

            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalValue}>₵{total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {payError && (
          <p style={{ color: '#ef4444', textAlign: 'center', fontSize: 14, padding: '0 20px' }}>{payError}</p>
        )}

        {paid && (
          <div className={styles.successBanner}>
            <TickCircle size={32} color="#22c55e" variant="Bold" />
            <span className={styles.successText}>Payment successful! Your bundles are being processed.</span>
          </div>
        )}
      </div>

      {/* Sticky pay button */}
      {cart.length > 0 && (
        <div className={styles.stickyFooter}>
          <button
            className={styles.payBtn}
            style={{ background: theme.accent, color: accentText }}
            onClick={handlePay}
            disabled={paying}
          >
            {paying ? 'Processing…' : `Pay ₵${total.toFixed(2)}`}
          </button>
        </div>
      )}
    </div>
  )
}
