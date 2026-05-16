import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shop } from 'iconsax-react'
import empty from '../assets/empty.svg'
import CreateStoreModal from '../components/CreateStoreModal/CreateStoreModal'
import { useAuth } from '../context/AuthContext'
import { getMyStore } from '../lib/db'
import styles from './Store.module.css'

export default function Store() {
  const navigate     = useNavigate()
  const { user }     = useAuth()
  const [modalOpen, setModalOpen]   = useState(false)
  const [checking, setChecking]     = useState(true)

  // If user already has a store, go straight to it
  useEffect(() => {
    if (!user) return
    getMyStore(user.id).then(({ data }) => {
      if (data) {
        navigate('/my-store', { replace: true })
      } else {
        setChecking(false)
      }
    })
  }, [user])

  if (checking) return null

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
