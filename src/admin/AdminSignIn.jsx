import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeSlash } from 'iconsax-react'
import { useAuth } from '../context/AuthContext'
import logoLight from '../assets/logo-light.svg'
import logoDark  from '../assets/logo-dark.svg'
import styles from './AdminSignIn.module.css'

export default function AdminSignIn() {
  const { signIn, signOut, user, profile, loading } = useAuth()
  const navigate = useNavigate()

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPass,   setShowPass]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg,   setErrorMsg]   = useState('')

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

  // Once auth state resolves, redirect if already admin or show error if not
  useEffect(() => {
    if (loading) return
    if (user && profile?.is_admin) {
      navigate('/admin/withdrawals', { replace: true })
    } else if (user && profile && !profile.is_admin) {
      // Signed in but not an admin — sign them out and show error
      setErrorMsg('This account does not have admin access.')
      signOut()
    }
  }, [user, profile, loading, navigate, signOut])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { setErrorMsg('Please enter your email and password.'); return }
    setSubmitting(true)
    setErrorMsg('')
    const { error } = await signIn(email.trim(), password)
    setSubmitting(false)
    if (error) setErrorMsg('Invalid email or password.')
    // On success: the useEffect above handles redirect once profile loads
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <img src={isDark ? logoDark : logoLight} alt="QwikHub" className={styles.logo} />
          <span className={styles.adminBadge}>Admin</span>
        </div>

        <h1 className={styles.heading}>Admin Sign In</h1>
        <p className={styles.subtext}>Restricted to authorised QwikHub staff</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="adm-email">Email</label>
            <input
              id="adm-email"
              type="email"
              className={styles.input}
              placeholder="admin@qwikhub.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="adm-password">Password</label>
            <div className={styles.inputWrap}>
              <input
                id="adm-password"
                type={showPass ? 'text' : 'password'}
                className={`${styles.input} ${styles.inputWithIcon}`}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPass(p => !p)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass
                  ? <EyeSlash size={18} color="currentColor" variant="Bold" />
                  : <Eye      size={18} color="currentColor" variant="Bold" />}
              </button>
            </div>
          </div>

          {errorMsg && <p className={styles.errorText}>{errorMsg}</p>}

          <button type="submit" className={styles.submitBtn} disabled={submitting || loading}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
