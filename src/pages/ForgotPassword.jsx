import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Sms } from 'iconsax-react'
import logoLight from '../assets/logo-light.svg'
import logoDark  from '../assets/logo-dark.svg'
import { useAuth } from '../context/AuthContext'
import styles from './SignIn.module.css'

export default function ForgotPassword({ isDark }) {
  const navigate  = useNavigate()
  const { resetPassword } = useAuth()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const canSubmit = email.trim().includes('@')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setErrorMsg('')
    const { error } = await resetPassword(email.trim())
    setLoading(false)
    if (error) {
      setErrorMsg(error.message ?? 'Could not send reset link. Please try again.')
    } else {
      setSent(true)
    }
  }

  return (
    <div className={styles.page}>
      <img
        src={isDark ? logoDark : logoLight}
        alt="QwikHub"
        className={styles.logo}
      />

      {!sent ? (
        <div className={styles.card}>
          <h1 className={styles.heading}>Forgot password?</h1>
          <p className={styles.subtext}>
            No worries — enter your email and we'll send you a link to reset your password.
          </p>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="fp-email">Email address</label>
              <input
                id="fp-email"
                type="email"
                className={styles.input}
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>

            {errorMsg && <p className={styles.errorText} style={{ textAlign: 'center' }}>{errorMsg}</p>}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!canSubmit || loading}
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.successIconWrap}>
            <Sms size={32} color="#FFCC08" variant="Bold" />
          </div>
          <h1 className={styles.heading}>Check your email</h1>
          <p className={styles.subtext}>
            We sent a password reset link to <strong>{email}</strong>. Click the link in the email to set a new password.
          </p>
          <button
            className={styles.submitBtn}
            style={{ marginTop: 8 }}
            onClick={() => navigate('/signin')}
          >
            Back to Sign In
          </button>
        </div>
      )}

      <p className={styles.switchText}>
        Remembered it?{' '}
        <Link to="/signin" className={styles.switchLink}>Sign In</Link>
      </p>
    </div>
  )
}
