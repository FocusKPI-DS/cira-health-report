'use client'

import { useState } from 'react'
import styles from './SignInModal.module.css'

interface SignInModalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function SignInModal({ onClose, onSuccess }: SignInModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle sign in logic here
    console.log('Sign in:', { email, password })
    // Call success callback to update parent state
    onSuccess()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
        <h2 className={styles.title}>Sign In Required</h2>
        <p className={styles.subtitle}>
          Please sign in to view more analysis results
        </p>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className={styles.signInButton}>
            Sign In
          </button>
        </form>

        <p className={styles.footerText}>
          Don't have an account? <a href="#" className={styles.link}>Sign up</a>
        </p>
      </div>
    </div>
  )
}

