'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './Header.module.css'
import UserMenu from './UserMenu'
import { useAuth } from '@/lib/auth'

interface HeaderProps {
  showAuthButtons?: boolean
  showUserMenu?: boolean
  showNavMenu?: boolean
  hideEnterpriseButton?: boolean
  isDownloading?: boolean
}

export default function Header({
  showAuthButtons = true,
  showUserMenu = false,
  showNavMenu = false,
  hideEnterpriseButton = false,
  isDownloading = false,
}: HeaderProps) {
  const router = useRouter()
  const { user, isAnonymous, loading, currentTeamId } = useAuth()

  const handleLogin = () => {
    if (isDownloading) {
      alert('A spreadsheet is currently being generated. Please do not switch analysis reports.')
      return
    }
    router.push('/login')
  }

  const handleGoToEnterprise = () => {
    if (isDownloading) {
      alert('A spreadsheet is currently being generated. Please do not switch analysis reports.')
      return
    }
    const homepageUrl = '/#contact';
    window.location.href = homepageUrl;
  }

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault()
    const element = document.getElementById(sectionId)
    if (element) {
      const headerOffset = 80
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  // Determine what to show based on auth state and props
  const shouldShowUserMenu = showUserMenu && user && !isAnonymous && !loading
  const shouldShowAuthButtons = showAuthButtons && (!user || isAnonymous) && !loading

  return (
    <div className={styles.navbar}>
      <div className={styles.navContainer}>
        <div
          onClick={(e) => {
            if (isDownloading) {
              e.preventDefault();
              e.stopPropagation();
              alert('A spreadsheet is currently being generated. Please do not switch analysis reports.');
            }
          }}
          className={styles.logoWrapper}
        >
          <Link href="/" className={styles.logo} onClick={(e) => {
            if (isDownloading) {
              e.preventDefault();
            }
          }}>
            <img src="/images/cira-logo.png" alt="Cira Health" style={{ height: '36px' }} />
          </Link>
        </div>
        {showNavMenu && (
          <nav className={styles.navMenu}>
            <a href="#how-it-works" onClick={(e) => handleNavClick(e, 'how-it-works')} className={styles.navLink}>
              How it works
            </a>
            <a href="#why-cira" onClick={(e) => handleNavClick(e, 'why-cira')} className={styles.navLink}>
              Why Cira
            </a>
            <a href="#faq" onClick={(e) => handleNavClick(e, 'faq')} className={styles.navLink}>
              FAQ
            </a>
            <a href="#contact" onClick={(e) => handleNavClick(e, 'contact')} className={styles.navLink}>
              Contact
            </a>
          </nav>
        )}
        <div className={styles.navActions}>
          {shouldShowUserMenu && <UserMenu />}
          {false && shouldShowAuthButtons && (
            <span className={styles.userStatus}>
              {isAnonymous ? '👤 Anonymous User' : `✓ Signed In, Email=${user?.email}`}
              {currentTeamId && ` | team_id: ${currentTeamId}`}
            </span>
          )}
          {!hideEnterpriseButton && (
            <button className={styles.enterpriseButton} onClick={handleGoToEnterprise}>
              Go to Enterprise Version
            </button>
          )}
          {!shouldShowUserMenu &&
            <button className={styles.loginButton} onClick={handleLogin}>
              Login / Sign Up
            </button>
          }
        </div>
      </div>
    </div>
  )
}
