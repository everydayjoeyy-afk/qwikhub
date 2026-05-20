import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingBag, People, Wallet2, MoneyRecive, TickCircle, CloseCircle } from 'iconsax-react'
import { useAuth } from '../../context/AuthContext'
import { adminGetDashboard, adminGetWithdrawals, adminApproveWithdrawal, adminRejectWithdrawal } from '../lib/adminDb'
import styles from './AdminDashboard.module.css'

// ── Helpers ──────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function todayLabel() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const PERIODS = [
  { key: 'today', label: 'Today'      },
  { key: 'week',  label: 'This week'  },
  { key: 'month', label: 'This month' },
]

// ── Component ────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const [period,    setPeriod]    = useState('today')
  const [stats,     setStats]     = useState(null)
  const [pending,   setPending]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [confirming,setConfirming]= useState(null)   // { id, action }
  const [processing,setProcessing]= useState(new Set())
  const [toast,     setToast]     = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [dashRes, wdRes] = await Promise.all([
      adminGetDashboard(),
      adminGetWithdrawals(),
    ])
    if (dashRes.data?.[0]) setStats(dashRes.data[0])
    if (Array.isArray(wdRes.data)) {
      setPending(wdRes.data.filter(w => w.status === 'pending').slice(0, 3))
    }
    setLoading(false)
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleConfirm(id, action) {
    setProcessing(prev => new Set(prev).add(id))
    setConfirming(null)
    const fn = action === 'approve' ? adminApproveWithdrawal : adminRejectWithdrawal
    const { error } = await fn(id)
    setProcessing(prev => { const s = new Set(prev); s.delete(id); return s })
    if (error) { showToast('Action failed. Please try again.'); return }
    setPending(prev => prev.filter(w => w.id !== id))
    showToast(action === 'approve' ? 'Marked as paid ✓' : 'Rejected & refunded.')
    // Refresh stats
    adminGetDashboard().then(r => { if (r.data?.[0]) setStats(r.data[0]) })
  }

  // ── Derive period values ────────────────────────────────────────
  const orders   = stats ? Number(stats[`orders_${period}`]   ?? 0) : 0
  const revenue  = stats ? Number(stats[`revenue_${period}`]  ?? 0) : 0
  const newUsers = stats ? Number(stats[`new_users_${period}`]?? 0) : 0

  const firstName = profile?.name?.split(' ')[0] ?? 'Admin'

  return (
    <div className={styles.page}>

      {/* ── Welcome bar ── */}
      <div className={styles.welcomeBar}>
        <div>
          <h1 className={styles.welcomeTitle}>{greeting()}, {firstName} 👋</h1>
          <p className={styles.welcomeDate}>{todayLabel()}</p>
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* ── Period selector ── */}
      <div className={styles.periodRow}>
        {PERIODS.map(p => (
          <button
            key={p.key}
            className={`${styles.periodBtn} ${period === p.key ? styles.periodBtnActive : ''}`}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Primary KPIs ── */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap} data-color="yellow">
            <ShoppingBag size={18} color="#000" variant="Bold" />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Orders</span>
            <span className={styles.kpiValue}>
              {loading ? <span className={styles.kpiSkeleton} /> : orders}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap} data-color="green">
            <Wallet2 size={18} color="#fff" variant="Bold" />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Revenue</span>
            <span className={styles.kpiValue}>
              {loading ? <span className={styles.kpiSkeleton} /> : `₵${revenue.toFixed(2)}`}
            </span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrap} data-color="blue">
            <People size={18} color="#fff" variant="Bold" />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>New users</span>
            <span className={styles.kpiValue}>
              {loading ? <span className={styles.kpiSkeleton} /> : newUsers}
            </span>
          </div>
        </div>

        <div
          className={`${styles.kpiCard} ${!loading && Number(stats?.pending_count) > 0 ? styles.kpiCardUrgent : ''}`}
          onClick={() => navigate('/admin/withdrawals')}
          style={{ cursor: 'pointer' }}
        >
          <div className={styles.kpiIconWrap} data-color="amber">
            <MoneyRecive size={18} color="#fff" variant="Bold" />
          </div>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Pending payouts</span>
            <span className={styles.kpiValue}>
              {loading
                ? <span className={styles.kpiSkeleton} />
                : `${stats?.pending_count ?? 0} · ₵${Number(stats?.pending_amount ?? 0).toFixed(2)}`
              }
            </span>
          </div>
        </div>
      </div>

      {/* ── Platform health ── */}
      <div className={styles.healthRow}>
        <div className={styles.healthCard}>
          <span className={styles.healthLabel}>Total users</span>
          <span className={styles.healthValue}>
            {loading ? '—' : Number(stats?.users_total ?? 0).toLocaleString()}
          </span>
        </div>
        <div className={styles.healthDivider} />
        <div className={styles.healthCard}>
          <span className={styles.healthLabel}>Wallet holdings</span>
          <span className={styles.healthValue}>
            {loading ? '—' : `₵${Number(stats?.total_wallet ?? 0).toFixed(2)}`}
          </span>
        </div>
        <div className={styles.healthDivider} />
        <div className={styles.healthCard}>
          <span className={styles.healthLabel}>Earnings owed</span>
          <span className={styles.healthValue}>
            {loading ? '—' : `₵${Number(stats?.total_earnings ?? 0).toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* ── Pending withdrawals mini-queue ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            Pending withdrawals
            {pending.length > 0 && (
              <span className={styles.urgentDot} />
            )}
          </span>
          <button className={styles.sectionLink} onClick={() => navigate('/admin/withdrawals')}>
            View all →
          </button>
        </div>

        {loading ? (
          <div className={styles.miniLoading}><span className={styles.spin} /></div>
        ) : pending.length === 0 ? (
          <div className={styles.miniEmpty}>
            <TickCircle size={20} color="#22c55e" variant="Bold" />
            <span>All caught up — no pending withdrawals</span>
          </div>
        ) : (
          <div className={styles.miniList}>
            {pending.map(w => {
              const isProcessing = processing.has(w.id)
              const isConfirming = confirming?.id === w.id
              return (
                <div key={w.id} className={styles.miniRow}>
                  <div className={styles.miniAvatar}>
                    {(w.user_name ?? w.user_phone ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.miniInfo}>
                    <span className={styles.miniName}>{w.user_name ?? '—'}</span>
                    <span className={styles.miniMomo}>{w.momo_number}</span>
                  </div>
                  <span className={styles.miniAmount}>₵{Number(w.amount).toFixed(2)}</span>
                  <span className={styles.miniTime}>{timeAgo(w.created_at)}</span>
                  <div className={styles.miniActions}>
                    {isProcessing ? (
                      <span className={styles.miniProcessing}>Processing…</span>
                    ) : isConfirming ? (
                      <>
                        <button
                          className={`${styles.miniBtn} ${confirming.action === 'approve' ? styles.miniBtnApprove : styles.miniBtnReject}`}
                          onClick={() => handleConfirm(w.id, confirming.action)}
                        >Yes</button>
                        <button
                          className={`${styles.miniBtn} ${styles.miniBtnCancel}`}
                          onClick={() => setConfirming(null)}
                        >No</button>
                      </>
                    ) : (
                      <>
                        <button
                          className={`${styles.miniBtn} ${styles.miniBtnApprove}`}
                          onClick={() => setConfirming({ id: w.id, action: 'approve' })}
                          title="Approve"
                        >
                          <TickCircle size={14} color="currentColor" variant="Bold" />
                        </button>
                        <button
                          className={`${styles.miniBtn} ${styles.miniBtnReject}`}
                          onClick={() => setConfirming({ id: w.id, action: 'reject' })}
                          title="Reject"
                        >
                          <CloseCircle size={14} color="currentColor" variant="Bold" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
