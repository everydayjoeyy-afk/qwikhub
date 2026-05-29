import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AdminGuard from './AdminGuard'
import AdminSignIn from './AdminSignIn'
import AdminLayout from './AdminLayout'
import AdminWithdrawals  from './pages/AdminWithdrawals'
import AdminOrders       from './pages/AdminOrders'
import AdminStorefrontOrders from './pages/AdminStorefrontOrders'
import AdminUsers        from './pages/AdminUsers'
import AdminDashboard    from './pages/AdminDashboard'
import AdminTransactions  from './pages/AdminTransactions'
import AdminTopups        from './pages/AdminTopups'
import AdminStoreOverview  from './pages/AdminStoreOverview'
import AdminFailedOrders    from './pages/AdminFailedOrders'
import AdminSubscriptions   from './pages/AdminSubscriptions'

export default function AdminApp({ theme }) {
  // Keep the same data-theme in sync so CSS variables work correctly
  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div data-theme={theme} style={{ minHeight: '100%' }}>
      <Routes>
        <Route path="/admin/signin" element={<AdminSignIn />} />

        <Route
          path="/admin"
          element={
            <AdminGuard>
              <AdminLayout />
            </AdminGuard>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard"    element={<AdminDashboard />} />
          <Route path="withdrawals"  element={<AdminWithdrawals />} />
          <Route path="orders"       element={<AdminOrders />} />
          <Route path="storefront-orders" element={<AdminStorefrontOrders />} />
          <Route path="transactions" element={<AdminTransactions />} />
          <Route path="topups"       element={<AdminTopups />} />
          <Route path="store"        element={<AdminStoreOverview />} />
          <Route path="failed"        element={<AdminFailedOrders />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="users"         element={<AdminUsers />} />
        </Route>
      </Routes>
    </div>
  )
}
