import { useState, useEffect, useRef } from 'react'
import { usePaystackPayment } from 'react-paystack'
import { CloseCircle, TickCircle } from 'iconsax-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { creditWallet } from '../../lib/db'
import styles from './AddMoneyModal.module.css'

const PAYSTACK_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY
const FEE_RATE     = 0.02

export default function AddMoneyModal({ open, onClose, onPaymentSuccess }) {
  const { user, refetchProfile } = useAuth()
  const [amount, setAmount]       = useState('')
  const [status, setStatus]       = useState('idle') // idle | loading | success | error
  const [showFallback, setShowFallback] = useState(false)
  const fallbackTimer = useRef(null)
  const inputRef   = useRef(null)
  const overlayRef = useRef(null)

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
    const capturedAmount = parsed   // capture before any re-render
    setStatus('loading')

    // Fallback: if Paystack callback doesn't fire within 8s (mobile browser issue),
    // show a manual "I've paid" button so the user isn't stuck forever
    fallbackTimer.current = setTimeout(() => setShowFallback(true), 8000)

    const handleSuccess = async (reference) => {
      clearTimeout(fallbackTimer.current)
      setShowFallback(false)

      console.log('[AddMoney] ✅ onSuccess fired', { reference, userId: user?.id, capturedAmount })

      if (!user?.id) {
        console.error('[AddMoney] ❌ user.id is missing!')
        setStatus('wallet_error')
        return
      }

      // Ensure the JWT is fresh before calling the RPC (expired tokens cause silent hangs)
      try { await supabase.auth.refreshSession() } catch (_) { /* non-fatal */ }

      console.log('[AddMoney] 📞 Calling creditWallet RPC...')

      // Race the RPC against a 12-second timeout so the UI can never freeze permanently
      const timeoutResult = new Promise(resolve =>
        setTimeout(() => resolve({ error: new Error('timeout') }), 12000)
      )
      const { error: walletErr } = await Promise.race([
        creditWallet(user.id, capturedAmount, 'Wallet top-up via Paystack', reference),
        timeoutResult,
      ])

      if (walletErr) {
        console.error('[AddMoney] ❌ creditWallet RPC error:', JSON.stringify(walletErr))
        setStatus('wallet_error')
        return
      }

      console.log('[AddMoney] ✅ Wallet credited, refetching profile...')
      await refetchProfile()
      onPaymentSuccess?.()
      setStatus('success')
      setTimeout(() => onClose(), 1800)
    }

    initPaystack({
      onSuccess: (transaction) => handleSuccess(transaction.reference),
      onClose: () => {
        clearTimeout(fallbackTimer.current)
        setShowFallback(false)
        setStatus('idle')
      },
    })
  }

  // ── Wallet error state (payment went through but DB update failed) ──
  if (status === 'wallet_error') {
    return (
      <div className={styles.overlay} aria-modal="true" role="dialog">
        <div className={styles.sheet}>
          <div className={styles.handle} />
          <div className={styles.successBody}>
            <TickCircle size={56} color="#f59e0b" variant="Bold" />
            <p className={styles.successTitle}>Payment received!</p>
            <p className={styles.successSub}>
              Your payment went through but your balance couldn't be updated right now.
              Please contact support — your money is safe.
            </p>
            <button className={styles.proceedBtn} onClick={onClose} style={{ marginTop: 8 }}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Success state ────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className={styles.overlay} aria-modal="true" role="dialog">
        <div className={styles.sheet}>
          <div className={styles.handle} />
          <div className={styles.successBody}>
            <TickCircle size={56} color="#22c55e" variant="Bold" />
            <p className={styles.successTitle}>Payment successful!</p>
            <p className={styles.successSub}>₵{parsed.toFixed(2)} has been added to your wallet.</p>
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

          {isValid && (
            <div className={styles.debitBadge}>
              You'll be debited <strong>₵{totalCharge.toFixed(2)}</strong>
            </div>
          )}

          {status === 'error' && (
            <p className={styles.errorNote}>
              Payment received but wallet update failed. Please contact support.
            </p>
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
            <button
              className={styles.fallbackBtn}
              onClick={() => {
                clearTimeout(fallbackTimer.current)
                setStatus('success')
                setTimeout(() => onClose(), 1800)
                refetchProfile()
              }}
            >
              Paid successfully? Tap to confirm
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
