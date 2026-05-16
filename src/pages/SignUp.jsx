import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeSlash, Lock1 } from 'iconsax-react'
import logoLight from '../assets/logo-light.svg'
import logoDark  from '../assets/logo-dark.svg'
import { useAuth } from '../context/AuthContext'
import styles from './SignIn.module.css'

export default function SignUp({ isDark }) {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref') ?? ''

  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [phone, setPhone]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [referral, setReferral]   = useState(refCode)
  const [showPass, setShowPass]   = useState(false)
  const [showConf, setShowConf]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [errorMsg, setErrorMsg]   = useState('')

  const refLocked = refCode !== ''

  const canSubmit =
    name.trim() !== '' &&
    email.trim() !== '' &&
    phone.trim().length >= 10 &&
    password.length >= 6 &&
    confirm === password

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setErrorMsg('')
    const { error } = await signUp({
      email:        email.trim(),
      password,
      name:         name.trim(),
      phone:        phone.trim(),
      referralCode: referral.trim() || null,
    })
    setLoading(false)
    if (error) {
      setErrorMsg(error.message ?? 'Sign up failed. Please try again.')
    } else {
      navigate('/')
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
        <h1 className={styles.heading}>Create account</h1>
        <p className={styles.subtext}>Join QwikHub for great offers</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>

          {/* Full name */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="name">Full name</label>
            <input
              id="name"
              type="text"
              className={styles.input}
              placeholder="Joel Fofoh"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          {/* Email */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="su-email">Email</label>
            <input
              id="su-email"
              type="email"
              className={styles.input}
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          {/* Phone */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="phone">Phone number</label>
            <input
              id="phone"
              type="tel"
              className={styles.input}
              placeholder="0244 123 456"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              autoComplete="tel"
              maxLength={15}
            />
          </div>

          {/* Password */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="sig-password">Password</label>
            <div className={styles.inputWrap}>
              <input
                id="sig-password"
                type={showPass ? 'text' : 'password'}
                className={`${styles.input} ${styles.inputWithIcon}`}
                placeholder="Min. 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
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

          {/* Confirm password */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="confirm">Confirm password</label>
            <div className={styles.inputWrap}>
              <input
                id="confirm"
                type={showConf ? 'text' : 'password'}
                className={`${styles.input} ${styles.inputWithIcon} ${confirm && confirm !== password ? styles.inputError : ''}`}
                placeholder="Repeat password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowConf(p => !p)}
                aria-label={showConf ? 'Hide password' : 'Show password'}
              >
                {showConf
                  ? <EyeSlash size={18} color="currentColor" variant="Bold" />
                  : <Eye      size={18} color="currentColor" variant="Bold" />}
              </button>
            </div>
            {confirm && confirm !== password && (
              <span className={styles.errorText}>Passwords don't match</span>
            )}
          </div>

          {/* Referral code */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="referral">
              Referral code
              {refLocked && <span className={styles.refBadge}>Applied</span>}
            </label>
            <div className={styles.inputWrap}>
              <input
                id="referral"
                type="text"
                className={`${styles.input} ${styles.inputWithIcon} ${refLocked ? styles.inputLocked : ''}`}
                placeholder="Optional"
                value={referral}
                onChange={e => !refLocked && setReferral(e.target.value.toUpperCase())}
                readOnly={refLocked}
                maxLength={20}
              />
              {refLocked && (
                <span className={styles.lockIcon}>
                  <Lock1 size={16} color="currentColor" variant="Bold" />
                </span>
              )}
            </div>
          </div>

          {errorMsg && <p className={styles.errorText} style={{ textAlign: 'center' }}>{errorMsg}</p>}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!canSubmit || loading}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
      </div>

      <p className={styles.switchText}>
        Already have an account?{' '}
        <Link to="/signin" className={styles.switchLink}>Sign In</Link>
      </p>
    </div>
  )
}
