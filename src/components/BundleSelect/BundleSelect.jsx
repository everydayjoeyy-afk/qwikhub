import { useState, useRef, useEffect } from 'react'
import { ArrowDown2 } from 'iconsax-react'
import styles from './BundleSelect.module.css'

export const BUNDLE_OPTIONS = [
  { value: '1gb',   label: '1GB',   price: 4.00   },
  { value: '2gb',   label: '2GB',   price: 8.40   },
  { value: '3gb',   label: '3GB',   price: 12.60  },
  { value: '4gb',   label: '4GB',   price: 16.80  },
  { value: '5gb',   label: '5GB',   price: 21.80  },
  { value: '6gb',   label: '6GB',   price: 25.20  },
  { value: '8gb',   label: '8GB',   price: 33.60  },
  { value: '10gb',  label: '10GB',  price: 39.80  },
  { value: '15gb',  label: '15GB',  price: 58.00  },
  { value: '20gb',  label: '20GB',  price: 77.00  },
  { value: '25gb',  label: '25GB',  price: 96.50  },
  { value: '30gb',  label: '30GB',  price: 116.00 },
  { value: '40gb',  label: '40GB',  price: 153.00 },
  { value: '50gb',  label: '50GB',  price: 191.00 },
  { value: '100gb', label: '100GB', price: 345.00 },
]

export default function BundleSelect({ value, onChange, options: optionsProp }) {
  const options = optionsProp ?? BUNDLE_OPTIONS
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  const selected = options.find(o => o.value === value) ?? null

  // Close on outside click or Escape
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
    onChange(opt.value)
    setOpen(false)
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {/* Trigger */}
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen(p => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`${styles.triggerLabel} ${!selected ? styles.placeholder : ''}`}>
          {selected ? `${selected.label} — ₵${selected.price.toFixed(2)}` : 'Choose a bundle'}
        </span>
        <ArrowDown2
          size={16}
          color="currentColor"
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
        />
      </button>

      {/* Dropdown list */}
      {open && (
        <ul className={styles.dropdown} role="listbox">
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`${styles.option} ${opt.value === value ? styles.optionSelected : ''}`}
              onClick={() => handleSelect(opt)}
            >
              {opt.label} — ₵{opt.price.toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
