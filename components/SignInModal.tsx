'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import styles from './SignInModal.module.css'

interface SignInModalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function SignInModal({ onClose, onSuccess }: SignInModalProps) {
  const { smartLogin } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await smartLogin(email, password)
      console.log('Login successful:', result.merged ? 'Data merged' : 'Direct login')
      onSuccess()
    } catch (err: any) {
      console.error('Login error:', err)
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password')
      } else if (err.code === 'auth/user-not-found') {
        setError('Account does not exist, please sign up first')
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email format')
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak, please use at least 6 characters')
      } else {
        setError(err.message || 'Login failed, please try again')
      }
    } finally {
      setLoading(false)
    }
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
        
        {error && (
          <div style={{ 
            color: '#ef4444', 
            background: '#fef2f2', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}
        
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
              disabled={loading}
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
              disabled={loading}
            />
          </div>

          <button type="submit" className={styles.signInButton} disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className={styles.footerText}>
          Don't have an account? <a href="/login" className={styles.link}>Sign up</a>
        </p>
      </div>
    </div>
  )
}

