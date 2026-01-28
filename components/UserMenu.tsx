'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './UserMenu.module.css'
import { useAuth } from '@/lib/auth'
import { trackEvent } from '@/lib/analytics'
import { downloadApi } from '@/lib/download-api'

export default function UserMenu() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [hasUnreadDownloads, setHasUnreadDownloads] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check for unread downloads
    const checkUnread = async () => {
      if (!user) return;
      try {
        const tasks = await downloadApi.listDownloadTasks(10, 0);
        const hasUnread = tasks.some(t => !t.is_downloaded && t.status === 'COMPLETED');
        setHasUnreadDownloads(hasUnread);
      } catch (e) {
        console.error(e);
      }
    };

    checkUnread();

    // Poll every 10 seconds
    const interval = setInterval(checkUnread, 10000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleLogout = async () => {
    trackEvent('click_logout')
    try {
      await logout()
      router.push('/')
      setIsOpen(false)
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  // 获取用户首字母
  const getInitials = () => {
    if (!user) return 'U'

    if (user.displayName) {
      // 从 displayName 获取首字母（支持多个单词）
      const names = user.displayName.trim().split(' ')
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase()
      }
      return user.displayName.substring(0, 2).toUpperCase()
    }

    if (user.email) {
      // 从 email 获取首字母
      const emailPrefix = user.email.split('@')[0]
      return emailPrefix.substring(0, 2).toUpperCase()
    }

    return 'U'
  }

  return (
    <div className={styles.userMenu} ref={menuRef}>
      <button
        className={styles.userAvatar}
        onClick={() => {
          trackEvent('click_user_avatar')
          setIsOpen(!isOpen)
        }}
        aria-label="User menu"
      >
        {hasUnreadDownloads && <span className={styles.notificationDot} />}
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt="User avatar"
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          getInitials()
        )}
      </button>
      {isOpen && (
        <div className={styles.dropdown}>
          <Link
            href="/invoices"
            className={styles.dropdownItem}
            onClick={() => {
              trackEvent('click_invoices')
              setIsOpen(false)
            }}
          >
            Invoices
          </Link>
          <Link
            href="/results"
            className={styles.dropdownItem}
            onClick={() => {
              trackEvent('click_results')
              setIsOpen(false)
            }}
          >
            Results
          </Link>
          <Link
            href="/downloads"
            className={styles.dropdownItem}
            onClick={() => {
              trackEvent('click_download_center')
              setIsOpen(false)
            }}
          >
            Download Center {hasUnreadDownloads && <span className={styles.menuDot} />}
          </Link>
          <button
            className={styles.dropdownItem}
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  )
}

