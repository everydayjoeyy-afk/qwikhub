import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  HambergerMenu, CloseCircle, MoneyRecive, LogoutCurve,
  ShoppingBag, People, Category, Receipt2, ArrowLeft2, ArrowRight2,
  Wallet2,
} from 'iconsax-react'
import { useAuth } from '../context/AuthContext'
import logoLight from '../assets/logo-light.svg'
import logoDark  from '../assets/logo-dark.svg'
import styles from './AdminLayout.module.css'

const NAV = [
  { to: '/admin/dashboard',    label: 'Dashboard',    Icon: Category    },
  { to: '/admin/withdrawals',  label: 'Withdrawals',  Icon: MoneyRecive },
  { to: '/admin/orders',       label: 'Orders',       Icon: ShoppingBag },
  { to: '/admin/transactions', label: 'Transactions', Icon: Receipt2    },
  { to: '/admin/topups',       label: 'Top-up Monitor', Icon: Wallet2   },
  { to: '/admin/users',        label: 'Users',        Icon: People      },
]

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('admin-sidebar-collapsed') === 'true'
  )

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

  const handleSignOut = () => {
    signOut()
    navigate('/admin/signin', { replace: true })
  }

  function toggleCollapse() {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('admin-sidebar-collapsed', String(next))
      return next
    })
  }

  const SidebarContent = ({ allowCollapse = false }) => (
    <div className={styles.sidebar}>
      <div className={styles.sidebarTop}>

        {/* Brand */}
        <div className={styles.brand}>
          {!collapsed && (
            <>
              <img src={isDark ? logoDark : logoLight} alt="QwikHub" className={styles.logo} />
              <span className={styles.adminBadge}>Admin</span>
            </>
          )}
          {collapsed && (
            <div className={styles.collapsedDot} title="QwikHub Admin" />
          )}
        </div>

        {/* Nav */}
        <nav>
          <ul className={styles.navList}>
            {NAV.map(({ to, label, Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `${styles.navItem} ${collapsed ? styles.navItemCollapsed : ''} ${isActive ? styles.navItemActive : ''}`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={17} color="currentColor" variant="Bold" />
                  {!collapsed && <span className={styles.navLabel}>{label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Collapse toggle (desktop only) */}
      {allowCollapse && (
        <button
          className={`${styles.collapseBtn} ${collapsed ? styles.collapseBtnCollapsed : ''}`}
          onClick={toggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ArrowRight2 size={14} color="currentColor" />
            : <ArrowLeft2  size={14} color="currentColor" />
          }
          {!collapsed && <span>Collapse</span>}
        </button>
      )}

      {/* Footer */}
      <div className={`${styles.sidebarFooter} ${collapsed ? styles.sidebarFooterCollapsed : ''}`}>
        <div className={styles.avatar} title={collapsed ? (profile?.name ?? 'Admin') : undefined}>
          {(profile?.name ?? 'A').charAt(0).toUpperCase()}
        </div>
        {!collapsed && (
          <div className={styles.userMeta}>
            <span className={styles.userName}>{profile?.name ?? 'Admin'}</span>
            <span className={styles.userEmail}>{profile?.email ?? ''}</span>
          </div>
        )}
        {!collapsed && (
          <button className={styles.signOutBtn} onClick={handleSignOut} aria-label="Sign out">
            <LogoutCurve size={17} color="currentColor" />
          </button>
        )}
        {collapsed && (
          <button
            className={styles.signOutBtn}
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            style={{ marginLeft: 'auto' }}
          >
            <LogoutCurve size={15} color="currentColor" />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className={styles.shell} data-collapsed={collapsed}>

      {/* ── Mobile top bar ── */}
      <header className={styles.topbar}>
        <button
          className={styles.menuBtn}
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <HambergerMenu size={20} color="currentColor" />
        </button>
        <span className={styles.topbarTitle}>QwikHub Admin</span>
        <div className={styles.topbarSpacer} />
      </header>

      {/* ── Desktop sidebar ── */}
      <div className={`${styles.sidebarDesktop} ${collapsed ? styles.sidebarDesktopCollapsed : ''}`}>
        <SidebarContent allowCollapse />
      </div>

      {/* ── Mobile sidebar drawer ── */}
      {sidebarOpen && (
        <>
          <div
            className={styles.backdrop}
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className={styles.sidebarMobile}>
            <button
              className={styles.closeBtn}
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <CloseCircle size={22} color="currentColor" variant="Bold" />
            </button>
            <SidebarContent />
          </div>
        </>
      )}

      {/* ── Page content ── */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
