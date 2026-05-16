import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeSlash, TickCircle } from 'iconsax-react'
import logoLight from '../assets/logo-light.svg'
import logoDark  from '../assets/logo-dark.svg'
import { supabase } from '../lib/supabase'
import styles from './SignIn.module.css'

export default function ResetPassword({ isDark }) {
  const navigate = useNavigate()

  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [showConf, setShowConf]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const [errorMsg, setErrorMsg]   = useState('')

  // Manually exchange the recovery code from the URL for a session
  useEffect(() => {
    async function setupSession() {
      // 1. Check if a session already exists
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { setSessionReady(true); return }

      // 2. Try to exchange ?code= from the URL (Supabase PKCE flow)
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setSessionError('This reset link has expired or already been used. Please request a new one.')
        } else {
          setSessionReady(true)
        }
        return
      }

      // 3. No code found — link is invalid
      setSessionError('Invalid reset link. Please request a new one.')
    }

    setupSession()
  }, [])

  const mismatch  = confirm.length > 0 && confirm !== password
  const canSubmit = password.length >= 6 && confirm === password

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setErrorMsg('')

    try {
      const { error } = await supabase.auth.updateUser({ password })
      setLoading(false)
      if (error) {
        setErrorMsg(error.message ?? 'Could not update password. Please try again.')
      } else {
        setDone(true)
      }
    } catch (err) {
      setLoading(false)
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

      {!done ? (
        <div className={styles.card}>
          <h1 className={styles.heading}>New password</h1>

          {/* Still exchanging the code */}
          {!sessionReady && !sessionError && (
            <p className={styles.subtext} style={{ textAlign: 'center' }}>
              Verifying reset link…
            </p>
          )}

          {/* Link expired or invalid */}
          {sessionError && (
            <>
              <p className={styles.errorText} style={{ textAlign: 'center', marginTop: 8 }}>
                {sessionError}
              </p>
              <Link to="/forgot-password" className={styles.submitBtn}
                style={{ display: 'block', textAlign: 'center', marginTop: 16, textDecoration: 'none' }}>
                Request new link
              </Link>
            </>
          )}

          {/* Session ready — show the form */}
          {sessionReady && (
            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <p className={styles.subtext}>
                Choose a strong password — at least 6 characters.
              </p>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="new-password">New password</label>
                <div className={styles.inputWrap}>
                  <input
                    id="new-password"
                    type={showPass ? 'text' : 'password'}
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button type="button" className={styles.eyeBtn}
                    onClick={() => setShowPass(p => !p)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}>
                    {showPass
                      ? <EyeSlash size={18} color="currentColor" variant="Bold" />
                      : <Eye      size={18} color="currentColor" variant="Bold" />}
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="confirm-password">Confirm new password</label>
                <div className={styles.inputWrap}>
                  <input
                    id="confirm-password"
                    type={showConf ? 'text' : 'password'}
                    className={`${styles.input} ${styles.inputWithIcon} ${mismatch ? styles.inputError : ''}`}
                    placeholder="Repeat password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" className={styles.eyeBtn}
                    onClick={() => setShowConf(p => !p)}
                    aria-label={showConf ? 'Hide password' : 'Show password'}>
                    {showConf
                      ? <EyeSlash size={18} color="currentColor" variant="Bold" />
                      : <Eye      size={18} color="currentColor" variant="Bold" />}
                  </button>
                </div>
                {mismatch && <span className={styles.errorText}>Passwords don't match</span>}
              </div>

              {errorMsg && (
                <p className={styles.errorText} style={{ textAlign: 'center' }}>{errorMsg}</p>
              )}

              <button type="submit" className={styles.submitBtn} disabled={!canSubmit || loading}>
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.successIconWrap}>
            <TickCircle size={52} color="#FFCC08" variant="Bold" />
          </div>
          <h1 className={styles.heading}>Password updated!</h1>
          <p className={styles.subtext}>
            Your password has been changed. Sign in with your new password.
          </p>
          <button className={styles.submitBtn} style={{ marginTop: 8 }}
            onClick={() => navigate('/signin')}>
            Sign In
          </button>
        </div>
      )}
    </div>
  )
}
