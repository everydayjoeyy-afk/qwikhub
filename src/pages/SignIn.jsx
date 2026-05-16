import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeSlash } from 'iconsax-react'
import logoLight from '../assets/logo-light.svg'
import logoDark  from '../assets/logo-dark.svg'
import { useAuth } from '../context/AuthContext'
import styles from './SignIn.module.css'

export default function SignIn({ isDark }) {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [slow, setSlow]           = useState(false)
  const [errorMsg, setErrorMsg]   = useState('')

  const canSubmit = email.trim() !== '' && password.length >= 6

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setSlow(false)
    setErrorMsg('')

    // Show a "still working" nudge after 10 s so the user knows it hasn't frozen
    const slowTimer = setTimeout(() => setSlow(true), 10000)

    try {
      const { error } = await signIn(email.trim(), password)
      clearTimeout(slowTimer)
      setLoading(false)
      setSlow(false)
      if (error) {
        setErrorMsg(error.message ?? 'Sign in failed. Please try again.')
      } else {
        navigate('/')
      }
    } catch (err) {
      clearTimeout(slowTimer)
      setLoading(false)
      setSlow(false)
      setErrorMsg(err.message ?? 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className={styles.page}>
      <img
        src={isDark ? logoDark : logoLight}
        alt="QwikHub"
        className={styles.logo}
      />

      <div className={styles.card}>
        <h1 className={styles.heading}>Hey you're back</h1>
        <p className={styles.subtext}>Fill in your details to get back in</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={styles.input}
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="password">Password</label>
            <div className={styles.inputWrap}>
              <input
                id="password"
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
            <div className={styles.forgotRow}>
              <Link to="/forgot-password" className={styles.forgotLink}>Forgot Password?</Link>
            </div>
          </div>

          {slow && !errorMsg && (
            <p className={styles.subtext} style={{ textAlign: 'center', fontSize: 13 }}>
              Still connecting… your sign-in is being processed, please wait.
            </p>
          )}
          {errorMsg && <p className={styles.errorText} style={{ textAlign: 'center' }}>{errorMsg}</p>}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!canSubmit || loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>

      <p className={styles.switchText}>
        Don't have an account?{' '}
        <Link to="/signup" className={styles.switchLink}>Sign Up</Link>
      </p>
    </div>
  )
}
