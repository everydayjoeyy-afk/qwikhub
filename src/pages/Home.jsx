import { useState } from 'react'
import BalanceCard from '../components/BalanceCard/BalanceCard'
import QuickActions from '../components/QuickActions/QuickActions'
import BundleList from '../components/BundleList/BundleList'
import RecentTransactions from '../components/RecentTransactions/RecentTransactions'
import AddMoneyModal from '../components/AddMoneyModal/AddMoneyModal'
import { useAuth } from '../context/AuthContext'

export default function Home({ greeting, firstName }) {
  const [addMoneyOpen, setAddMoneyOpen] = useState(false)
  const { profile, refetchProfile } = useAuth()

  const balance = profile?.wallet_balance ?? 0

  return (
    <>
      <p style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 16,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        alignSelf: 'flex-start',
        marginBottom: 4,
      }}>
        {greeting}, {firstName}
      </p>
      <BalanceCard
        balance={balance.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        onAddMoney={() => setAddMoneyOpen(true)}
        onRefresh={refetchProfile}
      />
      <QuickActions />
      <BundleList />
      <RecentTransactions />
      <AddMoneyModal open={addMoneyOpen} onClose={() => setAddMoneyOpen(false)} />
    </>
  )
}
