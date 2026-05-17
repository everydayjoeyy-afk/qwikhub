import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Share, Shop, WalletMoney } from 'iconsax-react'
import CreateStoreModal from '../components/CreateStoreModal/CreateStoreModal'
import { useAuth } from '../context/AuthContext'
import { getReferrals, getMyStore } from '../lib/db'
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
  const d = new Date(isoString)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

export default function Refer() {
  const navigate = useNavigate()
  const { user, profile, ready } = useAuth()

  const [referrals, setReferrals]           = useState([])
  const [loading, setLoading]               = useState(true)
  const [hasStore, setHasStore]             = useState(false)
  const [showNoStorePrompt, setShowNoStorePrompt] = useState(false)
  const [createStoreOpen, setCreateStoreOpen]     = useState(false)
  const [linkCopied, setLinkCopied]         = useState(false)

  const referralCode = profile?.referral_code ?? '—'
  const referralLink = `${window.location.origin}/signup?ref=${referralCode}`

  useEffect(() => {
    // Wait for ready: supabase.auth.getSession() must have resolved so the
    // Supabase client's init lock is released before rpc() calls can proceed.
    if (!user || !ready) return
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
  }, [user, ready])

  // Commission earned = sum of commission_amount recorded on each referral row
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

  const handleTransfer = () => {
    if (!hasStore) {
      setShowNoStorePrompt(true)
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
          <span className={styles.earningsLabel}>Total earnings</span>
          <span className={styles.earningsAmount}>₵{totalEarnings.toFixed(2)}</span>
        </div>
        <button
          className={styles.transferBtn}
          onClick={handleTransfer}
          disabled={totalEarnings === 0}
          title={totalEarnings === 0 ? 'You have no referral earnings yet' : undefined}
          aria-label={totalEarnings === 0 ? 'Transfer to My Store – no earnings yet' : 'Transfer to My Store'}
        >
          <WalletMoney size={18} color="currentColor" variant="Bold" />
          Transfer to My Store
        </button>
      </div>
      {totalEarnings === 0 && (
        <p className={styles.transferHint}>Earn commissions by referring friends to unlock transfers.</p>
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
          <p style={{ textAlign: 'center', padding: '16px 0', opacity: 0.5, fontSize: 13 }}>
            Loading…
          </p>
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
