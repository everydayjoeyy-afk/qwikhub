import { useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeSlash, Lock1 } from 'iconsax-react'
import logoLight from '../assets/logo-light.svg'
import logoDark  from '../assets/logo-dark.svg'
import { useAuth } from '../context/AuthContext'
import styles from './SignIn.module.css'

// Ghana mobile: 10 digits starting with 02X or 05X (strips spaces/dashes first)
function isValidGhanaPhone(raw) {
  const digits = raw.replace(/[\s\-]/g, '')
  return /^0(2[0-9]|5[0-9])\d{7}$/.test(digits)
}

// Stricter email: local@domain.tld (tld ≥ 2 chars)
function isValidEmail(raw) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim())
}

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

  const rules = [
    { label: 'Uppercase letter',              met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter',              met: /[a-z]/.test(password) },
    { label: 'Number',                        met: /[0-9]/.test(password) },
    { label: 'Special character (e.g. !?<>@#$%)', met: /[^A-Za-z0-9]/.test(password) },
    { label: '8 characters or more',          met: password.length >= 8  },
  ]
  const passwordStrong = rules.every(r => r.met)

  const canSubmit =
    name.trim() !== '' &&
    isValidEmail(email) &&
    isValidGhanaPhone(phone) &&
    passwordStrong &&
    confirm === password

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    if (!name.trim())                { setErrorMsg('Please enter your full name.'); return }
    if (!isValidEmail(email))        { setErrorMsg('Please enter a valid email address (e.g. you@example.com).'); return }
    if (!isValidGhanaPhone(phone))   { setErrorMsg('Please enter a valid Ghana mobile number (e.g. 0241234567).'); return }
    if (!passwordStrong)                  { setErrorMsg('Password does not meet all requirements.'); return }
    if (confirm !== password)             { setErrorMsg("Passwords don't match."); return }
    setLoading(true)
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
              placeholder="John Doe"
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
            {email.length > 0 && !isValidEmail(email) && (
              <span className={styles.errorText}>Enter a valid email address</span>
            )}
          </div>

          {/* Phone */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="phone">Phone number</label>
            <input
              id="phone"
              type="tel"
              className={styles.input}
              placeholder="e.g. 0241234567"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              autoComplete="tel"
              maxLength={15}
              inputMode="tel"
            />
            {phone.length > 0 && !isValidGhanaPhone(phone) && (
              <span className={styles.errorText}>Enter a valid Ghana number (e.g. 0241234567)</span>
            )}
          </div>

          {/* Password */}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="sig-password">Password</label>
            <div className={styles.inputWrap}>
              <input
                id="sig-password"
                type={showPass ? 'text' : 'password'}
                className={`${styles.input} ${styles.inputWithIcon}`}
                placeholder="Min. 8 characters"
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

            {/* Password strength checklist — only show once user starts typing */}
            {password.length > 0 && (
              <ul className={styles.pwRules} aria-live="polite" aria-label="Password requirements">
                {rules.map(rule => (
                  <li key={rule.label} className={rule.met ? styles.pwRuleMet : styles.pwRuleUnmet}>
                    <span className={styles.pwRuleIcon}>{rule.met ? '✓' : '○'}</span>
                    {rule.label}
                  </li>
                ))}
              </ul>
            )}
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
              {refLocked
                ? <span className={styles.refBadge}>Applied</span>
                : <span className={styles.optionalTag}>optional</span>}
            </label>
            <div className={styles.inputWrap}>
              <input
                id="referral"
                type="text"
                className={`${styles.input} ${styles.inputWithIcon} ${refLocked ? styles.inputLocked : ''}`}
                placeholder="e.g. ABC123"
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
            disabled={loading}
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
