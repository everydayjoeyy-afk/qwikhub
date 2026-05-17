import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Share, Shop, WalletMoney } from 'iconsax-react'
import CreateStoreModal from '../components/CreateStoreModal/CreateStoreModal'
import { useAuth } from '../context/AuthContext'
import { getReferrals, getMyStore, transferReferralEarnings } from '../lib/db'
import styles from './Refer.module.css'

const COMMISSION_RATE = 0.05

const STEPS = [
  {
    n: 1,
    title: 'Share your code',
    body: 'Send your unique referral code or link to friends via WhatsApp, social media, or anywhere.',
  },
  {
    n: 2,
    title: 'They sign up & buy',
    body: 'Your friend creates an account using your code and makes their first purchase on the app.',
  },
  {
    n: 3,
    title: 'Earn 5% on every purchase',
    body: 'You earn 5% of every purchase your referrals make — automatically added to your earnings.',
  },
]

function maskPhone(phone) {
  if (!phone) return '—'
  return phone.slice(0, 4) + '***' + phone.slice(-3)
}

function timeAgo(isoString) {
  const d   = new Date(isoString)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString())       return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  const diffDays = Math.floor((now - d) / 86400000)
  return `${diffDays} days ago`
}

export default function Refer() {
  const navigate = useNavigate()
  const { user, profile, refetchProfile } = useAuth()

  const [referrals, setReferrals]                 = useState([])
  const [loading, setLoading]                     = useState(true)
  const [hasStore, setHasStore]                   = useState(false)
  const [showNoStorePrompt, setShowNoStorePrompt] = useState(false)
  const [createStoreOpen, setCreateStoreOpen]     = useState(false)
  const [linkCopied, setLinkCopied]               = useState(false)
  const [transferring, setTransferring]           = useState(false)
  const [transferDone, setTransferDone]           = useState(false)
  const [transferError, setTransferError]         = useState('')

  const referralCode = profile?.referral_code ?? '—'
  const referralLink = `${window.location.origin}/signup?ref=${referralCode}`

  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => setLoading(false), 8000)
    Promise.all([
      getReferrals(user.id),
      getMyStore(user.id),
    ]).then(([{ data: refs }, { data: store }]) => {
      clearTimeout(timer)
      setReferrals(refs ?? [])
      setHasStore(!!store)
      setLoading(false)
    }).catch((err) => {
      console.error('[Refer] fetch error', err)
      clearTimeout(timer)
      setLoading(false)
    })
    return () => clearTimeout(timer)
  }, [user])

  // Only count commissions not yet transferred to earnings_balance
  const availableEarnings = referrals.reduce(
    (sum, r) => sum + (!r.transferred ? (r.commission_amount ?? 0) : 0), 0
  )
  const totalEarnings = referrals.reduce((sum, r) => sum + (r.commission_amount ?? 0), 0)

  const handleCopy = () => {
    navigator.clipboard?.writeText(referralLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join QwikHub',
        text: `Buy cheap data bundles on QwikHub! Sign up with my link:`,
        url: referralLink,
      }).catch(() => {})
    } else {
      handleCopy()
    }
  }

  const handleTransfer = async () => {
    if (!hasStore) { setShowNoStorePrompt(true); return }
    if (availableEarnings <= 0 || transferring) return
    setTransferring(true)
    setTransferError('')
    const { error } = await transferReferralEarnings(user.id, availableEarnings)
    setTransferring(false)
    if (error) {
      setTransferError('Transfer failed. Please try again.')
    } else {
      // Mark all referrals as transferred in local state
      setReferrals(prev => prev.map(r => ({ ...r, transferred: true })))
      setTransferDone(true)
      // Refresh profile so earnings_balance is up to date everywhere
      await refetchProfile()
    }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')} aria-label="Go back">
          <ArrowLeft size={20} color="currentColor" />
        </button>
        <span className={styles.pageTitle}>Refer &amp; Earn</span>
        <div className={styles.headerSpacer} />
      </div>

      {/* Earnings summary */}
      <div className={styles.earningsCard}>
        <div className={styles.earningsInfo}>
          <span className={styles.earningsLabel}>Available to transfer</span>
          <span className={styles.earningsAmount}>₵{availableEarnings.toFixed(2)}</span>
        </div>
        <button
          className={styles.transferBtn}
          onClick={handleTransfer}
          disabled={availableEarnings === 0 || transferring || transferDone}
          aria-label="Transfer to earnings balance"
        >
          <WalletMoney size={18} color="currentColor" variant="Bold" />
          {transferring ? 'Transferring…' : transferDone ? 'Transferred!' : 'Transfer'}
        </button>
      </div>
      {availableEarnings === 0 && !transferDone && (
        <p className={styles.transferHint}>Earn commissions by referring friends to unlock transfers.</p>
      )}
      {transferDone && (
        <p className={styles.transferHint}>
          ₵{totalEarnings.toFixed(2)} added to your earnings balance — withdrawable anytime.
        </p>
      )}
      {transferError && (
        <p className={styles.transferHint} style={{ color: 'var(--color-danger, #ef4444)' }}>{transferError}</p>
      )}

      {/* No-store prompt */}
      {showNoStorePrompt && (
        <div className={styles.noStorePrompt}>
          <div className={styles.noStoreText}>
            <span className={styles.noStoreTitle}>No store yet</span>
            <span className={styles.noStoreBody}>
              Create your store to receive referral earnings and sell bundles at your own prices.
            </span>
          </div>
          <button className={styles.createStoreBtn} onClick={() => setCreateStoreOpen(true)}>
            <Shop size={16} color="currentColor" variant="Bold" />
            Create Store
          </button>
        </div>
      )}

      {/* Referral link card */}
      <div className={styles.codeCard}>
        <span className={styles.codeLabel}>Your referral link</span>
        <div className={styles.codeRow}>
          <span className={styles.link}>{referralLink}</span>
          <button className={styles.copyBtn} onClick={handleCopy} aria-label="Copy link">
            <Copy size={18} color="currentColor" variant="Bold" />
          </button>
        </div>
        <button className={styles.shareBtn} onClick={handleShare}>
          <Share size={18} color="currentColor" variant="Bold" />
          Share with friends
        </button>
      </div>

      {/* How it works */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>How it works</span>
        <div className={styles.steps}>
          {STEPS.map((step) => (
            <div key={step.n} className={styles.step}>
              <div className={styles.stepBadge}>{step.n}</div>
              <div className={styles.stepContent}>
                <span className={styles.stepTitle}>{step.title}</span>
                <span className={styles.stepBody}>{step.body}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Referred users */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Your Referrals</span>

        {loading ? (
          <p className={styles.hint}>Loading…</p>
        ) : referrals.length === 0 ? (
          <div className={styles.emptyReferrals}>
            <span className={styles.emptyText}>
              No referrals yet. Share your link to get started.
            </span>
          </div>
        ) : (
          <div className={styles.usersList}>
            {referrals.map((ref, i) => {
              const u = ref.referred_user
              const commission = ref.commission_amount ?? 0
              return (
                <div key={ref.id}>
                  <div className={styles.userRow}>
                    <div className={styles.userAvatar}>
                      {(u?.name ?? u?.phone ?? '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className={styles.userInfo}>
                      <span className={styles.userPhone}>{maskPhone(u?.phone)}</span>
                      <span className={styles.userJoined}>
                        Joined {timeAgo(ref.created_at)}
                      </span>
                    </div>
                    <div className={styles.userEarnings}>
                      <span className={styles.userCommission}>+₵{commission.toFixed(2)}</span>
                      {ref.transferred && commission > 0 && (
                        <span className={styles.transferredBadge}>Transferred</span>
                      )}
                    </div>
                  </div>
                  {i < referrals.length - 1 && <div className={styles.divider} />}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {linkCopied && <div className={styles.toast}>Link copied!</div>}

      <CreateStoreModal
        open={createStoreOpen}
        onClose={() => setCreateStoreOpen(false)}
        onCreated={() => navigate('/my-store')}
      />
    </div>
  )
}
