import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './AdminGuard.module.css'

export default function AdminGuard({ children }) {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      navigate('/admin/signin', { replace: true })
    }
  }, [user, loading, navigate])

  // Still resolving session or profile
  if (loading || (user && !profile)) {
    return (
      <div className={styles.center}>
        <span className={styles.spin} />
      </div>
    )
  }

  // Not logged in — redirect handled above
  if (!user) return null

  // Logged in but not an admin
  if (!profile?.is_admin) {
    return (
      <div className={styles.center}>
        <p className={styles.denied}>Access denied. This area is for QwikHub admins only.</p>
      </div>
    )
  }

  return children
}
