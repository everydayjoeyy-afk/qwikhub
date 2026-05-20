import { useState, useEffect } from 'react'
import { TickCircle, CloseCircle, Copy, Clock } from 'iconsax-react'
import { adminGetWithdrawals, adminApproveWithdrawal, adminRejectWithdrawal } from '../lib/adminDb'
import styles from './AdminWithdrawals.module.css'

const TABS = [
  { key: 'pending',   label: 'Pending'   },
  { key: 'all',       label: 'All'       },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected',  label: 'Rejected'  },
]

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

function formatFullDate(iso) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }) {
  return (
    <span className={styles.statusBadge} data-status={status}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [activeTab,   setActiveTab]   = useState('pending')
  const [confirming,  setConfirming]  = useState(null)   // { id, action }
  const [processing,  setProcessing]  = useState(new Set())
  const [copiedId,    setCopiedId]    = useState(null)
  const [toast,       setToast]       = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    const { data, error: err } = await adminGetWithdrawals()
    setLoading(false)
    if (err) { setError(err.message); return }
    setWithdrawals(Array.isArray(data) ? data : [])
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleConfirm(id, action) {
    setProcessing(prev => new Set(prev).add(id))
    setConfirming(null)

    const fn = action === 'approve' ? adminApproveWithdrawal : adminRejectWithdrawal
    const { error: err } = await fn(id)

    setProcessing(prev => { const s = new Set(prev); s.delete(id); return s })

    if (err) {
      showToast(`Failed: ${err.message}`)
      return
    }

    const newStatus = action === 'approve' ? 'completed' : 'rejected'
    setWithdrawals(prev =>
      prev.map(w => w.id === id ? { ...w, status: newStatus } : w)
    )
    showToast(action === 'approve'
      ? 'Marked as paid ✓ — send the MoMo now.'
      : 'Withdrawal rejected. Earnings refunded to user.'
    )
  }

  function copyMoMo(number, id) {
    navigator.clipboard?.writeText(number)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── Derived data ──────────────────────────────────────────────
  const filtered = withdrawals.filter(w =>
    activeTab === 'all' ? true : w.status === activeTab
  )

  const pendingItems  = withdrawals.filter(w => w.status === 'pending')
  const pendingCount  = pendingItems.length
  const pendingAmount = pendingItems.reduce((s, w) => s + Number(w.amount), 0)

  const todayStr = new Date().toDateString()
  const doneToday = withdrawals.filter(w =>
    w.status === 'completed' && new Date(w.created_at).toDateString() === todayStr
  ).length

  // ── Row actions ───────────────────────────────────────────────
  function RowActions({ w }) {
    const isProcessing = processing.has(w.id)
    const isConfirming = confirming?.id === w.id

    if (w.status !== 'pending') return null
    if (isProcessing) return <span className={styles.processingText}>Processing…</span>

    if (isConfirming) {
      return (
        <div className={styles.confirmRow}>
          <span className={styles.confirmLabel}>
            {confirming.action === 'approve' ? 'Mark as paid?' : 'Reject & refund?'}
          </span>
          <button
            className={`${styles.actionBtn} ${confirming.action === 'approve' ? styles.btnApprove : styles.btnReject}`}
            onClick={() => handleConfirm(w.id, confirming.action)}
          >
            Yes
          </button>
          <button
            className={`${styles.actionBtn} ${styles.btnCancel}`}
            onClick={() => setConfirming(null)}
          >
            No
          </button>
        </div>
      )
    }

    return (
      <div className={styles.actionsRow}>
        <button
          className={`${styles.actionBtn} ${styles.btnApprove}`}
          onClick={() => setConfirming({ id: w.id, action: 'approve' })}
        >
          <TickCircle size={13} color="currentColor" variant="Bold" />
          Approve
        </button>
        <button
          className={`${styles.actionBtn} ${styles.btnReject}`}
          onClick={() => setConfirming({ id: w.id, action: 'reject' })}
        >
          <CloseCircle size={13} color="currentColor" variant="Bold" />
          Reject
        </button>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Withdrawals</h1>
          <p className={styles.pageSubtitle}>Review and process user payout requests</p>
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pending requests</span>
          <span className={`${styles.statValue} ${pendingCount > 0 ? styles.statValueUrgent : ''}`}>
            {pendingCount}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pending amount</span>
          <span className={styles.statValue}>₵{pendingAmount.toFixed(2)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Processed today</span>
          <span className={styles.statValue}>{doneToday}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map(tab => {
          const count = tab.key === 'all'
            ? withdrawals.length
            : withdrawals.filter(w => w.status === tab.key).length
          return (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span className={styles.tabCount}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.centred}>
          <span className={styles.spin} />
        </div>
      ) : error ? (
        <div className={styles.centred}>
          <p className={styles.errorText}>{error}</p>
          <button className={styles.refreshBtn} onClick={load}>Try again</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.centred}>
          <Clock size={36} color="var(--color-text-tertiary)" />
          <p className={styles.emptyText}>
            No {activeTab === 'all' ? '' : activeTab} withdrawals
          </p>
        </div>
      ) : (
        <>
          {/* ── Desktop table ── */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>MoMo Number</th>
                  <th>Amount</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(w => (
                  <tr key={w.id}>
                    <td>
                      <div className={styles.userCell}>
                        <div className={styles.userAvatar}>
                          {(w.user_name ?? w.user_phone ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className={styles.userName}>{w.user_name ?? '—'}</div>
                          <div className={styles.userPhone}>{w.user_phone ?? '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className={styles.momoCell}>
                        <span className={styles.momoNumber}>{w.momo_number}</span>
                        <button
                          className={styles.copyBtn}
                          onClick={() => copyMoMo(w.momo_number, w.id)}
                          aria-label="Copy MoMo number"
                        >
                          {copiedId === w.id
                            ? <span className={styles.copiedTick}>✓</span>
                            : <Copy size={13} color="currentColor" />}
                        </button>
                      </div>
                    </td>
                    <td className={styles.amountCell}>₵{Number(w.amount).toFixed(2)}</td>
                    <td>
                      <span className={styles.dateText} title={formatFullDate(w.created_at)}>
                        {timeAgo(w.created_at)}
                      </span>
                    </td>
                    <td><StatusBadge status={w.status} /></td>
                    <td><RowActions w={w} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ── */}
          <div className={styles.cards}>
            {filtered.map(w => (
              <div key={w.id} className={`${styles.card} ${w.status === 'pending' ? styles.cardPending : ''}`}>
                <div className={styles.cardTop}>
                  <div className={styles.userCell}>
                    <div className={styles.userAvatar}>
                      {(w.user_name ?? w.user_phone ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className={styles.userName}>{w.user_name ?? '—'}</div>
                      <div className={styles.userPhone}>{w.user_phone ?? '—'}</div>
                    </div>
                  </div>
                  <div className={styles.cardTopRight}>
                    <span className={styles.cardAmount}>₵{Number(w.amount).toFixed(2)}</span>
                    <StatusBadge status={w.status} />
                  </div>
                </div>

                <div className={styles.cardMomo}>
                  <span className={styles.cardMomoLabel}>MoMo</span>
                  <span className={styles.momoNumber}>{w.momo_number}</span>
                  <button
                    className={styles.copyBtn}
                    onClick={() => copyMoMo(w.momo_number, w.id)}
                    aria-label="Copy"
                  >
                    {copiedId === w.id
                      ? <span className={styles.copiedTick}>✓</span>
                      : <Copy size={13} color="currentColor" />}
                  </button>
                </div>

                <div className={styles.cardDate}>{timeAgo(w.created_at)}</div>

                {w.status === 'pending' && (
                  <div className={styles.cardActionsWrap}>
                    <RowActions w={w} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
