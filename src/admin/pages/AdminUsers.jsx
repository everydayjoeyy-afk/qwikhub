import { useState, useEffect, useRef } from 'react'
import { SearchNormal1, CloseCircle, Shop, ArrowUp2, ArrowDown2 } from 'iconsax-react'
import { adminSearchUsers, adminGetUserTransactions } from '../lib/adminDb'
import styles from './AdminUsers.module.css'

// ── Helpers ──────────────────────────────────────────────────────
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30)  return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function joinedDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function initials(name = '') {
  const parts = name.trim().split(' ')
  return parts.length > 1
    ? parts[0][0].toUpperCase() + parts[1][0].toUpperCase()
    : (parts[0]?.[0] ?? '?').toUpperCase()
}

function txIcon(type) {
  return type === 'credit' ? '↑' : '↓'
}

// ── User detail panel ─────────────────────────────────────────────
function UserDetail({ user, onClose }) {
  const [transactions, setTransactions] = useState([])
  const [txLoading,    setTxLoading]    = useState(true)

  useEffect(() => {
    if (!user) return
    setTxLoading(true)
    adminGetUserTransactions(user.id).then(({ data }) => {
      setTransactions(Array.isArray(data) ? data : [])
      setTxLoading(false)
    })
  }, [user?.id])

  if (!user) {
    return (
      <div className={styles.detailEmpty}>
        <SearchNormal1 size={36} color="var(--color-text-tertiary)" />
        <p>Select a user to view their profile</p>
      </div>
    )
  }

  return (
    <div className={styles.detail}>
      {/* Close on mobile */}
      <button className={styles.detailClose} onClick={onClose} aria-label="Close">
        <CloseCircle size={22} color="currentColor" variant="Bold" />
      </button>

      {/* Profile header */}
      <div className={styles.detailHeader}>
        <div className={styles.detailAvatar}>{initials(user.name ?? user.phone ?? '?')}</div>
        <div className={styles.detailMeta}>
          <div className={styles.detailNameRow}>
            <span className={styles.detailName}>{user.name ?? '—'}</span>
            {user.is_admin && <span className={styles.adminBadge}>Admin</span>}
          </div>
          <span className={styles.detailPhone}>{user.phone ?? '—'}</span>
          <span className={styles.detailEmail}>{user.email ?? '—'}</span>
          <span className={styles.detailJoined}>Joined {joinedDate(user.created_at)}</span>
        </div>
      </div>

      {/* Balances */}
      <div className={styles.balanceRow}>
        <div className={styles.balanceCard}>
          <span className={styles.balanceLabel}>Wallet</span>
          <span className={styles.balanceValue}>₵{Number(user.wallet_balance ?? 0).toFixed(2)}</span>
        </div>
        <div className={styles.balanceCard}>
          <span className={styles.balanceLabel}>Earnings</span>
          <span className={styles.balanceValue}>₵{Number(user.earnings_balance ?? 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Quick stats */}
      <div className={styles.quickStats}>
        <div className={styles.quickStat}>
          <span className={styles.quickStatValue}>{user.bundle_orders ?? 0}</span>
          <span className={styles.quickStatLabel}>Orders</span>
        </div>
        <div className={styles.quickStatDivider} />
        <div className={styles.quickStat}>
          <span className={styles.quickStatValue}>{user.withdrawal_count ?? 0}</span>
          <span className={styles.quickStatLabel}>Withdrawals</span>
        </div>
        <div className={styles.quickStatDivider} />
        <div className={styles.quickStat}>
          <span className={styles.quickStatValue}>{user.referral_count ?? 0}</span>
          <span className={styles.quickStatLabel}>Referrals</span>
        </div>
      </div>

      {/* Store */}
      {user.store_name && (
        <div className={styles.storeRow}>
          <Shop size={14} color="var(--color-accent)" variant="Bold" />
          <span className={styles.storeName}>{user.store_name}</span>
        </div>
      )}

      {/* Referral code */}
      <div className={styles.refRow}>
        <span className={styles.refLabel}>Referral code</span>
        <span className={styles.refCode}>{user.referral_code ?? '—'}</span>
      </div>

      {/* Recent transactions */}
      <div className={styles.txSection}>
        <span className={styles.txTitle}>Recent transactions</span>

        {txLoading ? (
          <div className={styles.txLoading}><span className={styles.spin} /></div>
        ) : transactions.length === 0 ? (
          <p className={styles.txEmpty}>No transactions yet</p>
        ) : (
          <div className={styles.txList}>
            {transactions.map(tx => (
              <div key={tx.id} className={styles.txRow}>
                <span className={`${styles.txIcon} ${tx.type === 'credit' ? styles.txCredit : styles.txDebit}`}>
                  {txIcon(tx.type)}
                </span>
                <div className={styles.txInfo}>
                  <span className={styles.txDesc}>{tx.description}</span>
                  <span className={styles.txDate}>{timeAgo(tx.created_at)}</span>
                </div>
                <span className={`${styles.txAmount} ${tx.type === 'credit' ? styles.txCredit : styles.txDebit}`}>
                  {tx.type === 'credit' ? '+' : '-'}₵{Number(tx.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function AdminUsers() {
  const [query,       setQuery]       = useState('')
  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(false)
  const [selected,    setSelected]    = useState(null)
  const [sheetOpen,   setSheetOpen]   = useState(false)
  const debounceRef = useRef(null)

  // Load recent users on mount
  useEffect(() => { search('') }, [])

  function search(q) {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const { data } = await adminSearchUsers(q)
      setUsers(Array.isArray(data) ? data : [])
      setLoading(false)
    }, q ? 400 : 0)
  }

  function handleQueryChange(e) {
    const q = e.target.value
    setQuery(q)
    search(q)
  }

  function selectUser(u) {
    setSelected(u)
    setSheetOpen(true)   // for mobile
  }

  return (
    <div className={styles.layout}>

      {/* ── Left pane: search + list ── */}
      <div className={styles.listPane}>
        <div className={styles.listHeader}>
          <h1 className={styles.pageTitle}>Users</h1>
          <p className={styles.pageSubtitle}>Search by name, phone or email</p>
        </div>

        <div className={styles.searchWrap}>
          <SearchNormal1 size={15} color="var(--color-text-tertiary)" className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="0244… or John or john@…"
            value={query}
            onChange={handleQueryChange}
            autoFocus
          />
          {loading && <span className={styles.searchSpin} />}
        </div>

        <div className={styles.listMeta}>
          {loading ? 'Searching…' : `${users.length} user${users.length !== 1 ? 's' : ''}`}
        </div>

        <div className={styles.list}>
          {users.length === 0 && !loading ? (
            <p className={styles.listEmpty}>No users found</p>
          ) : (
            users.map(u => (
              <button
                key={u.id}
                className={`${styles.userCard} ${selected?.id === u.id ? styles.userCardActive : ''}`}
                onClick={() => selectUser(u)}
              >
                <div className={styles.cardAvatar}>{initials(u.name ?? u.phone ?? '?')}</div>
                <div className={styles.cardBody}>
                  <div className={styles.cardNameRow}>
                    <span className={styles.cardName}>{u.name ?? '—'}</span>
                    {u.store_name && (
                      <span className={styles.cardStoreBadge}>
                        <Shop size={10} color="currentColor" variant="Bold" /> Store
                      </span>
                    )}
                    {u.is_admin && <span className={styles.cardAdminBadge}>Admin</span>}
                  </div>
                  <span className={styles.cardPhone}>{u.phone ?? '—'}</span>
                </div>
                <div className={styles.cardRight}>
                  <span className={styles.cardWallet}>₵{Number(u.wallet_balance ?? 0).toFixed(2)}</span>
                  <span className={styles.cardLabel}>wallet</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right pane: detail (desktop always visible) ── */}
      <div className={styles.detailPane}>
        <UserDetail user={selected} onClose={() => setSelected(null)} />
      </div>

      {/* ── Mobile: bottom sheet ── */}
      {sheetOpen && selected && (
        <>
          <div className={styles.backdrop} onClick={() => setSheetOpen(false)} />
          <div className={styles.sheet}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetContent}>
              <UserDetail
                user={selected}
                onClose={() => setSheetOpen(false)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
