import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Home2, Box, Receipt1, Shop, ReceiptItem, Gift, LogoutCurve, ArrowDown2, CloseCircle,
} from 'iconsax-react'
import styles from './Sidebar.module.css'
import logoDark from '../../assets/logo-dark.svg'
import logoLight from '../../assets/logo-light.svg'

const NAV = [
  { id: 'home',         label: 'Home',         icon: Home2, path: '/' },
  {
    id: 'bundles', label: 'Bundles', icon: Box,
    children: [
      { id: 'bundles-orders', label: 'Orders', path: '/orders' },
    ],
  },
  {
    id: 'subscription', label: 'Subscriptions', icon: Receipt1,
    children: [
      { id: 'sub-plan',    label: 'Premium Offers',        path: '/subscription' },
      { id: 'sub-billing', label: 'Billing history', path: '/subscription/billing' },
    ],
  },
  {
    id: 'store', label: 'Store', icon: Shop,
    children: [
      { id: 'store-mystore',     label: 'My Store',    path: '/my-store'    },
      { id: 'store-withdrawals', label: 'Withdrawals', path: '/withdrawals' },
    ],
  },
  { id: 'transactions', label: 'Transactions', icon: ReceiptItem, path: '/transactions' },
]

const BOTTOM_NAV = [
  { id: 'logout', label: 'Log out', icon: LogoutCurve, danger: true },
]

export default function Sidebar({ open, onClose, isDark }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut } = useAuth()
  const [openDropdowns, setOpenDropdowns] = useState({})
  const firstFocusableRef = useRef(null)
  const touchStartX = useRef(null)

  // Derive active id from current URL
  const activeId = (() => {
    const p = location.pathname
    if (p === '/') return 'home'
    if (p === '/orders') return 'bundles-orders'
    if (p.startsWith('/bundles')) return p === '/bundles' ? 'bundles-all' : p.replace('/bundles/', 'bundles-')
    if (p.startsWith('/subscription')) return p === '/subscription' ? 'sub-plan' : p.replace('/subscription/', 'sub-')
    if (p.startsWith('/my-store')) return 'store-mystore'
    if (p === '/withdrawals') return 'store-withdrawals'
    if (p === '/transactions') return 'transactions'
    if (p === '/refer') return 'refer'
    return ''
  })()

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      firstFocusableRef.current?.focus()
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    if (touchStartX.current - e.changedTouches[0].clientX > 60) onClose()
    touchStartX.current = null
  }

  const toggleDropdown = useCallback((id) => {
    setOpenDropdowns(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const goTo = useCallback((path) => {
    navigate(path)
    onClose()
  }, [navigate, onClose])

  const handleNavClick = useCallback((item) => {
    if (item.children) toggleDropdown(item.id)
    else goTo(item.path)
  }, [toggleDropdown, goTo])

  return (
    <>
      <div
        className={`${styles.overlay} ${open ? styles.overlayOpen : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}
        aria-label="Main navigation"
        aria-hidden={!open}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className={styles.header}>
          <div className={styles.headerLogo}>
            <img src={isDark ? logoDark : logoLight} alt="QwikHub" className={styles.logoImg} />
          </div>
          <button
            ref={firstFocusableRef}
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close menu"
          >
            <CloseCircle size={22} color="currentColor" variant="Linear" />
          </button>
        </div>

        <nav className={styles.nav}>
          {NAV.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              activeId={activeId}
              isOpen={!!openDropdowns[item.id]}
              onToggle={() => handleNavClick(item)}
              onChildClick={(child) => goTo(child.path)}
            />
          ))}

          <div className={styles.divider} />
          <div className={styles.sectionLabel}>Earn</div>

          <button
            className={`${styles.navItem} ${activeId === 'refer' ? styles.active : ''}`}
            onClick={() => goTo('/refer')}
          >
            <Gift size={20} color="currentColor" variant={activeId === 'refer' ? 'Bold' : 'Linear'} />
            <span className={styles.navLabel}>Refer &amp; Earn</span>
          </button>
        </nav>

        <div className={styles.bottomNav}>
          <div className={styles.divider} />
          {BOTTOM_NAV.map((item) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${item.danger ? styles.danger : ''}`}
              onClick={() => { onClose(); signOut(); navigate('/signin') }}
            >
              <item.icon size={20} color="currentColor" variant="Linear" />
              <span className={styles.navLabel}>{item.label}</span>
            </button>
          ))}
        </div>
      </aside>
    </>
  )
}

function NavItem({ item, activeId, isOpen, onToggle, onChildClick }) {
  const isActive = activeId === item.id || item.children?.some(c => c.id === activeId)
  const contentHeight = item.children ? item.children.length * 44 + 8 : 0

  if (item.children) {
    return (
      <div>
        <button
          className={`${styles.navItem} ${isActive ? styles.active : ''}`}
          onClick={onToggle}
          aria-expanded={isOpen}
        >
          <item.icon size={20} color="currentColor" variant={isActive ? 'Bold' : 'Linear'} />
          <span className={styles.navLabel}>{item.label}</span>
          <ArrowDown2
            size={16}
            color="currentColor"
            className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
          />
        </button>
        <div className={styles.dropdown} style={{ maxHeight: isOpen ? `${contentHeight}px` : 0 }}>
          {item.children.map((child) => (
            <button
              key={child.id}
              className={`${styles.dropdownItem} ${activeId === child.id ? styles.dropdownItemActive : ''}`}
              onClick={() => onChildClick(child)}
            >
              {child.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <button
      className={`${styles.navItem} ${isActive ? styles.active : ''}`}
      onClick={onToggle}
    >
      <item.icon size={20} color="currentColor" variant={isActive ? 'Bold' : 'Linear'} />
      <span className={styles.navLabel}>{item.label}</span>
    </button>
  )
}
