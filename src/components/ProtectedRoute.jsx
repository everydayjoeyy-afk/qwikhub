import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import logoLight from '../assets/logo-light.svg'
import logoDark  from '../assets/logo-dark.svg'

function LoadingScreen() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20,
      background: 'var(--color-background)',
    }}>
      <img
        src={isDark ? logoDark : logoLight}
        alt="QwikHub"
        style={{ height: 28, opacity: 0.9 }}
      />
      <div style={{
        width: 32, height: 32,
        borderRadius: '50%',
        border: '3px solid var(--color-border)',
        borderTopColor: '#FFCC08',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user)   return <Navigate to="/signin" replace />
  return children
}
