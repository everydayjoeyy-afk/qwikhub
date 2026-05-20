import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { HambergerMenu, CloseCircle, MoneyRecive, LogoutCurve, ShoppingBag, People } from 'iconsax-react'
import { useAuth } from '../context/AuthContext'
import logoLight from '../assets/logo-light.svg'
import logoDark  from '../assets/logo-dark.svg'
import styles from './AdminLayout.module.css'

const NAV = [
  { to: '/admin/withdrawals', label: 'Withdrawals', Icon: MoneyRecive },
  { to: '/admin/orders',      label: 'Orders',      Icon: ShoppingBag  },
  { to: '/admin/users',       label: 'Users',       Icon: People       },
]

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

  const handleSignOut = () => {
    signOut()
    navigate('/admin/signin', { replace: true })
  }

  const SidebarContent = () => (
    <div className={styles.sidebar}>
      <div className={styles.sidebarTop}>
        <div className={styles.brand}>
          <img src={isDark ? logoDark : logoLight} alt="QwikHub" className={styles.logo} />
          <span className={styles.adminBadge}>Admin</span>
        </div>

        <nav>
          <ul className={styles.navList}>
            {NAV.map(({ to, label, Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={17} color="currentColor" variant="Bold" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className={styles.sidebarFooter}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            {(profile?.name ?? 'A').charAt(0).toUpperCase()}
          </div>
          <div className={styles.userMeta}>
            <span className={styles.userName}>{profile?.name ?? 'Admin'}</span>
            <span className={styles.userEmail}>{profile?.email ?? ''}</span>
          </div>
        </div>
        <button className={styles.signOutBtn} onClick={handleSignOut} aria-label="Sign out">
          <LogoutCurve size={17} color="currentColor" />
        </button>
      </div>
    </div>
  )

  return (
    <div className={styles.shell}>

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
      <div className={styles.sidebarDesktop}>
        <SidebarContent />
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
