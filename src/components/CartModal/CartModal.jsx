import { useEffect, useRef } from 'react'
import { CloseCircle, Trash } from 'iconsax-react'
import { useCart } from '../../context/CartContext'
import styles from './CartModal.module.css'

export default function CartModal({ open, onClose }) {
  const { items, total, removeFromCart } = useCart()
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      aria-modal="true"
      role="dialog"
      aria-label="Order summary"
    >
      <div className={styles.sheet}>
        {/* Handle */}
        <div className={styles.handle} />

        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Order Summary</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <CloseCircle size={24} color="currentColor" variant="Bold" />
          </button>
        </div>

        {/* Items */}
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

        {/* Footer */}
        {items.length > 0 && (
          <div className={styles.footer}>
            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalAmount}>₵{total.toFixed(2)}</span>
            </div>
            <button className={styles.payBtn}>
              Pay
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
