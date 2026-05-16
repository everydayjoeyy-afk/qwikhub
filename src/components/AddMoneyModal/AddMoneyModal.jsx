import { useState, useEffect, useRef } from 'react'
import { CloseCircle } from 'iconsax-react'
import styles from './AddMoneyModal.module.css'

export default function AddMoneyModal({ open, onClose }) {
  const [amount, setAmount] = useState('')
  const inputRef = useRef(null)
  const overlayRef = useRef(null)

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

  // Auto-focus input when modal opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    } else {
      setAmount('')
    }
  }, [open])

  if (!open) return null

  const parsed = parseFloat(amount.replace(/,/g, ''))
  const isValid = !isNaN(parsed) && parsed > 0

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
          <label className={styles.label} htmlFor="add-money-amount">
            Amount
          </label>

          <div className={styles.inputWrap}>
            <span className={styles.prefix}>₵</span>
            <input
              ref={inputRef}
              id="add-money-amount"
              type="number"
              inputMode="decimal"
              min="0"
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
        </div>

        <div className={styles.footer}>
          <button className={styles.proceedBtn} disabled={!isValid}>
            Proceed
          </button>
        </div>
      </div>
    </div>
  )
}
