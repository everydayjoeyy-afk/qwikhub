import { useState, useEffect, useRef } from 'react'
import { CloseCircle } from 'iconsax-react'
import styles from './FilterSheet.module.css'

export default function FilterSheet({ open, onClose, sections, values, onApply }) {
  const [local, setLocal] = useState(values)
  const overlayRef = useRef(null)

  // Sync if parent resets values
  useEffect(() => { setLocal(values) }, [values, open])

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const select = (key, option) =>
    setLocal(prev => ({ ...prev, [key]: option }))

  const reset = () => {
    const cleared = {}
    sections.forEach(s => { cleared[s.key] = 'All' })
    setLocal(cleared)
  }

  const hasActiveFilter = sections.some(s => local[s.key] && local[s.key] !== 'All')

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      aria-modal="true"
      role="dialog"
      aria-label="Filter"
    >
      <div className={styles.sheet}>
        <div className={styles.handle} />

        <div className={styles.header}>
          <h2 className={styles.title}>Filter</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <CloseCircle size={24} color="currentColor" variant="Bold" />
          </button>
        </div>

        <div className={styles.body}>
          {sections.map((section) => (
            <div key={section.key} className={styles.section}>
              <span className={styles.sectionLabel}>{section.label}</span>
              <div className={styles.chips}>
                {section.options.map((opt) => (
                  <button
                    key={opt}
                    className={`${styles.chip} ${local[section.key] === opt ? styles.chipActive : ''}`}
                    onClick={() => select(section.key, opt)}
                    type="button"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          {hasActiveFilter && (
            <button className={styles.resetBtn} onClick={reset} type="button">
              Reset
            </button>
          )}
          <button
            className={styles.applyBtn}
            onClick={() => onApply(local)}
            type="button"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
