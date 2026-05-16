import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Filter, CloseCircle, MoneyRecive } from 'iconsax-react'
import FilterSheet from '../components/FilterSheet/FilterSheet'
import { useAuth } from '../context/AuthContext'
import { getWithdrawals, requestWithdrawal } from '../lib/db'
import styles from './Withdrawals.module.css'

const FILTER_SECTIONS = [
  { key: 'status', label: 'Status', options: ['All', 'Completed', 'Processing', 'Pending'] },
  { key: 'period', label: 'Period', options: ['All', 'Today', 'This week', 'This month'] },
]

const DEFAULT_FILTERS = { status: 'All', period: 'All' }

function formatDate(dateStr) {
  const d         = new Date(dateStr)
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString())     return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  const diffDays = Math.floor((today - d) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function isInPeriod(dateStr, period) {
  if (period === 'All') return true
  const d     = new Date(dateStr)
  const today = new Date()
  if (period === 'Today') return d.toDateString() === today.toDateString()
  if (period === 'This week') {
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7)
    return d >= weekAgo
  }
  if (period === 'This month') {
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  }
  return true
}

function groupByDate(withdrawals) {
  const map = {}
  withdrawals.forEach(w => {
    const key = formatDate(w.created_at)
    if (!map[key]) map[key] = []
    map[key].push(w)
  })
  return Object.entries(map).map(([date, items]) => ({ date, items }))
}

export default function Withdrawals() {
  const navigate           = useNavigate()
  const { user, profile, refetchProfile } = useAuth()

  const [withdrawals, setWithdrawals]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [filterOpen, setFilterOpen]     = useState(false)
  const [filters, setFilters]           = useState(DEFAULT_FILTERS)
  const [sheetOpen, setSheetOpen]       = useState(false)

  // Withdrawal form state
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [momoNumber, setMomoNumber]         = useState(profile?.phone ?? '')
  const [submitting, setSubmitting]         = useState(false)
  const [formError, setFormError]           = useState('')
  const [formSuccess, setFormSuccess]       = useState(false)

  // ── Load withdrawals ────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => setLoading(false), 8000)
    getWithdrawals(user.id)
      .then(({ data }) => { setWithdrawals(data ?? []) })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); setLoading(false) })
    return () => clearTimeout(timer)
  }, [user])

  // Pre-fill MoMo number from profile
  useEffect(() => {
    if (profile?.phone) setMomoNumber(profile.phone)
  }, [profile])

  // ── Withdraw request handler ─────────────────────────────────
  const handleWithdrawSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount < 50) { setFormError('Minimum withdrawal is ₵50'); return }
    if (!momoNumber.trim())     { setFormError('Enter your MoMo number');     return }

    const walletBalance = profile?.wallet_balance ?? 0
    if (amount > walletBalance) { setFormError(`Insufficient balance (₵${walletBalance.toFixed(2)})`); return }

    setSubmitting(true)
    const { data, error } = await requestWithdrawal(user.id, amount, momoNumber.trim())
    setSubmitting(false)

    if (error) {
      setFormError(error.message ?? 'Withdrawal failed. Please try again.')
    } else {
      setFormSuccess(true)
      setWithdrawals(prev => [data, ...prev])
      await refetchProfile()
      setTimeout(() => {
        setSheetOpen(false)
        setFormSuccess(false)
        setWithdrawAmount('')
      }, 1800)
    }
  }

  const hasActiveFilter = filters.status !== 'All' || filters.period !== 'All'

  const filtered = withdrawals.filter(w => {
    if (filters.status !== 'All' && w.status !== filters.status.toLowerCase()) return false
    if (!isInPeriod(w.created_at, filters.period)) return false
    return true
  })

  const totalWithdrawn = withdrawals.reduce((s, w) => s + Number(w.amount), 0)
  const groups         = groupByDate(filtered)
  const walletBalance  = profile?.wallet_balance ?? 0

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft size={20} color="currentColor" />
        </button>
        <span className={styles.pageTitle}>Withdrawals</span>
        <button
          className={`${styles.filterBtn} ${hasActiveFilter ? styles.filterBtnActive : ''}`}
          aria-label="Filter"
          onClick={() => setFilterOpen(true)}
        >
          <Filter size={20} color="currentColor" />
        </button>
      </div>

      {/* Wallet balance card */}
      <div className={styles.balanceCard}>
        <div className={styles.balanceInfo}>
          <span className={styles.balanceLabel}>Available balance</span>
          <span className={styles.balanceValue}>₵{walletBalance.toFixed(2)}</span>
        </div>
        <button
          className={styles.withdrawRequestBtn}
          onClick={() => { setFormError(''); setFormSuccess(false); setSheetOpen(true) }}
        >
          <MoneyRecive size={16} color="currentColor" variant="Bold" />
          Withdraw
        </button>
      </div>

      {/* Summary card */}
      <div className={styles.summaryCard}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total withdrawn</span>
          <span className={styles.summaryValue}>₵{totalWithdrawn.toFixed(2)}</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Withdrawals</span>
          <span className={styles.summaryValue}>{withdrawals.length}</span>
        </div>
      </div>

      {/* Grouped list */}
      <div className={styles.list}>
        {loading ? (
          <span className={styles.empty}>Loading…</span>
        ) : groups.length === 0 ? (
          <span className={styles.empty}>No withdrawals yet</span>
        ) : (
          groups.map(group => (
            <div key={group.date} className={styles.group}>
              <span className={styles.dateLabel}>{group.date}</span>
              <div className={styles.groupItems}>
                {group.items.map((w, i) => (
                  <div key={w.id}>
                    <div className={styles.row}>
                      <div className={styles.info}>
                        <span className={styles.amount}>₵{Number(w.amount).toFixed(2)}</span>
                        <span className={styles.destination}>{w.momo_number} · MoMo</span>
                        <span className={styles.time}>{formatTime(w.created_at)}</span>
                      </div>
                      <span
                        className={styles.status}
                        data-status={w.status}
                      >
                        {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                      </span>
                    </div>
                    {i < group.items.length - 1 && <div className={styles.divider} />}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Filter sheet */}
      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        sections={FILTER_SECTIONS}
        values={filters}
        onApply={newFilters => { setFilters(newFilters); setFilterOpen(false) }}
      />

      {/* Withdrawal request bottom sheet */}
      {sheetOpen && (
        <div className={styles.sheetOverlay} onClick={(e) => { if (e.target === e.currentTarget) setSheetOpen(false) }}>
          <div className={styles.sheet}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHeader}>
              <span className={styles.sheetTitle}>Request Withdrawal</span>
              <button className={styles.sheetClose} onClick={() => setSheetOpen(false)} aria-label="Close">
                <CloseCircle size={22} color="currentColor" variant="Bold" />
              </button>
            </div>

            {formSuccess ? (
              <div className={styles.sheetSuccess}>
                <MoneyRecive size={40} color="#FFCC08" variant="Bold" />
                <p className={styles.sheetSuccessText}>Withdrawal request submitted!</p>
                <p className={styles.sheetSuccessNote}>It will be reviewed and processed within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleWithdrawSubmit} noValidate style={{ display: 'contents' }}>
                <div className={styles.sheetBody}>
                  <div className={styles.sheetBalanceHint}>
                    Balance: <strong>₵{walletBalance.toFixed(2)}</strong> · Min. ₵50
                  </div>

                  <div className={styles.sheetForm}>
                    <div className={styles.sheetField}>
                      <label className={styles.sheetLabel}>Amount (₵)</label>
                      <input
                        type="number"
                        className={styles.sheetInput}
                        placeholder="e.g. 100"
                        min="50"
                        max={walletBalance}
                        step="0.01"
                        value={withdrawAmount}
                        onChange={e => setWithdrawAmount(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div className={styles.sheetField}>
                      <label className={styles.sheetLabel}>MoMo Number</label>
                      <input
                        type="tel"
                        className={styles.sheetInput}
                        placeholder="0XX XXX XXXX"
                        value={momoNumber}
                        onChange={e => setMomoNumber(e.target.value)}
                        maxLength={15}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.sheetFooter}>
                  {formError && <p className={styles.sheetError}>{formError}</p>}
                  <button
                    type="submit"
                    className={styles.sheetSubmitBtn}
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting…' : 'Submit Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
