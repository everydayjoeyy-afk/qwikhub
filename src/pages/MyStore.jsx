import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight2, ArrowDown2, Share, MoneyRecive } from 'iconsax-react'
import { BUNDLE_OPTIONS } from '../components/BundleSelect/BundleSelect'
import { THEMES } from '../components/CreateStoreModal/CreateStoreModal'
import { useAuth } from '../context/AuthContext'
import { getMyStore, updateStore, getStoreBundles, upsertStoreBundle, getStoreOrders, getBundles } from '../lib/db'
import mtnLogo      from '../assets/mtn.jpg'
import telecelLogo  from '../assets/telecel.jpg'
import tigoLogo     from '../assets/tigo.jpg'
import styles from './MyStore.module.css'

const NETWORKS = [
  { id: 'mtn',        name: 'MTN Bundles',       logo: mtnLogo      },
  { id: 'telecel',    name: 'Telecel Bundles',    logo: telecelLogo  },
  { id: 'airteltigo', name: 'AirtelTigo Bundles', logo: tigoLogo     },
]

// Maps NETWORKS id → Supabase carrier string
const CARRIER_MAP = { mtn: 'MTN', telecel: 'Telecel', airteltigo: 'AirtelTigo' }

// BUNDLE_OPTIONS value ('1gb') → DB data_size ('1GB')
const toDataSize = (v) => v.toUpperCase()

const makeDefaultNetworkPrices = () =>
  Object.fromEntries(BUNDLE_OPTIONS.map(o => [o.value, (o.price * 1.15).toFixed(2)]))

const makeDefaultPrices = () => ({
  mtn:        makeDefaultNetworkPrices(),
  telecel:    makeDefaultNetworkPrices(),
  airteltigo: makeDefaultNetworkPrices(),
})

function buildBundleMap(masterBundles = []) {
  const map = {}
  for (const b of masterBundles) {
    if (!map[b.carrier]) map[b.carrier] = {}
    map[b.carrier][b.data_size] = { id: b.id, platform_price: b.platform_price }
  }
  return map
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs} hr${hrs > 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

export default function MyStore() {
  const navigate     = useNavigate()
  const { user }     = useAuth()
  const saveTimer    = useRef(null)
  const initialised  = useRef(false)

  const [tab, setTab]               = useState('orders')
  const [storeId, setStoreId]       = useState(null)
  const [storeName, setStoreName]   = useState('')
  const [storeSlug, setStoreSlug]   = useState('')
  const [storeTheme, setStoreTheme] = useState('midnight')
  const [prices, setPrices]         = useState(makeDefaultPrices())
  const [savedPrices, setSavedPrices] = useState(makeDefaultPrices())
  const [bundleMap, setBundleMap]   = useState({})
  const [orders, setOrders]         = useState([])
  const [openNetwork, setOpenNetwork] = useState(null)
  const [loadingStore, setLoadingStore] = useState(true)
  const [savingPrices, setSavingPrices] = useState(null) // networkId currently saving
  const [linkCopied, setLinkCopied] = useState(false)

  // ── Load everything from Supabase on mount ──────────────────
  useEffect(() => {
    if (!user) return

    // Safety: never stay on "Loading store…" forever on slow networks
    const timer = setTimeout(() => setLoadingStore(false), 10000)

    ;(async () => {
      try {
        // 1. Fetch existing store — if none exists, send back to /store
        const { data: store } = await getMyStore(user.id)
        if (!store) { navigate('/store', { replace: true }); return }

        // 2. Build bundleMap from master bundles
        const { data: masterBundles } = await getBundles()
        const bMap = buildBundleMap(masterBundles ?? [])

        // 3. Build prices from store_bundles (with bundle join)
        const { data: storeBundles } = await getStoreBundles(store.id)
        const p = makeDefaultPrices()
        if (storeBundles) {
          for (const sb of storeBundles) {
            const carrier     = sb.bundle?.carrier
            const dataSize    = sb.bundle?.data_size
            const networkId   = Object.keys(CARRIER_MAP).find(k => CARRIER_MAP[k] === carrier)
            const bundleValue = dataSize?.toLowerCase()
            if (networkId && bundleValue && p[networkId]) {
              p[networkId][bundleValue] = Number(sb.custom_price).toFixed(2)
            }
          }
        }

        // 4. Load orders
        const { data: storeOrders } = await getStoreOrders(store.id)

        // 5. Hydrate state
        setStoreId(store.id)
        setStoreName(store.store_name)
        setStoreSlug(store.store_slug)
        setStoreTheme(store.theme)
        setBundleMap(bMap)
        setPrices(p)
        setSavedPrices(JSON.parse(JSON.stringify(p)))
        setOrders(storeOrders ?? [])

        // Mirror to localStorage for storefront reads
        localStorage.setItem('qwikhub_store', JSON.stringify({
          name: store.store_name,
          slug: store.store_slug,
          theme: store.theme,
        }))

        initialised.current = true
      } catch (err) {
        console.error('[MyStore] load error:', err)
      } finally {
        clearTimeout(timer)
        setLoadingStore(false)
      }
    })()

    return () => clearTimeout(timer)
  }, [user])

  // ── Auto-save settings (localStorage immediately, Supabase debounced) ──
  useEffect(() => {
    if (!initialised.current || !storeName) return
    localStorage.setItem('qwikhub_store', JSON.stringify({ name: storeName, slug: storeSlug, theme: storeTheme }))
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!storeId) return
      await updateStore(storeId, { store_name: storeName, store_slug: storeSlug, theme: storeTheme })
    }, 1500)
  }, [storeName, storeSlug, storeTheme, user])

  // ── Derived stats ────────────────────────────────────────────
  const today        = new Date().toDateString()
  const ordersToday  = orders.filter(o => new Date(o.created_at).toDateString() === today)
  const profitToday  = ordersToday.reduce((s, o) => s + (o.profit ?? 0), 0)
  const totalProfit  = orders.reduce((s, o) => s + (o.profit ?? 0), 0)
  const totalOrders  = orders.length
  const recentOrders = orders.slice(0, 6)

  const selectedTheme = THEMES.find(t => t.id === storeTheme) ?? THEMES[0]
  const storeLink     = `qwikhub.com/store/${storeSlug}`

  // ── Price helpers ────────────────────────────────────────────
  const handlePriceChange = (networkId, bundleValue, newPrice) => {
    setPrices(p => ({ ...p, [networkId]: { ...p[networkId], [bundleValue]: newPrice } }))
  }

  const handleSavePrices = async (networkId) => {
    if (!storeId || savingPrices) return
    setSavingPrices(networkId)

    const carrier = CARRIER_MAP[networkId]
    const cMap    = bundleMap[carrier] ?? {}

    await Promise.all(
      Object.entries(prices[networkId]).map(([bundleValue, customPrice]) => {
        const dataSize   = toDataSize(bundleValue)
        const bundleInfo = cMap[dataSize]
        if (!bundleInfo) return Promise.resolve()
        return upsertStoreBundle(storeId, bundleInfo.id, parseFloat(customPrice))
      })
    )

    const updated = { ...savedPrices, [networkId]: { ...prices[networkId] } }
    setSavedPrices(updated)
    localStorage.setItem('qwikhub_prices', JSON.stringify(updated))
    setSavingPrices(null)
  }

  const isNetworkDirty = (networkId) =>
    JSON.stringify(prices[networkId]) !== JSON.stringify(savedPrices[networkId])

  const toggleNetwork = (id) => setOpenNetwork(prev => prev === id ? null : id)

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(`https://${storeLink}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  if (loadingStore) {
    return (
      <div className={styles.page}>
        <div className={styles.topHeader}>
          <button className={styles.backBtn} onClick={() => navigate('/store')} aria-label="Go back">
            <ArrowLeft size={20} color="currentColor" />
          </button>
          <span className={styles.pageTitle}>My Store</span>
          <div style={{ width: 32 }} />
        </div>
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          Loading store…
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.topHeader}>
        <button className={styles.backBtn} onClick={() => navigate('/store')} aria-label="Go back">
          <ArrowLeft size={20} color="currentColor" />
        </button>
        <span className={styles.pageTitle}>My Store</span>
        <div style={{ width: 32 }} />
      </div>

      {/* Store card */}
      <div className={styles.storeCard}>
        <div className={styles.storeCardTop}>
          <span className={styles.storeLinkLabel}>Your store link</span>
          <span className={styles.storeNameText}>{storeName}</span>
          <button className={styles.storeLinkBtn} onClick={handleCopyLink}>
            {storeLink}
          </button>
        </div>
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <span className={styles.statValue}>{ordersToday.length}</span>
            <span className={styles.statLabel}>Orders today</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statValue}>₵{profitToday.toFixed(2)}</span>
            <span className={styles.statLabel}>Profit today</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statValue}>₵{totalProfit.toFixed(2)}</span>
            <span className={styles.statLabel}>Total profit</span>
          </div>
        </div>
        <button className={styles.withdrawBtn} onClick={() => navigate('/withdrawals')}>
          <MoneyRecive size={16} color="currentColor" variant="Bold" />
          Withdraw profit
        </button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {[
          { id: 'prices',   label: 'Bundle prices'         },
          { id: 'settings', label: 'Store settings'        },
          { id: 'orders',   label: `Orders (${totalOrders})` },
        ].map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Orders tab ─────────────────────────────────── */}
      {tab === 'orders' && (
        <div className={styles.tabContent}>
          <div className={styles.ordersHeader}>
            <span className={styles.sectionTitle}>Recent orders</span>
            <span className={styles.dateChip}>All time</span>
          </div>
          <div className={styles.ordersList}>
            {recentOrders.length === 0 ? (
              <span className={styles.emptyText}>No orders yet</span>
            ) : recentOrders.map((order, i) => (
              <div key={order.id}>
                <div className={styles.orderRow}>
                  <div className={styles.orderInfo}>
                    <span className={styles.orderTitle}>
                      {order.bundle?.carrier ?? 'Unknown'} {order.bundle?.data_size ?? ''} · {order.buyer_phone}
                    </span>
                    <span className={styles.orderMeta}>{timeAgo(order.created_at)} · Paid via Paystack</span>
                  </div>
                  <span className={styles.orderProfit}>+₵{Number(order.profit ?? 0).toFixed(2)}</span>
                </div>
                {i < recentOrders.length - 1 && <div className={styles.divider} />}
              </div>
            ))}
          </div>
          {orders.length > 6 && (
            <button className={styles.viewAllBtn} onClick={() => navigate('/my-store/orders')}>
              View all orders
            </button>
          )}
        </div>
      )}

      {/* ── Settings tab ────────────────────────────────── */}
      {tab === 'settings' && (
        <div className={styles.tabContent}>
          <div className={styles.settingsCard}>
            <span className={styles.settingsFieldLabel}>Store name</span>
            <input
              type="text"
              className={styles.settingsInput}
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              maxLength={60}
            />
          </div>

          <div className={styles.settingsCard}>
            <span className={styles.settingsFieldLabel}>Storefront theme</span>
            <div className={styles.themeGrid}>
              {THEMES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.themeChip} ${storeTheme === t.id ? styles.themeChipActive : ''}`}
                  onClick={() => setStoreTheme(t.id)}
                  aria-pressed={storeTheme === t.id}
                >
                  <span
                    className={styles.themeSwatch}
                    style={{ background: t.primary, borderColor: t.accent }}
                  >
                    <span className={styles.themeSwatchAccent} style={{ background: t.accent }} />
                  </span>
                  <span className={styles.themeLabel}>{t.label}</span>
                </button>
              ))}
            </div>
            <div className={styles.themePreview} style={{ background: selectedTheme.primary }}>
              <span className={styles.previewStoreName} style={{ color: '#fff' }}>
                {storeName.trim() || 'Your Store'}
              </span>
              <span
                className={styles.previewBadge}
                style={{ background: selectedTheme.accent, color: selectedTheme.primary }}
              >
                Shop now
              </span>
            </div>
          </div>

          <div className={styles.settingsCard} style={{ padding: '0 16px' }}>
            <SettingRow
              icon={<Share size={16} color="#395362" variant="Bold" />}
              iconBg="#f1f5f9"
              title="Share store link"
              subtitle={storeLink}
              control={<ArrowRight2 size={16} color="var(--color-text-tertiary)" />}
              onClick={handleCopyLink}
            />
          </div>
        </div>
      )}

      {/* ── Prices tab ──────────────────────────────────── */}
      {tab === 'prices' && (
        <div className={styles.tabContent}>
          <p className={styles.pricesHint}>
            Set your selling price per network. Your profit is the difference from the base price.
          </p>
          {NETWORKS.map(network => {
            const isOpen = openNetwork === network.id
            return (
              <div key={network.id} className={styles.networkCard}>
                <button
                  className={styles.networkCardHeader}
                  onClick={() => toggleNetwork(network.id)}
                  aria-expanded={isOpen}
                >
                  <img src={network.logo} alt={network.name} className={styles.networkLogo} />
                  <span className={styles.networkName}>{network.name}</span>
                  <ArrowDown2
                    size={16}
                    color="var(--color-text-tertiary)"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                  />
                </button>

                {isOpen && (
                  <div className={styles.networkPrices}>
                    {BUNDLE_OPTIONS.map((opt, i) => (
                      <div key={opt.value}>
                        <div className={styles.priceRow}>
                          <div className={styles.priceInfo}>
                            <span className={styles.priceLabel}>{opt.label}</span>
                            <span className={styles.priceBase}>Base ₵{opt.price.toFixed(2)}</span>
                          </div>
                          <div className={styles.priceInputWrap}>
                            <span className={styles.pricePrefix}>₵</span>
                            <input
                              type="number"
                              className={styles.priceInput}
                              value={prices[network.id][opt.value]}
                              min={opt.price}
                              step="0.50"
                              onChange={e => handlePriceChange(network.id, opt.value, e.target.value)}
                            />
                          </div>
                        </div>
                        {i < BUNDLE_OPTIONS.length - 1 && <div className={styles.divider} />}
                      </div>
                    ))}
                    {isNetworkDirty(network.id) && (
                      <button
                        className={styles.savePricesBtn}
                        onClick={() => handleSavePrices(network.id)}
                        disabled={savingPrices === network.id}
                      >
                        {savingPrices === network.id ? 'Saving…' : 'Save changes'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {linkCopied && <div className={styles.toast}>Link copied!</div>}
    </div>
  )
}

function SettingRow({ icon, iconBg, title, subtitle, control, onClick }) {
  return (
    <button className={styles.settingRow} onClick={onClick} disabled={!onClick}>
      <span className={styles.settingIcon} style={{ background: iconBg }}>
        {icon}
      </span>
      <div className={styles.settingText}>
        <span className={styles.settingTitle}>{title}</span>
        <span className={styles.settingSubtitle}>{subtitle}</span>
      </div>
      <div className={styles.settingControl}>{control}</div>
    </button>
  )
}
