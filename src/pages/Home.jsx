import { useState } from 'react'
import { MessageQuestion } from 'iconsax-react'
import BalanceCard from '../components/BalanceCard/BalanceCard'
import QuickActions from '../components/QuickActions/QuickActions'
import BundleList from '../components/BundleList/BundleList'
import RecentTransactions from '../components/RecentTransactions/RecentTransactions'
import AddMoneyModal from '../components/AddMoneyModal/AddMoneyModal'
import ComplaintModal from '../components/ComplaintModal/ComplaintModal'
import { useAuth } from '../context/AuthContext'

export default function Home({ greeting, firstName }) {
  const [addMoneyOpen, setAddMoneyOpen] = useState(false)
  const [complaintOpen, setComplaintOpen] = useState(false)
  const [txKey, setTxKey] = useState(0)
  const { profile, refetchProfile } = useAuth()

  const balance = profile?.wallet_balance ?? 0

  const handlePaymentSuccess = () => {
    setTxKey(k => k + 1)  // force RecentTransactions to re-fetch
  }

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

      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
        <button
          onClick={() => setComplaintOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: 'transparent',
            border: '1.5px solid var(--color-border)',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <MessageQuestion size={16} color="currentColor" variant="Bold" />
          Have an issue?
        </button>
      </div>

      <RecentTransactions txKey={txKey} />

      <AddMoneyModal
        open={addMoneyOpen}
        onClose={() => setAddMoneyOpen(false)}
        onPaymentSuccess={handlePaymentSuccess}
      />
      <ComplaintModal
        open={complaintOpen}
        onClose={() => setComplaintOpen(false)}
      />
    </>
  )
}
