import { useState, useEffect, useRef } from 'react'
import { CloseCircle, TickCircle, Messages2 } from 'iconsax-react'
import { useAuth } from '../../context/AuthContext'
import { submitComplaint, getMyComplaints } from '../../lib/db'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import styles from './ComplaintModal.module.css'

const CATEGORIES = [
  'Bundle not delivered',
  'Payment / wallet issue',
  'Withdrawal issue',
  'Referral / earnings',
  'Other',
]

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

export default function ComplaintModal({ open, onClose }) {
  const { user } = useAuth()
  const sheetRef = useRef(null)
  const overlayRef = useRef(null)

  const [tab, setTab]           = useState('new')   // 'new' | 'history'
  const [category, setCategory] = useState(CATEGORIES[0])
  const [message, setMessage]   = useState('')
  const [status, setStatus]     = useState('idle')  // idle | sending | sent
  const [error, setError]       = useState('')
  const [list, setList]         = useState([])
  const [loadingList, setLoadingList] = useState(false)

  useFocusTrap(sheetRef, open)

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Reset + load history whenever the modal opens
  useEffect(() => {
    if (!open) return
    setTab('new'); setCategory(CATEGORIES[0]); setMessage(''); setStatus('idle'); setError('')
    loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function loadList() {
    if (!user) return
    setLoadingList(true)
    const { data } = await getMyComplaints()
    setLoadingList(false)
    setList(Array.isArray(data) ? data : [])
  }

  const canSend = message.trim().length >= 3 && status !== 'sending'

  async function handleSend() {
    if (!canSend) return
    setStatus('sending'); setError('')
    const { error: err } = await submitComplaint(category, message.trim())
    if (err) {
      setStatus('idle')
      setError('Could not send. Please check your connection and try again.')
      return
    }
    setStatus('sent')
    setMessage('')
    loadList()
    setTimeout(() => { setStatus('idle'); setTab('history') }, 1400)
  }

  if (!open) return null

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="File a complaint"
    >
      <div ref={sheetRef} className={styles.sheet}>
        <div className={styles.handle} />

        <div className={styles.header}>
          <h2 className={styles.title}>Support</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <CloseCircle size={24} color="currentColor" variant="Bold" />
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'new' ? styles.tabActive : ''}`}
            onClick={() => setTab('new')}
          >
            New complaint
          </button>
          <button
            className={`${styles.tab} ${tab === 'history' ? styles.tabActive : ''}`}
            onClick={() => setTab('history')}
          >
            My complaints{list.length > 0 ? ` (${list.length})` : ''}
          </button>
        </div>

        {/* ── New complaint ── */}
        {tab === 'new' && (
          status === 'sent' ? (
            <div className={styles.sentBody}>
              <TickCircle size={48} color="#22c55e" variant="Bold" />
              <p className={styles.sentTitle}>Complaint sent</p>
              <p className={styles.sentSub}>We'll get back to you here. You'll be notified when we reply.</p>
            </div>
          ) : (
            <div className={styles.body}>
              <p className={styles.hint}>
                Can't reach us on WhatsApp? Send your issue here and we'll reply in the app.
              </p>

              <label className={styles.fieldLabel}>Category</label>
              <select
                className={styles.select}
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <label className={styles.fieldLabel}>Describe the issue</label>
              <textarea
                className={styles.textarea}
                rows={5}
                placeholder="Tell us what happened. Include phone number, transaction reference, or amount if relevant."
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={1000}
              />
              <span className={styles.counter}>{message.length}/1000</span>

              {error && <p className={styles.errorNote}>{error}</p>}

              <button className={styles.sendBtn} onClick={handleSend} disabled={!canSend}>
                {status === 'sending' ? 'Sending…' : 'Send complaint'}
              </button>
            </div>
          )
        )}

        {/* ── History ── */}
        {tab === 'history' && (
          <div className={styles.body}>
            {loadingList ? (
              <p className={styles.hint}>Loading…</p>
            ) : list.length === 0 ? (
              <div className={styles.empty}>
                <Messages2 size={34} color="var(--color-text-tertiary)" />
                <p className={styles.hint}>No complaints yet.</p>
              </div>
            ) : (
              <div className={styles.list}>
                {list.map(c => (
                  <div key={c.id} className={styles.item}>
                    <div className={styles.itemTop}>
                      <span className={styles.itemCategory}>{c.category}</span>
                      <span className={styles.statusBadge} data-status={c.status}>
                        {c.status === 'resolved' ? 'Resolved' : 'Open'}
                      </span>
                    </div>
                    <p className={styles.itemMessage}>{c.message}</p>
                    <span className={styles.itemTime}>{timeAgo(c.created_at)}</span>
                    {c.admin_reply && (
                      <div className={styles.reply}>
                        <span className={styles.replyLabel}>QwikHub replied</span>
                        <p className={styles.replyText}>{c.admin_reply}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
