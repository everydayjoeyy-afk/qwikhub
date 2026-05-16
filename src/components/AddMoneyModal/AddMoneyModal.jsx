import { useState, useEffect, useRef } from 'react'
import { usePaystackPayment } from 'react-paystack'
import { CloseCircle } from 'iconsax-react'
import { useAuth } from '../../context/AuthContext'
import { creditWallet } from '../../lib/db'
import styles from './AddMoneyModal.module.css'

const PAYSTACK_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY
const FEE_RATE     = 0.02   // 2% — we absorb the 0.5% difference from Paystack's 1.5%

export default function AddMoneyModal({ open, onClose }) {
  const { user, profile, refetchProfile } = useAuth()
  const [amount, setAmount]   = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef   = useRef(null)
  const overlayRef = useRef(null)

  const parsed      = parseFloat(amount) || 0
  const isValid     = parsed >= 1                          // minimum ₵1
  const fee         = isValid ? parsed * FEE_RATE : 0
  const totalCharge = isValid ? parsed + fee : 0           // what Paystack charges
  const kobo        = Math.round(totalCharge * 100)        // Paystack uses pesewas (GHS×100)

  const paystackConfig = {
    reference:  `qwikhub_${Date.now()}`,
    email:      user?.email ?? '',
    amount:     kobo,
    currency:   'GHS',
    publicKey:  PAYSTACK_KEY,
    metadata:   { credit_amount: parsed },                 // original amount to credit
  }

  const initPaystack = usePaystackPayment(paystackConfig)

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    } else {
      setAmount('')
      setLoading(false)
    }
  }, [open])

  if (!open) return null

  const handleProceed = () => {
    if (!isValid || loading) return
    setLoading(true)

    initPaystack({
      onSuccess: async (transaction) => {
        // Credit the wallet with the original amount (before fee)
        await creditWallet(
          user.id,
          parsed,
          `Wallet top-up via Paystack`,
          transaction.reference,
        )
        await refetchProfile()   // refresh wallet balance in UI
        setLoading(false)
        onClose()
      },
      onClose: () => {
        setLoading(false)
      },
    })
  }

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      aria-modal="true"
      role="dialog"
      aria-label="Add money"
    >
      <div className={styles.sheet}>
        <div className={styles.handle} />

        <div className={styles.header}>
          <h2 className={styles.title}>Add Money</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <CloseCircle size={24} color="currentColor" variant="Bold" />
          </button>
        </div>

        <div className={styles.body}>
          <label className={styles.label} htmlFor="add-money-amount">Amount</label>

          <div className={styles.inputWrap}>
            <span className={styles.prefix}>₵</span>
            <input
              ref={inputRef}
              id="add-money-amount"
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              className={styles.input}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className={styles.quickAmounts}>
            {['10', '20', '50', '100'].map((q) => (
              <button
                key={q}
                className={`${styles.chip} ${amount === q ? styles.chipActive : ''}`}
                onClick={() => setAmount(q)}
                type="button"
              >
                ₵{q}
              </button>
            ))}
          </div>

          <p className={styles.feeNote}>
            A <strong>2% processing fee</strong> is charged on all top-ups (powered by Paystack).
          </p>

          {/* Debit badge — only show when amount is entered */}
          {isValid && (
            <div className={styles.debitBadge}>
              You'll be debited <strong>₵{totalCharge.toFixed(2)}</strong>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.proceedBtn}
            disabled={!isValid || loading}
            onClick={handleProceed}
          >
            {loading ? 'Opening Paystack…' : 'Proceed'}
          </button>
        </div>
      </div>
    </div>
  )
}
