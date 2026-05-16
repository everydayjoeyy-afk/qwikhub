import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shop } from 'iconsax-react'
import empty from '../assets/empty.svg'
import CreateStoreModal from '../components/CreateStoreModal/CreateStoreModal'
import { useAuth } from '../context/AuthContext'
import { getMyStore } from '../lib/db'
import styles from './Store.module.css'

export default function Store() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [checking, setChecking]   = useState(true)

  useEffect(() => {
    if (!user) return

    // Safety: never stay blank forever on slow networks
    const timer = setTimeout(() => setChecking(false), 6000)

    getMyStore(user.id).then(({ data }) => {
      clearTimeout(timer)
      if (data) {
        navigate('/my-store', { replace: true })
      } else {
        setChecking(false)
      }
    })

    return () => clearTimeout(timer)
  }, [user])

  // Show a subtle spinner while checking — NOT a blank page
  if (checking) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '3px solid var(--color-border)',
          borderTopColor: '#FFCC08',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <img src={empty} alt="" className={styles.illustration} aria-hidden="true" />
      <div className={styles.copy}>
        <h2 className={styles.heading}>No store yet</h2>
        <p className={styles.body}>
          Create your own store to sell data bundles at your own prices and earn on every sale.
        </p>
      </div>
      <button className={styles.createBtn} onClick={() => setModalOpen(true)}>
        <Shop size={20} color="currentColor" variant="Bold" />
        Create Store
      </button>

      <CreateStoreModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => navigate('/my-store')}
      />
    </div>
  )
}
