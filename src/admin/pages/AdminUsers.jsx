import { useState, useEffect, useRef } from 'react'
import { SearchNormal1, CloseCircle, Shop } from 'iconsax-react'
import { adminSearchUsers, adminGetUserTransactions, adminDeleteUser } from '../lib/adminDb'
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

// ── Pagination ────────────────────────────────────────────────────
function Pagination({ page, totalPages, total, pageSize, start, onPage, onPageSize }) {
  const end = Math.min(start + pageSize, total)
  const lo  = Math.max(1, Math.min(page - 2, totalPages - 4))
  const hi  = Math.min(totalPages, lo + 4)
  const pages = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

  return (
    <div className={styles.pagination}>
      <span className={styles.paginationInfo}>
        Showing {total === 0 ? 0 : start + 1} to {end} of {total} users
      </span>
      <div className={styles.paginationControls}>
        <select
          value={pageSize}
          onChange={e => { onPageSize(Number(e.target.value)) }}
          className={styles.pageSizeSelect}
        >
          {[10, 20, 50].map(n => <option key={n} value={n}>{n} per page</option>)}
        </select>
        <button className={styles.pageBtn} onClick={() => onPage(page - 1)} disabled={page === 1}>‹</button>
        {pages.map(p => (
          <button
            key={p}
            className={`${styles.pageBtn} ${page === p ? styles.pageBtnActive : ''}`}
            onClick={() => onPage(p)}
          >{p}</button>
        ))}
        <button className={styles.pageBtn} onClick={() => onPage(page + 1)} disabled={page >= totalPages}>›</button>
      </div>
    </div>
  )
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

  return (
    <div className={styles.detail}>
      <button className={styles.detailClose} onClick={onClose} aria-label="Close">
        <CloseCircle size={22} color="currentColor" variant="Bold" />
      </button>

      {/* Profile header */}
      <div className={styles.detailHeader}>
        <div className={styles.detailAvatar}>{initials(user.name ?? user.phone ?? '?')}</div>
        <div className={styles.detailMeta}>
          <div className={styles.detailNameRow}>
            <span className={styles.detailName}>{user.name ?? '—'}</span>
            {user.is_admin && <span className={styles.badgeAdmin}>Admin</span>}
          </div>
          <span className={styles.detailPhone}>{user.phone ?? '—'}</span>
          {user.email && <span className={styles.detailEmail}>{user.email}</span>}
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

      {/* Transactions */}
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
                  {tx.type === 'credit' ? '↑' : '↓'}
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

// ── Delete confirmation modal ─────────────────────────────────────
function DeleteConfirmModal({ user, onConfirm, onCancel, deleting, error }) {
  if (!user) return null
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalIcon}>⚠</div>
        <h2 className={styles.modalTitle}>Delete user?</h2>
        <p className={styles.modalBody}>
          This will permanently delete <strong>{user.name ?? user.phone ?? 'this user'}</strong> and all their data.
          This action <strong>cannot be undone.</strong>
        </p>
        {error && <p className={styles.modalError}>{error}</p>}
        <div className={styles.modalActions}>
          <button className={styles.modalCancelBtn} onClick={onCancel} disabled={deleting}>
            Cancel
          </button>
          <button className={styles.modalDeleteBtn} onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Yes, delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export default function AdminUsers() {
  const [query,       setQuery]       = useState('')
  const [users,       setUsers]       = useState([])
  const [loading,     setLoading]     = useState(false)
  const [selected,    setSelected]    = useState(null)
  const [openMenu,    setOpenMenu]    = useState(null)
  const [page,        setPage]        = useState(1)
  const [pageSize,    setPageSize]    = useState(10)
  const [confirmUser, setConfirmUser] = useState(null)  // user pending delete confirm
  const [deleting,    setDeleting]    = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const debounceRef = useRef(null)

  useEffect(() => { search('') }, [])

  function search(q) {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const { data } = await adminSearchUsers(q)
      setUsers(Array.isArray(data) ? data : [])
      setLoading(false)
      setPage(1)
    }, q ? 400 : 0)
  }

  function handleQueryChange(e) {
    const q = e.target.value
    setQuery(q)
    search(q)
  }

  async function handleDeleteConfirm() {
    if (!confirmUser) return
    setDeleting(true); setDeleteError('')
    const { error } = await adminDeleteUser(confirmUser.id)
    setDeleting(false)
    if (error) { setDeleteError(error.message); return }
    // Remove from local list + close panels
    setUsers(prev => prev.filter(u => u.id !== confirmUser.id))
    if (selected?.id === confirmUser.id) setSelected(null)
    setConfirmUser(null)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openMenu) return
    const close = () => setOpenMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openMenu])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(users.length / pageSize))
  const start = (page - 1) * pageSize
  const paged = users.slice(start, start + pageSize)

  return (
    <div className={styles.page}>

      {/* Page header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>User Management</h1>
          <p className={styles.pageSubtitle}>All registered platform users</p>
        </div>
      </div>

      {/* Search toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <SearchNormal1 size={15} color="var(--color-text-tertiary)" className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by name, phone or email…"
            value={query}
            onChange={handleQueryChange}
            autoFocus
          />
          {loading && <span className={styles.searchSpin} />}
        </div>
      </div>

      {/* Table card */}
      <div className={styles.tableCard}>

        {/* Table header bar */}
        <div className={styles.tableHeaderBar}>
          <span className={styles.tableCount}>
            Users ({loading ? '…' : users.length})
          </span>
        </div>

        {loading ? (
          <div className={styles.centred}><span className={styles.spin} /></div>
        ) : users.length === 0 ? (
          <div className={styles.centred}>
            <p className={styles.emptyText}>
              {query ? 'No users match your search' : 'No users yet'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: 48 }}></th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Wallet</th>
                    <th>Earnings</th>
                    <th>Joined</th>
                    <th style={{ width: 72 }}>Status</th>
                    <th style={{ width: 56 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(u => (
                    <tr
                      key={u.id}
                      className={selected?.id === u.id ? styles.rowSelected : ''}
                      onClick={() => setSelected(u)}
                    >
                      <td>
                        <div className={styles.avatar}>{initials(u.name ?? u.phone ?? '?')}</div>
                      </td>
                      <td>
                        <div className={styles.nameCell}>
                          <span className={styles.userName}>{u.name ?? '—'}</span>
                          <div className={styles.badgeRow}>
                            {u.is_admin   && <span className={styles.badgeAdmin}>Admin</span>}
                            {u.store_name && <span className={styles.badgeStore}><Shop size={9} color="currentColor" variant="Bold" /> Store</span>}
                          </div>
                        </div>
                      </td>
                      <td className={styles.monoCell}>{u.phone ?? '—'}</td>
                      <td className={styles.amountCell}>₵{Number(u.wallet_balance   ?? 0).toFixed(2)}</td>
                      <td className={styles.amountCell}>₵{Number(u.earnings_balance ?? 0).toFixed(2)}</td>
                      <td className={styles.dimCell}>{joinedDate(u.created_at)}</td>
                      <td>
                        <span className={styles.statusBadge} data-active="true">Active</span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className={styles.actionsCell}>
                          <button
                            className={styles.menuTrigger}
                            onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === u.id ? null : u.id) }}
                            aria-label="Actions"
                          >⋯</button>
                          {openMenu === u.id && (
                            <div className={styles.menuDropdown}>
                              <button onClick={() => { setSelected(u); setOpenMenu(null) }}>View</button>
                              <button
                                className={styles.menuItemDelete}
                                onClick={() => { setConfirmUser(u); setOpenMenu(null) }}
                              >Delete</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className={styles.cards}>
              {paged.map(u => (
                <div key={u.id} className={styles.mobileCard} onClick={() => setSelected(u)}>
                  <div className={styles.avatar}>{initials(u.name ?? u.phone ?? '?')}</div>
                  <div className={styles.mobileCardBody}>
                    <div className={styles.mobileCardTop}>
                      <span className={styles.userName}>{u.name ?? '—'}</span>
                      <div className={styles.badgeRow}>
                        {u.is_admin   && <span className={styles.badgeAdmin}>Admin</span>}
                        {u.store_name && <span className={styles.badgeStore}><Shop size={9} color="currentColor" variant="Bold" /> Store</span>}
                      </div>
                    </div>
                    <span className={styles.dimCell}>{u.phone ?? '—'}</span>
                  </div>
                  <div className={styles.mobileCardRight}>
                    <span className={styles.amountCell}>₵{Number(u.wallet_balance ?? 0).toFixed(2)}</span>
                    <span className={styles.dimCell} style={{ fontSize: 10 }}>wallet</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              page={page}
              totalPages={totalPages}
              total={users.length}
              pageSize={pageSize}
              start={start}
              onPage={setPage}
              onPageSize={n => { setPageSize(n); setPage(1) }}
            />
          </>
        )}
      </div>

      {/* Detail panel overlay */}
      {selected && (
        <>
          <div className={styles.detailOverlay} onClick={() => setSelected(null)} />
          <div className={styles.detailPanel}>
            <UserDetail user={selected} onClose={() => setSelected(null)} />
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        user={confirmUser}
        onConfirm={handleDeleteConfirm}
        onCancel={() => { setConfirmUser(null); setDeleteError('') }}
        deleting={deleting}
        error={deleteError}
      />
    </div>
  )
}
