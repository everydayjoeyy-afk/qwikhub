import { useState, useEffect, useRef } from 'react'
import { usePaystackPayment } from 'react-paystack'
import { CloseCircle, TickCircle } from 'iconsax-react'
import { useAuth } from '../../context/AuthContext'
import styles from './AddMoneyModal.module.css'
import { useFocusTrap } from '../../hooks/useFocusTrap'

const PAYSTACK_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY
const FEE_RATE     = 0.02

export default function AddMoneyModal({ open, onClose, onPaymentSuccess }) {
  const { user, refetchProfile } = useAuth()
  const [amount, setAmount]       = useState('')
  const [status, setStatus]       = useState('idle') // idle | loading | success
  const [showFallback, setShowFallback] = useState(false)
  const fallbackTimer = useRef(null)
  const inputRef   = useRef(null)
  const overlayRef = useRef(null)
  const sheetRef   = useRef(null)

  useFocusTrap(sheetRef, open)

  const parsed      = parseFloat(amount) || 0
  const isValid     = parsed >= 1
  const fee         = isValid ? parsed * FEE_RATE : 0
  const totalCharge = isValid ? parsed + fee : 0
  const kobo        = Math.round(totalCharge * 100)

  const paystackConfig = {
    reference: `qwikhub_${Date.now()}`,
    email:     user?.email ?? '',
    amount:    kobo,
    currency:  'GHS',
    publicKey: PAYSTACK_KEY,
    metadata:  {
      user_id:       user?.id ?? '',
      wallet_amount: parsed,
      custom_fields: [
        { display_name: 'User ID', variable_name: 'user_id', value: user?.id ?? '' },
        { display_name: 'Wallet Amount', variable_name: 'wallet_amount', value: String(parsed) },
      ],
    },
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
      // Reset when modal closes
      setAmount('')
      setStatus('idle')
      setShowFallback(false)
      clearTimeout(fallbackTimer.current)
    }
  }, [open])

  if (!open) return null

  const handleProceed = () => {
    if (!isValid || status === 'loading') return
    setStatus('loading')

    // Fallback: if Paystack callback doesn't fire within 8s (mobile browser issue),
    // show a manual "I've paid" button so the user isn't stuck forever
    fallbackTimer.current = setTimeout(() => setShowFallback(true), 8000)

    const handleSuccess = async () => {
      clearTimeout(fallbackTimer.current)
      setShowFallback(false)

      // Wallet credit is handled server-side by the Paystack webhook.
      // Show success immediately and poll to refresh the balance.
      onPaymentSuccess?.()
      setStatus('success')

      // Poll refetchProfile in the background so the balance updates on screen
      ;(async () => {
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 2500))
          await refetchProfile()
        }
      })()

      setTimeout(() => onClose(), 2500)
    }

    initPaystack({
      onSuccess: () => handleSuccess(),
      onClose: () => {
        clearTimeout(fallbackTimer.current)
        setShowFallback(false)
        setStatus('idle')
      },
    })
  }

  // ── Success state ────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className={styles.overlay} aria-modal="true" role="dialog">
        <div ref={sheetRef} className={styles.sheet}>
          <div className={styles.handle} />
          <div className={styles.successBody}>
            <TickCircle size={56} color="#22c55e" variant="Bold" />
            <p className={styles.successTitle}>Payment successful!</p>
            <p className={styles.successSub}>₵{parsed.toFixed(2)} is being added to your wallet.</p>
          </div>
        </div>
      </div>
    )
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
      <div ref={sheetRef} className={styles.sheet}>
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
            <span className={styles.prefix} aria-hidden="true">₵</span>
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

          {isValid && (
            <div className={styles.debitBadge}>
              You'll be debited <strong>₵{totalCharge.toFixed(2)}</strong>
            </div>
          )}

        </div>

        <div className={styles.footer}>
          {!isValid && amount !== '' && (
            <p className={styles.errorNote}>Minimum top-up is ₵1.00</p>
          )}
          <button
            className={styles.proceedBtn}
            disabled={!isValid || status === 'loading'}
            onClick={handleProceed}
          >
            {status === 'loading' ? 'Opening Paystack…' : 'Proceed'}
          </button>

          {showFallback && (
            <p className={styles.fallbackMsg}>
              Taking too long? If Paystack already charged you, please contact support — your payment is safe. Otherwise, close and try again.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
