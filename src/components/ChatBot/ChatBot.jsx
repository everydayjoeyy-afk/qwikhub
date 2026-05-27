import { useState, useEffect, useRef } from 'react'
import {
  CloseCircle, Timer1, Wallet2, Gift, Money2,
  MessageQuestion, Headphone, ArrowLeft, Add, MessageText,
} from 'iconsax-react'
import QIcon      from '../../assets/Q.svg'
import WhatsAppIcon from '../../assets/icons8-whatsapp.svg'
import styles from './ChatBot.module.css'

const WHATSAPP_CHANNEL = 'https://whatsapp.com/channel/0029VbCc8oQ545uuu3uM7u3e'

// ── Q&A decision tree ─────────────────────────────────────────
const MENU = [
  { id: 'bundles',   label: 'Bundle timing',       Icon: Timer1          },
  { id: 'fees',      label: 'Paystack fees',        Icon: Wallet2         },
  { id: 'referrals', label: 'How referrals work',   Icon: Gift            },
  { id: 'withdraw',  label: 'How to withdraw',      Icon: Money2          },
  { id: 'missing',   label: 'Bundle not reflected', Icon: MessageQuestion },
  { id: 'support',   label: 'Talk to support',      Icon: Headphone       },
]

const BACK = { id: '__menu', label: 'Back to menu', Icon: ArrowLeft }

const TREE = {
  bundles: {
    text: 'MTN and Telecel bundles usually reflect within 1–5 minutes. AirtelTigo may take up to 15 minutes.\n\nIf it\'s been over 30 minutes and still nothing, contact our support team with your transaction reference.',
    chips: [{ id: 'missing', label: 'Still not reflected', Icon: MessageQuestion }, BACK],
  },
  fees: {
    text: 'Paystack charges a 2% processing fee on every payment — this applies in two places:\n\n① Wallet top-ups — the 2% is added on top of your amount. Example: topping up ₵100 charges you ₵102.\n\n② Storefront sales — the 2% is deducted from your profit on each sale. Example: you earn ₵1.00 markup on a bundle, so ₵0.10 goes to Paystack and ₵0.90 lands in your earnings.\n\nThe fee goes directly to Paystack — QwikHub does not keep it.',
    chips: [{ id: 'topup', label: 'How do I add money?', Icon: Add }, BACK],
  },
  topup: {
    text: 'From the Home screen tap "Add Money" on your wallet card. Enter an amount (min ₵1), choose a quick amount or type your own, then tap Proceed to pay via Paystack.',
    chips: [BACK],
  },
  referrals: {
    text: 'We know Paystack takes 2% on every transaction — Refer & Earn is our way of giving some of that back.\n\nShare your unique referral code or link. When a friend signs up using your code and makes a bundle purchase, you automatically earn 10% of QwikHub\'s profit on that sale.\n\nCommissions land in your Earnings balance — separate from your wallet — and can be withdrawn to MoMo.',
    chips: [{ id: 'withdraw', label: 'How do I withdraw?', Icon: Money2 }, BACK],
  },
  withdraw: {
    text: 'Go to Store → Withdrawals and tap "Withdraw".\n\n• Minimum: ₵50\n• Paid to your MoMo number\n• Requests are reviewed and processed within 24 hours.',
    chips: [{ id: 'withdrawmin', label: 'Why ₵50 minimum?', Icon: MessageQuestion }, BACK],
  },
  withdrawmin: {
    text: 'The ₵50 minimum exists to keep processing costs manageable for both you and us. Smaller amounts would be eaten up by MoMo transfer fees.',
    chips: [BACK],
  },
  missing: {
    text: "Don't panic! Here's a quick checklist:\n\n① Double-check the phone number on your order\n② Wait up to 30 minutes for slower networks\n③ Check your transaction history to confirm the order went through\n\nIf it's been over 30 minutes, contact support with your transaction reference.",
    chips: [{ id: 'support', label: 'Contact support', Icon: Headphone }, BACK],
  },
  support: {
    text: 'Our support team is available on WhatsApp. Tap the button below and we\'ll get back to you as soon as possible — usually within a few minutes.\n\nPlease include your phone number and transaction reference for faster help.',
    chips: [
      { id: '__whatsapp', label: 'Open WhatsApp', Icon: MessageText },
      BACK,
    ],
  },
}

const SUPPORT_WHATSAPP = 'https://wa.me/233549187917'

// Pre-filled WhatsApp message based on which topic led to support
const TOPIC_MESSAGES = {
  missing:  'Hi, I\'m a QwikHub user and I need help with a bundle that hasn\'t reflected on my phone.',
  bundles:  'Hi, I\'m a QwikHub user and I need help with a bundle delivery issue.',
  fees:     'Hi, I\'m a QwikHub user and I need help with a payment or fee issue.',
  referrals:'Hi, I\'m a QwikHub user and I need help with my referral earnings.',
  withdraw: 'Hi, I\'m a QwikHub user and I need help with a withdrawal.',
  default:  'Hi, I\'m a QwikHub user and I need some help.',
}

function buildWhatsAppUrl(topic) {
  const msg = TOPIC_MESSAGES[topic] ?? TOPIC_MESSAGES.default
  return `${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`
}

// ── One-time WhatsApp channel reminder ────────────────────────
const WA_REMINDER_KEY = 'qwikhub_wa_reminder_dismissed'

function WhatsAppReminder() {
  const [show, setShow] = useState(() => !localStorage.getItem(WA_REMINDER_KEY))

  if (!show) return null

  const dismiss = () => {
    localStorage.setItem(WA_REMINDER_KEY, '1')
    setShow(false)
  }

  return (
    <>
      <div className={styles.reminderBackdrop} onClick={dismiss} />
      <div className={styles.reminderModal}>
        <img src={WhatsAppIcon} alt="" className={styles.reminderIcon} />
        <p className={styles.reminderTitle}>Stay in the loop!</p>
        <p className={styles.reminderText}>
          Join our WhatsApp channel for updates, new features and exclusive offers. Tap the green WhatsApp button on the bottom right corner to follow.
        </p>
        <button className={styles.reminderBtn} onClick={dismiss}>
          Got it
        </button>
      </div>
    </>
  )
}

// ── Component ─────────────────────────────────────────────────
export default function ChatBot() {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState([])
  const [showMenu, setShowMenu] = useState(true)
  const [lastTopic, setLastTopic] = useState(null)
  const bottomRef               = useRef(null)
  const sheetRef                = useRef(null)

  // Greeting on first open
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

  // Lock background scroll while panel is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Scroll to latest message
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
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
      window.open(buildWhatsAppUrl(lastTopic), '_blank', 'noopener')
      return
    }

    const node = TREE[chip.id]
    if (!node) return

    setLastTopic(chip.id)
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
    setTimeout(() => { setMessages([]); setShowMenu(false); setLastTopic(null) }, 300)
  }

  return (
    <>
      {/* One-time WhatsApp channel reminder */}
      <WhatsAppReminder />

      {/* WhatsApp channel button */}
      <a
        href={WHATSAPP_CHANNEL}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.fabWhatsApp}
        aria-label="Follow QwikHub on WhatsApp"
        style={{ display: open ? 'none' : 'flex' }}
      >
        <img src={WhatsAppIcon} alt="" aria-hidden="true" className={styles.fabIcon} />
      </a>

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
                      {chip.Icon && (
                        <chip.Icon size={14} color="currentColor" variant="Bold" />
                      )}
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
                  <item.Icon size={16} color="currentColor" variant="Bold" className={styles.menuChipIcon} />
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
