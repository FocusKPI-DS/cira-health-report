'use client'

import Link from 'next/link'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContainer}>
        <div className={styles.footerContent}>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} FocusKPI, Inc. All rights reserved.
          </p>
          <div className={styles.footerLinks}>
            <Link href="/license-agreement" className={styles.footerLink}>
              License Agreement
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
