import { useState, useEffect, useRef } from 'react'
import { CloseCircle, Trash, TickCircle } from 'iconsax-react'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { recordReferralCommission } from '../../lib/db'
import { deliverWalletBundle } from '../../lib/cheapBundles'
import styles from './CartModal.module.css'
import { useFocusTrap } from '../../hooks/useFocusTrap'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function CartModal({ open, onClose, onPaymentSuccess }) {
  const { items, total, removeFromCart, clearCart } = useCart()
  const { user, profile, refetchProfile } = useAuth()
  const overlayRef = useRef(null)
  const sheetRef   = useRef(null)
  const [status, setStatus]   = useState('idle') // idle | loading | success
  const [errorMsg, setErrorMsg] = useState('')

  useFocusTrap(sheetRef, open)

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
    if (!open) { setStatus('idle'); setErrorMsg('') }
  }, [open])

  if (!open) return null

  const handlePay = async () => {
    if (status === 'loading') return

    const balance = profile?.wallet_balance ?? 0
    if (balance < total) {
      setErrorMsg(`Insufficient balance. You have ₵${Number(balance).toFixed(2)} but need ₵${total.toFixed(2)}. Please top up first.`)
      return
    }

    setStatus('loading')
    setErrorMsg('')

    try {
      const raw   = localStorage.getItem('sb-qwikhub-session')
      const token = JSON.parse(raw)?.access_token
      const headers = {
        apikey:         ANON_KEY,
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer:         'return=representation',
      }

      // 1. Atomically deduct total from wallet (direct REST — avoids init-lock deadlock)
      const debitRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/decrement_wallet`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_user_id: user.id, p_amount: total }),
      })
      if (!debitRes.ok) {
        const msg = await debitRes.text().catch(() => '')
        throw new Error(msg || `Debit failed (${debitRes.status})`)
      }

      // 2. Record one transaction per cart item (delivery_status tracks bundle send)
      const txRes = await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(
          items.map(item => ({
            user_id:         user.id,
            type:            'debit',
            amount:          item.price,
            description:     item.type === 'subscription'
              ? `[Sub] ${item.bundleLabel} → ${item.phone}`
              : `${item.bundleLabel} → ${item.phone} (${item.networkName})`,
            delivery_status: item.type === 'subscription' ? 'not_applicable' : 'pending',
          }))
        ),
      })
      if (!txRes.ok) throw new Error(`Transaction record failed (${txRes.status})`)
      const txData = await txRes.json().catch(() => [])

      // 3. Credit 20% of QwikHub's profit as referral commission (bundle purchases only)
      //    Profit per item = sale price − API cost price. Commission = 20% of total profit.
      const bundleItems  = items.filter(i => i.type !== 'subscription')
      const bundlesTotal = bundleItems.reduce((sum, i) => sum + i.price, 0)
      const totalProfit  = bundleItems.reduce(
        (sum, i) => sum + Math.max(0, i.price - (i.costPrice ?? 0)), 0
      )
      const commission = Math.round(totalProfit * 0.20 * 100) / 100
      if (bundlesTotal > 0 && commission > 0) {
        recordReferralCommission(user.id, bundlesTotal, commission).catch(() => {})
      }

      // 4. Refresh balance display, clear cart, notify home
      await refetchProfile()
      clearCart()
      onPaymentSuccess?.()
      window.dispatchEvent(new Event('qwikhub:payment'))
      setStatus('success')
      setTimeout(() => onClose(), 2000)

      // 5. Deliver bundles via Edge Function (after showing success — fire-and-forget)
      //    On API failure we mark pending_verification; admin verifies before any refund.
      items.forEach((item, i) => {
        if (item.type === 'subscription') return
        const txId = txData[i]?.id
        if (!txId) return
        deliverWalletBundle({
          transactionId: txId,
          phone:         item.phone,
          networkId:     item.networkId,
          bundleValue:   item.bundleValue,
        }).catch(err => console.error('[CartModal] delivery error:', err))
      })
    } catch (err) {
      console.error('[CartModal] payment error:', err)
      setErrorMsg('Payment failed. Please try again.')
      setStatus('idle')
    }
  }

  // ── Success state ─────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className={styles.overlay} aria-modal="true" role="dialog">
        <div ref={sheetRef} className={styles.sheet}>
          <div className={styles.handle} />
          <div className={styles.successBody}>
            <TickCircle size={56} color="#22c55e" variant="Bold" />
            <p className={styles.successTitle}>Order placed!</p>
            <p className={styles.successSub}>Your bundles are being processed.</p>
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
      aria-label="Order summary"
    >
      <div ref={sheetRef} className={styles.sheet}>
        <div className={styles.handle} />

        <div className={styles.header}>
          <h2 className={styles.title}>Order Summary</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <CloseCircle size={24} color="currentColor" variant="Bold" />
          </button>
        </div>

        <div className={styles.body}>
          {items.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyText}>Your cart is empty</span>
            </div>
          ) : (
            <ul className={styles.list}>
              {items.map((item) => (
                <li key={item.id} className={styles.item}>
                  <div className={styles.itemLeft}>
                    {item.networkLogo ? (
                      <img src={item.networkLogo} alt={item.networkName} className={styles.itemLogo} />
                    ) : (
                      <div className={styles.itemLogoPlaceholder}>★</div>
                    )}
                    <div className={styles.itemInfo}>
                      {item.networkName && (
                        <span className={styles.itemNetwork}>{item.networkName}</span>
                      )}
                      <span className={styles.itemBundle}>{item.bundleLabel}</span>
                      {item.phone && (
                        <span className={styles.itemPhone}>{item.phone}</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={styles.itemPrice}>₵{item.price.toFixed(2)}</span>
                    <button
                      className={styles.removeBtn}
                      onClick={() => removeFromCart(item.id)}
                      aria-label="Remove item"
                    >
                      <Trash size={16} color="currentColor" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className={styles.footer}>
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalAmount}>₵{total.toFixed(2)}</span>
            </div>

            {errorMsg && (
              <p className={styles.errorNote}>{errorMsg}</p>
            )}

            <button
              className={styles.payBtn}
              onClick={handlePay}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Processing…' : 'Pay'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
