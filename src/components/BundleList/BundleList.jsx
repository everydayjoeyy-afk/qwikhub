import { useNavigate } from 'react-router-dom'
import { ArrowRight2 } from 'iconsax-react'
import styles from './BundleList.module.css'
import mtn from '../../assets/mtn.jpg'
import telecel from '../../assets/telecel.jpg'
import tigo from '../../assets/tigo.jpg'

const BUNDLES = [
  { id: 'mtn',     label: 'Buy MTN Bundles',       logo: mtn     },
  { id: 'telecel', label: 'Buy Telecel Bundles',    logo: telecel },
  { id: 'tigo',    label: 'Buy AirtelTigo Bundles', logo: tigo    },
]

export default function BundleList() {
  const navigate = useNavigate()

  return (
    <div className={styles.list}>
      {BUNDLES.map((bundle) => (
        <button
          key={bundle.id}
          className={styles.card}
          onClick={() => navigate(`/bundles/${bundle.id}`)}
        >
          <img src={bundle.logo} alt={bundle.id} className={styles.logo} />
          <span className={styles.label}>{bundle.label}</span>
          <ArrowRight2 size={18} color="currentColor" className={styles.chevron} />
        </button>
      ))}
    </div>
  )
}
