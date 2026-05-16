import { useNavigate } from 'react-router-dom'
import { Box, Receipt1, Shop } from 'iconsax-react'
import styles from './QuickActions.module.css'

const ACTIONS = [
  { id: 'bundle',       label: 'Bundle',        icon: Box,      bg: '#000000', iconColor: '#ffffff', path: '/bundles'      },
  { id: 'subscription', label: 'Subscriptions', icon: Receipt1, bg: '#FFCC08', iconColor: '#000000', path: '/subscription' },
  { id: 'store',        label: 'Store',         icon: Shop,     bg: '#FFCC08', iconColor: '#000000', path: '/store'        },
]

export default function QuickActions() {
  const navigate = useNavigate()

  return (
    <div className={styles.card}>
      {ACTIONS.map((action, i) => (
        <div key={action.id} className={styles.cell}>
          <button className={styles.item} onClick={() => navigate(action.path)}>
            <span className={styles.iconWrap} style={{ background: action.bg }}>
              <action.icon size={22} color={action.iconColor} variant="Bold" />
            </span>
            <span className={styles.label}>{action.label}</span>
          </button>
          {i < ACTIONS.length - 1 && <span className={styles.divider} />}
        </div>
      ))}
    </div>
  )
}
