import { useState, useEffect, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar/Sidebar'
import ProtectedRoute from './components/ProtectedRoute'
import { HambergerMenu, ShoppingCart } from 'iconsax-react'
import { useCart } from './context/CartContext'
import { useAuth } from './context/AuthContext'
import logoDark from './assets/logo-dark.svg'
import logoLight from './assets/logo-light.svg'
import styles from './App.module.css'

import CartModal from './components/CartModal/CartModal'
import Home from './pages/Home'
import Subscription from './pages/Subscription'
import BillingHistory from './pages/BillingHistory'
import Store from './pages/Store'
import MyStore from './pages/MyStore'
import Orders from './pages/Orders'
import Transactions from './pages/Transactions'
import Refer from './pages/Refer'
import StoreOrders from './pages/StoreOrders'
import Withdrawals from './pages/Withdrawals'
import Storefront from './pages/Storefront'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

const GREETINGS = ['Welcome', 'Akwaaba']
function useGreeting() {
  // useState lazy initializer runs exactly once on mount — not on every re-render
  const [greeting] = useState(() => {
    const key = 'qwikhub_greeting_index'
    const current = parseInt(localStorage.getItem(key) ?? '0', 10)
    localStorage.setItem(key, String((current + 1) % GREETINGS.length))
    return GREETINGS[current]
  })
  return greeting
}

function useSystemTheme() {
  const [theme, setTheme] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => setTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return theme
}

export default function App() {
  const { count } = useCart()
  const { profile } = useAuth()
  const location = useLocation()
  const isStorefront = /^\/store\/.+/.test(location.pathname)
  const isAuthPage   = ['/signin', '/signup', '/forgot-password', '/reset-password'].includes(location.pathname)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const profileRef = useRef(null)
  const theme = useSystemTheme()
  const greeting = useGreeting()

  // Derive display values from live profile, fall back to placeholder while loading
  const displayName     = profile?.name    ?? '…'
  const displayPhone    = profile?.phone   ?? ''
  const displayInitial  = (profile?.name ?? 'U').charAt(0).toUpperCase()
  const firstName       = profile?.name?.split(' ')[0] ?? 'there'

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!profileOpen) return
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    const handleKey = (e) => { if (e.key === 'Escape') setProfileOpen(false) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [profileOpen])

  const isDark = theme === 'dark'

  if (isStorefront || isAuthPage) {
    return (
      <div data-theme={theme}>
        <Routes>
          <Route path="/store/:slug"      element={<Storefront />} />
          <Route path="/signin"           element={<SignIn          isDark={isDark} />} />
          <Route path="/signup"           element={<SignUp          isDark={isDark} />} />
          <Route path="/forgot-password"  element={<ForgotPassword isDark={isDark} />} />
          <Route path="/reset-password"   element={<ResetPassword  isDark={isDark} />} />
        </Routes>
      </div>
    )
  }

  return (
    <div className={styles.shell} data-theme={theme}>
      <header className={styles.topbar}>
        <button
          className={styles.iconBtn}
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <HambergerMenu size={20} color="currentColor" />
        </button>

        <img
          src={isDark ? logoDark : logoLight}
          alt="QwikHub"
          className={styles.logo}
        />

        <div className={styles.topbarRight}>
          <button
            className={styles.iconBtn}
            aria-label="Cart"
            style={{ position: 'relative' }}
            onClick={() => setCartOpen(true)}
          >
            <ShoppingCart size={20} color="currentColor" />
            {count > 0 && (
              <span className={styles.cartBadge}>{count}</span>
            )}
          </button>

          <div className={styles.profileWrap} ref={profileRef}>
            <button
              className={styles.avatar}
              onClick={() => setProfileOpen(p => !p)}
              aria-label="Profile menu"
              aria-expanded={profileOpen}
            >
              {displayInitial}
            </button>

            {profileOpen && (
              <div className={styles.profileDropdown}>
                <div className={styles.profileDropdownAvatar}>{displayInitial}</div>
                <div className={styles.profileDropdownInfo}>
                  <span className={styles.profileDropdownName}>{displayName}</span>
                  <span className={styles.profileDropdownPhone}>{displayPhone}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <Routes>
          {/* Public routes */}
          <Route path="/signin"          element={<SignIn          isDark={isDark} />} />
          <Route path="/signup"          element={<SignUp          isDark={isDark} />} />
          <Route path="/forgot-password" element={<ForgotPassword isDark={isDark} />} />
          <Route path="/reset-password"  element={<ResetPassword  isDark={isDark} />} />
          <Route path="/store/:slug"     element={<Storefront />} />

          {/* Protected routes */}
          <Route path="/" element={<ProtectedRoute><Home greeting={greeting} firstName={firstName} /></ProtectedRoute>} />
          <Route path="/subscription"        element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
          <Route path="/subscription/billing" element={<ProtectedRoute><BillingHistory /></ProtectedRoute>} />
          <Route path="/store"               element={<ProtectedRoute><Store /></ProtectedRoute>} />
          <Route path="/my-store"            element={<ProtectedRoute><MyStore /></ProtectedRoute>} />
          <Route path="/my-store/orders"     element={<ProtectedRoute><StoreOrders /></ProtectedRoute>} />
          <Route path="/withdrawals"         element={<ProtectedRoute><Withdrawals /></ProtectedRoute>} />
          <Route path="/orders"              element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/transactions"        element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
          <Route path="/refer"               element={<ProtectedRoute><Refer /></ProtectedRoute>} />
        </Routes>
      </main>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} isDark={isDark} />
      <CartModal open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  )
}
