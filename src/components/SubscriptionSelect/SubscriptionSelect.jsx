import { useState, useRef, useEffect } from 'react'
import { ArrowDown2 } from 'iconsax-react'
import { SUBSCRIPTION_OPTIONS } from '../../data/subscriptions'
import styles from './SubscriptionSelect.module.css'

export default function SubscriptionSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const selected = SUBSCRIPTION_OPTIONS.find(o => o.value === value) ?? null

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const handleSelect = (opt) => {
    onChange(opt)
    setOpen(false)
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen(p => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`${styles.triggerLabel} ${!selected ? styles.placeholder : ''}`}>
          {selected ? selected.label : 'Choose a subscription'}
        </span>
        <ArrowDown2
          size={16}
          color="currentColor"
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
        />
      </button>

      {open && (
        <ul className={styles.dropdown} role="listbox">
          {SUBSCRIPTION_OPTIONS.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`${styles.option} ${opt.value === value ? styles.optionSelected : ''}`}
              onClick={() => handleSelect(opt)}
            >
              <span className={styles.optionLabel}>{opt.label}</span>
              <span className={styles.optionPrice}>₵{opt.price.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
