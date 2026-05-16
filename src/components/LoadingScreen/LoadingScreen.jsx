import logoLight from '../../assets/logo-light.svg'
import logoDark  from '../../assets/logo-dark.svg'

export default function LoadingScreen() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20,
      background: 'var(--color-bg)',
      zIndex: 9999,
    }}>
      <img
        src={isDark ? logoDark : logoLight}
        alt="QwikHub"
        style={{ height: 28, opacity: 0.9 }}
      />
      <div style={{
        width: 32, height: 32,
        borderRadius: '50%',
        border: '3px solid var(--color-border)',
        borderTopColor: '#FFCC08',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
