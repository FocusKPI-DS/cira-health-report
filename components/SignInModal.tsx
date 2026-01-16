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
      console.log('登录成功:', result.merged ? '已合并数据' : '直接登录')
      onSuccess()
    } catch (err: any) {
      console.error('登录错误:', err)
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('邮箱或密码错误')
      } else if (err.code === 'auth/user-not-found') {
        setError('账号不存在，请先注册')
      } else if (err.code === 'auth/invalid-email') {
        setError('邮箱格式不正确')
      } else if (err.code === 'auth/weak-password') {
        setError('密码强度不够，请使用至少6个字符')
      } else {
        setError(err.message || '登录失败，请重试')
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
            {loading ? '登录中...' : 'Sign In'}
          </button>
        </form>

        <p className={styles.footerText}>
          Don't have an account? <a href="/login" className={styles.link}>Sign up</a>
        </p>
      </div>
    </div>
  )
}

