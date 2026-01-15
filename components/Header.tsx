'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './Header.module.css'
import UserMenu from './UserMenu'
import { useAuth } from '@/lib/auth'

interface HeaderProps {
  showAuthButtons?: boolean
  showUserMenu?: boolean
}

export default function Header({ showAuthButtons = true, showUserMenu = false }: HeaderProps) {
  const router = useRouter()
  const { user, isAnonymous, loading, currentTeamId } = useAuth()

  const handleLogin = () => {
    router.push('/login')
  }

  // Don't show buttons while loading
  if (loading) {
    return (
      <div className={styles.navbar}>
        <div className={styles.navContainer}>
          <Link href="/" className={styles.logo}>Cira Health</Link>
          <div className={styles.navActions}></div>
        </div>
      </div>
    )
  }

  // Determine what to show based on auth state and props
  const shouldShowUserMenu = showUserMenu && user && !isAnonymous
  const shouldShowAuthButtons = showAuthButtons && (!user || isAnonymous)

  return (
    <div className={styles.navbar}>
      <div className={styles.navContainer}>
        <Link href="/" className={styles.logo}>Cira Health</Link>
        <div className={styles.navActions}>
          {shouldShowUserMenu ? (
            <UserMenu />
          ) : shouldShowAuthButtons ? (
            <>
              <span className={styles.userStatus}>
                {isAnonymous ? '👤 匿名用户' : `✓ 已登录,Email=${user?.email}`}
                {currentTeamId && ` | team_id: ${currentTeamId}`}
              </span>
              <button className={styles.enterpriseButton} onClick={() => {}}>
                Go to Enterprise Version
              </button>
              <button className={styles.loginButton} onClick={handleLogin}>
                {isAnonymous ? 'Bind Account' : 'Login / Sign Up'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
