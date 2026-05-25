import { useState, useEffect, useMemo } from 'react'
import { Shop, Edit2, CloseCircle } from 'iconsax-react'
import { adminGetBundles, adminGetStoreOverview, adminUpdateBundle } from '../lib/adminDb'
import { getAvailablePackages } from '../../lib/cheapBundles'
import styles from './AdminStoreOverview.module.css'

const CARRIERS = ['All', 'MTN', 'Telecel', 'AirtelTigo']

export default function AdminStoreOverview() {
  const [bundles,   setBundles]   = useState([])
  const [stats,     setStats]     = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [carrier,   setCarrier]   = useState('All')
  const [editingId, setEditingId] = useState(null)
  const [editPrice, setEditPrice] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState('')
  const [syncing,   setSyncing]   = useState(false)
  const [packages,  setPackages]  = useState(null)
  const [syncError, setSyncError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError(''); setSaveError('')
    try {
      const [bundlesRes, statsRes] = await Promise.all([
        adminGetBundles(),
        adminGetStoreOverview(),
      ])
      if (bundlesRes.error) { setError(bundlesRes.error.message); return }
      setBundles(Array.isArray(bundlesRes.data) ? bundlesRes.data : [])
      if (!statsRes.error && statsRes.data) {
        setStats(Array.isArray(statsRes.data) ? (statsRes.data[0] ?? null) : statsRes.data)
      }
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() =>
    carrier === 'All' ? bundles : bundles.filter(b => b.carrier === carrier),
    [bundles, carrier]
  )

  // ── Toggle active/inactive (optimistic) ─────────────────────
  async function handleToggleActive(bundle) {
    const newVal = !bundle.is_active
    setBundles(bs => bs.map(b => b.id === bundle.id ? { ...b, is_active: newVal } : b))
    const { error: err } = await adminUpdateBundle(bundle.id, { is_active: newVal })
    if (err) {
      setBundles(bs => bs.map(b => b.id === bundle.id ? { ...b, is_active: bundle.is_active } : b))
      setSaveError(err.message)
    }
  }

  // ── Inline price editing ─────────────────────────────────────
  function startEdit(bundle) {
    setEditingId(bundle.id)
    setEditPrice(String(bundle.platform_price))
    setSaveError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditPrice('')
    setSaveError('')
  }

  async function savePrice(bundle) {
    const price = parseFloat(editPrice)
    if (isNaN(price) || price <= 0) { setSaveError('Enter a valid price'); return }
    setSaving(true); setSaveError('')
    const { error: err } = await adminUpdateBundle(bundle.id, { platform_price: price })
    setSaving(false)
    if (err) { setSaveError(err.message); return }
    setBundles(bs => bs.map(b => b.id === bundle.id ? { ...b, platform_price: price } : b))
    setEditingId(null)
  }

  function handleEditKeyDown(e, bundle) {
    if (e.key === 'Enter') savePrice(bundle)
    if (e.key === 'Escape') cancelEdit()
  }

  async function handleSyncPackages() {
    setSyncing(true); setSyncError(''); setPackages(null)
    const result = await getAvailablePackages()
    setSyncing(false)
    if (!result.success) { setSyncError(result.error ?? 'Failed to fetch packages'); return }
    // Group by network_id so we can see unique IDs easily
    const grouped = {}
    for (const pkg of (result.packages ?? [])) {
      const nid = pkg.network_id
      if (!grouped[nid]) grouped[nid] = []
      grouped[nid].push(pkg)
    }
    // Capture one sample package per group to show all raw fields
    const samples = {}
    for (const pkg of (result.packages ?? [])) {
      if (!samples[pkg.network_id]) samples[pkg.network_id] = pkg
    }
    setPackages({ grouped, samples })
  }

  const activeBundles   = bundles.filter(b => b.is_active).length
  const inactiveBundles = bundles.length - activeBundles

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Store Overview</h1>
          <p className={styles.pageSubtitle}>Manage the master bundle catalogue and monitor storefront activity</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.refreshBtn} onClick={handleSyncPackages} disabled={syncing}>
            {syncing ? 'Fetching…' : 'Sync Packages'}
          </button>
          <button className={styles.refreshBtn} onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Sync Packages panel */}
      {syncError && (
        <div className={styles.saveErrorBanner} style={{ marginBottom: 16 }}>{syncError}</div>
      )}
      {packages && (
        <div className={styles.packagesPanel}>
          <div className={styles.packagesPanelHeader}>
            <span className={styles.packagesPanelTitle}>
              Cheap Bundles API — Network IDs
            </span>
            <button className={styles.packagesPanelClose} onClick={() => setPackages(null)}>
              <CloseCircle size={18} color="currentColor" />
            </button>
          </div>
          <p className={styles.packagesPanelHint}>
            Update <code>NETWORK_IDS</code> in <code>supabase/functions/buy-bundle/index.ts</code> with these values, then run <code>npx supabase@latest functions deploy buy-bundle</code>.
          </p>
          <div className={styles.packagesPanelGrid}>
            {Object.entries(packages.grouped).map(([networkId, pkgs]) => {
              const sample = packages.samples[networkId] ?? {}
              const networkName = sample.network_name ?? sample.carrier ?? sample.name ?? sample.provider ?? null
              return (
                <div key={networkId} className={styles.packageGroup}>
                  <div className={styles.packageGroupHeader}>
                    Network ID: <strong>{networkId}</strong>
                    {networkName && <span className={styles.packageNetworkName}>{networkName}</span>}
                    <span className={styles.packageGroupCount}>{pkgs.length} packages</span>
                  </div>
                  <div className={styles.packageGroupSample}>
                    {pkgs.slice(0, 3).map((p, i) => (
                      <span key={i} className={styles.packageChip}>
                        {p.volume}GB — ₵{p.price}
                      </span>
                    ))}
                    {pkgs.length > 3 && <span className={styles.packageChip}>+{pkgs.length - 3} more</span>}
                  </div>
                  <div className={styles.packageRawFields}>
                    {Object.entries(sample)
                      .filter(([k]) => !['volume','price','network_id'].includes(k))
                      .map(([k, v]) => (
                        <span key={k} className={styles.packageRaw}><em>{k}:</em> {String(v)}</span>
                      ))
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active bundles</span>
          <span className={styles.statValue}>{loading ? '—' : activeBundles}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Inactive bundles</span>
          <span className={styles.statValue}>{loading ? '—' : inactiveBundles}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total stores</span>
          <span className={styles.statValue}>{loading || !stats ? '—' : (stats.total_stores ?? 0)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Store orders today</span>
          <span className={styles.statValue}>{loading || !stats ? '—' : (stats.orders_today ?? 0)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Revenue today</span>
          <span className={`${styles.statValue} ${styles.statGreen}`}>
            {loading || !stats ? '—' : `₵${Number(stats.revenue_today ?? 0).toFixed(2)}`}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>All-time revenue</span>
          <span className={`${styles.statValue} ${styles.statGreen}`}>
            {loading || !stats ? '—' : `₵${Number(stats.total_revenue ?? 0).toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* Section title + carrier tabs */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>Bundle Catalogue</span>
        <div className={styles.tabRow}>
          {CARRIERS.map(c => (
            <button
              key={c}
              className={`${styles.tabBtn} ${carrier === c ? styles.tabBtnActive : ''}`}
              onClick={() => setCarrier(c)}
            >{c}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.centred}><span className={styles.spin} /></div>
      ) : error ? (
        <div className={styles.centred}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.refreshBtn} onClick={load}>Try again</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.centred}>
          <Shop size={36} color="var(--color-text-tertiary)" variant="Bold" />
          <p className={styles.emptyText}>No bundles found</p>
        </div>
      ) : (
        <>
          {saveError && (
            <div className={styles.saveErrorBanner}>{saveError}</div>
          )}

          {/* Desktop table */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Carrier</th>
                  <th>Data size</th>
                  <th>Platform price</th>
                  <th>Stores offering</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} className={!b.is_active ? styles.rowInactive : ''}>
                    <td>
                      <span
                        className={styles.carrierBadge}
                        data-carrier={b.carrier?.toLowerCase()}
                      >
                        {b.carrier}
                      </span>
                    </td>
                    <td className={styles.dataSize}>{b.data_size}</td>
                    <td>
                      {editingId === b.id ? (
                        <div className={styles.priceEditWrap}>
                          <span className={styles.pricePrefix}>₵</span>
                          <input
                            type="number"
                            className={styles.priceInput}
                            value={editPrice}
                            onChange={e => setEditPrice(e.target.value)}
                            onKeyDown={e => handleEditKeyDown(e, b)}
                            min="0"
                            step="0.50"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <span className={styles.priceText}>₵{Number(b.platform_price).toFixed(2)}</span>
                      )}
                    </td>
                    <td className={styles.storeCount}>{b.store_bundle_count ?? 0}</td>
                    <td>
                      <button
                        className={`${styles.statusToggle} ${b.is_active ? styles.statusActive : styles.statusInactive}`}
                        onClick={() => handleToggleActive(b)}
                        title={b.is_active ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {b.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td>
                      {editingId === b.id ? (
                        <div className={styles.actionBtns}>
                          <button
                            className={styles.saveBtn}
                            onClick={() => savePrice(b)}
                            disabled={saving}
                          >
                            {saving ? '…' : 'Save'}
                          </button>
                          <button className={styles.cancelBtn} onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button className={styles.editBtn} onClick={() => startEdit(b)}>
                          <Edit2 size={13} color="currentColor" />
                          Edit price
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className={styles.cards}>
            {filtered.map(b => (
              <div key={b.id} className={`${styles.card} ${!b.is_active ? styles.cardInactive : ''}`}>
                <div className={styles.cardRow}>
                  <span className={styles.carrierBadge} data-carrier={b.carrier?.toLowerCase()}>
                    {b.carrier}
                  </span>
                  <span className={styles.dataSize}>{b.data_size}</span>
                  <button
                    className={`${styles.statusToggle} ${b.is_active ? styles.statusActive : styles.statusInactive}`}
                    onClick={() => handleToggleActive(b)}
                  >
                    {b.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <div className={styles.cardRow} style={{ marginTop: 6 }}>
                  {editingId === b.id ? (
                    <>
                      <div className={styles.priceEditWrap}>
                        <span className={styles.pricePrefix}>₵</span>
                        <input
                          type="number"
                          className={styles.priceInput}
                          value={editPrice}
                          onChange={e => setEditPrice(e.target.value)}
                          onKeyDown={e => handleEditKeyDown(e, b)}
                          min="0"
                          step="0.50"
                          autoFocus
                        />
                      </div>
                      <button className={styles.saveBtn} onClick={() => savePrice(b)} disabled={saving}>
                        {saving ? '…' : 'Save'}
                      </button>
                      <button className={styles.cancelBtn} onClick={cancelEdit}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className={styles.priceText}>₵{Number(b.platform_price).toFixed(2)}</span>
                      <span className={styles.storeCountLabel}>{b.store_bundle_count ?? 0} stores</span>
                      <button className={styles.editBtn} onClick={() => startEdit(b)}>
                        <Edit2 size={13} color="currentColor" />
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
