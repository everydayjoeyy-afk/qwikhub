import { useState, useEffect, useRef } from 'react'
import { CloseCircle } from 'iconsax-react'
import QIcon from '../../assets/Q.svg'
import styles from './ChatBot.module.css'

// ── Q&A decision tree ─────────────────────────────────────────
const MENU = [
  { id: 'bundles',    label: '⏱ Bundle timing'        },
  { id: 'fees',       label: '💳 Paystack fees'        },
  { id: 'referrals',  label: '🎁 How referrals work'   },
  { id: 'withdraw',   label: '💰 How to withdraw'      },
  { id: 'missing',    label: '❓ Bundle not reflected'  },
  { id: 'support',    label: '💬 Talk to support'      },
]

const BACK = { id: '__menu', label: '← Back to menu' }

const TREE = {
  bundles: {
    text: 'MTN and Telecel bundles usually reflect within 1–5 minutes. AirtelTigo may take up to 15 minutes.\n\nIf it\'s been over 30 minutes and still nothing, contact our support team with your transaction reference.',
    chips: [{ id: 'missing', label: '❓ Still not reflected' }, BACK],
  },
  fees: {
    text: 'A flat 2% processing fee is added to every wallet top-up (powered by Paystack).\n\nExample: topping up ₵100 will charge you ₵102. The fee goes directly to Paystack — QwikHub does not keep it.',
    chips: [{ id: 'topup', label: '➕ How do I add money?' }, BACK],
  },
  topup: {
    text: 'From the Home screen tap "Add Money" on your wallet card. Enter an amount (min ₵1), choose a quick amount or type your own, then tap Proceed to pay via Paystack.',
    chips: [BACK],
  },
  referrals: {
    text: 'Share your unique referral code or link with friends. When they sign up using your code and make a purchase, you automatically earn 5% commission on their spend.\n\nCommissions land in your Earnings balance — separate from your wallet — and can be withdrawn to MoMo.',
    chips: [{ id: 'withdraw', label: '💰 How do I withdraw?' }, BACK],
  },
  withdraw: {
    text: 'Go to Store → Withdrawals and tap "Withdraw".\n\n• Minimum: ₵50\n• Paid to your MoMo number\n• Requests are reviewed and processed within 24 hours.',
    chips: [{ id: 'withdrawmin', label: 'Why ₵50 minimum?' }, BACK],
  },
  withdrawmin: {
    text: 'The ₵50 minimum exists to keep processing costs manageable for both you and us. Smaller amounts would be eaten up by MoMo transfer fees.',
    chips: [BACK],
  },
  missing: {
    text: "Don't panic! Here's a quick checklist:\n\n① Double-check the phone number on your order\n② Wait up to 30 minutes for slower networks\n③ Check your transaction history to confirm the order went through\n\nIf it's been over 30 minutes, contact support with your transaction reference.",
    chips: [{ id: 'support', label: '💬 Contact support' }, BACK],
  },
  support: {
    text: 'Our support team is available on WhatsApp. Tap the button below and we\'ll get back to you as soon as possible — usually within a few hours.\n\nPlease include your phone number and transaction reference for faster help.',
    chips: [
      { id: '__whatsapp', label: '💬 Open WhatsApp' },
      BACK,
    ],
  },
}

const SUPPORT_WHATSAPP = 'https://wa.me/233XXXXXXXXX' // ← replace with real number

// ── Component ─────────────────────────────────────────────────
export default function ChatBot() {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState([])
  const [showMenu, setShowMenu] = useState(true)
  const bottomRef               = useRef(null)
  const sheetRef                = useRef(null)

  // Greeting on first open — intentionally only re-runs when `open` changes;
  // reading messages.length here is safe because we only ever *set* state when
  // the panel just opened (messages will always be [] at that moment).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) {
      setMessages([{
        id:   Date.now(),
        from: 'bot',
        text: "👋 Hi there! I'm QwikBot.\n\nWhat can I help you with today?",
      }])
      setShowMenu(true)
    }
  }, [open])

  // Scroll to latest message
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const handleChip = (chip) => {
    if (chip.id === '__menu') {
      setMessages(prev => [...prev, { id: Date.now(), from: 'user', text: chip.label }])
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id:   Date.now() + 1,
          from: 'bot',
          text: "Sure! Here's everything I can help you with:",
        }])
        setShowMenu(true)
      }, 300)
      return
    }

    if (chip.id === '__whatsapp') {
      window.open(SUPPORT_WHATSAPP, '_blank', 'noopener')
      return
    }

    const node = TREE[chip.id]
    if (!node) return

    setShowMenu(false)
    setMessages(prev => [...prev, { id: Date.now(), from: 'user', text: chip.label }])
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id:    Date.now() + 1,
        from:  'bot',
        text:  node.text,
        chips: node.chips,
      }])
    }, 320)
  }

  const handleClose = () => {
    setOpen(false)
    // Reset after animation finishes
    setTimeout(() => { setMessages([]); setShowMenu(false) }, 300)
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        className={styles.fab}
        onClick={() => setOpen(true)}
        aria-label="Open help chat"
        aria-haspopup="dialog"
        style={{ display: open ? 'none' : 'flex' }}
      >
        <img src={QIcon} alt="" aria-hidden="true" className={styles.fabIcon} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className={styles.backdrop}
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Chat panel */}
      <div
        ref={sheetRef}
        className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="QwikBot help chat"
      >
        {/* Header */}
        <div className={styles.panelHandle} />
        <div className={styles.panelHeader}>
          <div className={styles.botIdentity}>
            <div className={styles.botAvatar}>
              <img src={QIcon} alt="" aria-hidden="true" className={styles.botAvatarIcon} />
            </div>
            <div className={styles.botMeta}>
              <span className={styles.botName}>QwikBot</span>
              <span className={styles.botStatus}>
                <span className={styles.statusDot} />
                Always here to help
              </span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Close chat">
            <CloseCircle size={22} color="currentColor" variant="Bold" />
          </button>
        </div>

        {/* Messages */}
        <div className={styles.messages}>
          {messages.map((msg) => (
            <div key={msg.id} className={`${styles.bubble} ${styles[msg.from]}`}>
              <p className={styles.bubbleText}>{msg.text}</p>
              {msg.chips && (
                <div className={styles.chipRow}>
                  {msg.chips.map((chip) => (
                    <button
                      key={chip.id}
                      className={styles.chip}
                      onClick={() => handleChip(chip)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Main menu chips */}
          {showMenu && (
            <div className={styles.menuChips}>
              {MENU.map((item) => (
                <button
                  key={item.id}
                  className={styles.menuChip}
                  onClick={() => handleChip(item)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </>
  )
}
