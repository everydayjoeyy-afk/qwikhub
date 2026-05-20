import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AdminGuard from './AdminGuard'
import AdminSignIn from './AdminSignIn'
import AdminLayout from './AdminLayout'
import AdminWithdrawals from './pages/AdminWithdrawals'

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
          {/* Default: redirect /admin → /admin/withdrawals */}
          <Route index element={<Navigate to="/admin/withdrawals" replace />} />
          <Route path="withdrawals" element={<AdminWithdrawals />} />
        </Route>
      </Routes>
    </div>
  )
}
