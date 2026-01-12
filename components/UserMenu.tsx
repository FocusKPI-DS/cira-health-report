'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './UserMenu.module.css'

export default function UserMenu() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  const handleLogout = () => {
    // Handle logout logic here
    router.push('/')
    setIsOpen(false)
  }

  return (
    <div className={styles.userMenu} ref={menuRef}>
      <button 
        className={styles.userAvatar}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="User menu"
      >
        JD
      </button>
      {isOpen && (
        <div className={styles.dropdown}>
          <Link 
            href="/invoices" 
            className={styles.dropdownItem}
            onClick={() => setIsOpen(false)}
          >
            Invoices
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

