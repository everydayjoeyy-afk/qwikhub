import { useState, useEffect, useRef } from 'react'
import { CloseCircle, Shop } from 'iconsax-react'
import { useAuth } from '../../context/AuthContext'
import { createStore } from '../../lib/db'
import styles from './CreateStoreModal.module.css'

export const THEMES = [
  { id: 'midnight', label: 'Midnight',  primary: '#0f0f10', accent: '#FFCC08' },
  { id: 'ocean',    label: 'Ocean',     primary: '#0a2540', accent: '#2563eb' },
  { id: 'forest',   label: 'Forest',    primary: '#052e16', accent: '#16a34a' },
  { id: 'rose',     label: 'Rose',      primary: '#4c0519', accent: '#f43f5e' },
  { id: 'slate',    label: 'Slate',     primary: '#1e293b', accent: '#94a3b8' },
  { id: 'amber',    label: 'Amber',     primary: '#431407', accent: '#f97316' },
]

function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

export default function CreateStoreModal({ open, onClose, onCreated }) {
  const { user } = useAuth()
  const [name, setName]       = useState('')
  const [slug, setSlug]       = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [theme, setTheme]     = useState(THEMES[0].id)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const overlayRef            = useRef(null)
  const nameRef               = useRef(null)

  useEffect(() => {
    if (!slugEdited) setSlug(toSlug(name))
  }, [name, slugEdited])

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

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => nameRef.current?.focus(), 80)
      return () => clearTimeout(t)
    } else {
      setName('')
      setSlug('')
      setSlugEdited(false)
      setTheme(THEMES[0].id)
    }
  }, [open])

  if (!open) return null

  const isValid = name.trim().length > 0 && slug.length > 0

  const handleSlugChange = (e) => {
    setSlugEdited(true)
    setSlug(toSlug(e.target.value) || toSlug(name))
  }

  const handleSubmit = async () => {
    if (!isValid || creating) return
    setCreating(true)
    setCreateError('')
    const storeData = { name: name.trim(), slug, theme }
    localStorage.setItem('qwikhub_store', JSON.stringify(storeData))
    if (user) {
      const { error } = await createStore(user.id, { store_name: name.trim(), store_slug: slug, theme })
      if (error) {
        const msg = error.message?.includes('unique') || error.code === '23505'
          ? 'That store link is already taken. Try a different one.'
          : 'Could not create store. Please try again.'
        setCreateError(msg)
        setCreating(false)
        return
      }
    }
    setCreating(false)
    onCreated?.(storeData)
    onClose()
  }

  const selectedTheme = THEMES.find(t => t.id === theme)

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      aria-modal="true"
      role="dialog"
      aria-label="Create store"
    >
      <div className={styles.sheet}>
        <div className={styles.handle} />

        <div className={styles.header}>
          <h2 className={styles.title}>Create Store</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <CloseCircle size={24} color="currentColor" variant="Bold" />
          </button>
        </div>

        <div className={styles.body}>
          {/* Store name */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="store-name">Store Name</label>
            <input
              ref={nameRef}
              id="store-name"
              type="text"
              className={styles.input}
              placeholder="e.g. Joel's Bundle Shop"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </div>

          {/* Store link — auto-generated, editable */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="store-slug">Store Link</label>
            <div className={styles.slugWrap}>
              <span className={styles.slugPrefix}>qwikhub.com/store/</span>
              <input
                id="store-slug"
                type="text"
                className={styles.slugInput}
                value={slug}
                onChange={handleSlugChange}
                placeholder="your-store"
                maxLength={40}
                spellCheck={false}
              />
            </div>
            <span className={styles.fieldHint}>
              Customers will visit this link to buy from your store.
            </span>
          </div>

          {/* Theme picker */}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Storefront Theme</label>
            <div className={styles.themeGrid}>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.themeChip} ${theme === t.id ? styles.themeChipActive : ''}`}
                  onClick={() => setTheme(t.id)}
                  aria-pressed={theme === t.id}
                >
                  <span
                    className={styles.themeSwatch}
                    style={{ background: t.primary, borderColor: t.accent }}
                  >
                    <span
                      className={styles.themeSwatchAccent}
                      style={{ background: t.accent }}
                    />
                  </span>
                  <span className={styles.themeLabel}>{t.label}</span>
                </button>
              ))}
            </div>
            {/* Preview bar */}
            <div
              className={styles.themePreview}
              style={{ background: selectedTheme.primary }}
            >
              <span className={styles.previewStoreName} style={{ color: '#fff' }}>
                {name.trim() || 'Your Store'}
              </span>
              <span
                className={styles.previewBadge}
                style={{ background: selectedTheme.accent, color: selectedTheme.primary }}
              >
                Shop now
              </span>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          {createError && (
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#ef4444', textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
              {createError}
            </p>
          )}
          <button
            className={styles.createBtn}
            disabled={!isValid || creating}
            onClick={handleSubmit}
          >
            <Shop size={18} color="currentColor" variant="Bold" />
            {creating ? 'Creating…' : 'Create Store'}
          </button>
        </div>
      </div>
    </div>
  )
}
