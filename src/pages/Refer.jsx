import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Share, Shop, WalletMoney } from 'iconsax-react'
import CreateStoreModal from '../components/CreateStoreModal/CreateStoreModal'
import styles from './Refer.module.css'

const REFERRAL_CODE = 'JOEL10'
const REFERRAL_LINK = `https://qwikhub.com/signup?ref=${REFERRAL_CODE}`
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

const REFERRED_USERS = [
  { id: 1, phone: '0551***567', joinedDate: 'Today',      totalPurchases: 320.00 },
  { id: 2, phone: '0241***890', joinedDate: 'Yesterday',  totalPurchases: 184.50 },
  { id: 3, phone: '0271***213', joinedDate: 'Yesterday',  totalPurchases:  96.50 },
  { id: 4, phone: '0201***774', joinedDate: '2 days ago', totalPurchases: 451.20 },
  { id: 5, phone: '0557***038', joinedDate: '2 days ago', totalPurchases:  39.80 },
]

// simulate no store initially — flip to true to test the other state
const USER_HAS_STORE = false

function anonymise(phone) {
  return phone
}

export default function Refer() {
  const navigate = useNavigate()
  const [showNoStorePrompt, setShowNoStorePrompt] = useState(false)
  const [createStoreOpen, setCreateStoreOpen] = useState(false)

  const totalEarnings = REFERRED_USERS.reduce(
    (sum, u) => sum + u.totalPurchases * COMMISSION_RATE, 0
  )

  const [linkCopied, setLinkCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard?.writeText(REFERRAL_LINK)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleTransfer = () => {
    if (!USER_HAS_STORE) {
      setShowNoStorePrompt(true)
    }
    // else: handle actual transfer
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

      {/* Earnings summary — shown before the link */}
      <div className={styles.earningsCard}>
        <div className={styles.earningsInfo}>
          <span className={styles.earningsLabel}>Total earnings</span>
          <span className={styles.earningsAmount}>₵{totalEarnings.toFixed(2)}</span>
        </div>
        <button
          className={styles.transferBtn}
          onClick={handleTransfer}
          disabled={totalEarnings === 0}
        >
          <WalletMoney size={18} color="currentColor" variant="Bold" />
          Transfer to My Store
        </button>
      </div>

      {/* No-store prompt */}
      {showNoStorePrompt && (
        <div className={styles.noStorePrompt}>
          <div className={styles.noStoreText}>
            <span className={styles.noStoreTitle}>No store yet</span>
            <span className={styles.noStoreBody}>Create your store to receive referral earnings and sell bundles at your own prices.</span>
          </div>
          <button
            className={styles.createStoreBtn}
            onClick={() => setCreateStoreOpen(true)}
          >
            <Shop size={16} color="currentColor" variant="Bold" />
            Create Store
          </button>
        </div>
      )}

      {/* Referral link card */}
      <div className={styles.codeCard}>
        <span className={styles.codeLabel}>Your referral link</span>
        <div className={styles.codeRow}>
          <span className={styles.link}>{REFERRAL_LINK}</span>
          <button className={styles.copyBtn} onClick={handleCopy} aria-label="Copy link">
            <Copy size={18} color="currentColor" variant="Bold" />
          </button>
        </div>
        <button className={styles.shareBtn}>
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

      {/* Earnings + referred users */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Your Referrals</span>

        {/* Referred users list */}
        {REFERRED_USERS.length === 0 ? (
          <div className={styles.emptyReferrals}>
            <span className={styles.emptyText}>No referrals yet. Share your code to get started.</span>
          </div>
        ) : (
          <div className={styles.usersList}>
            {REFERRED_USERS.map((user, i) => (
              <div key={user.id}>
                <div className={styles.userRow}>
                  <div className={styles.userAvatar}>
                    {user.phone.slice(0, 1)}
                  </div>
                  <div className={styles.userInfo}>
                    <span className={styles.userPhone}>{anonymise(user.phone)}</span>
                    <span className={styles.userJoined}>Joined {user.joinedDate}</span>
                  </div>
                  <div className={styles.userEarnings}>
                    <span className={styles.userPurchases}>₵{user.totalPurchases.toFixed(2)} spent</span>
                    <span className={styles.userCommission}>+₵{(user.totalPurchases * COMMISSION_RATE).toFixed(2)}</span>
                  </div>
                </div>
                {i < REFERRED_USERS.length - 1 && <div className={styles.divider} />}
              </div>
            ))}
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
