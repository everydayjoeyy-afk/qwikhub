import { useNavigate } from 'react-router-dom'
import { Gift, Shop } from 'iconsax-react'
import styles from './QuickActions.module.css'

const ACTIONS = [
  { id: 'earn',  label: 'Earn',  icon: Gift, bg: '#000000', iconColor: '#ffffff', path: '/refer' },
  { id: 'store', label: 'Store', icon: Shop, bg: '#FFCC08', iconColor: '#000000', path: '/store' },
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
