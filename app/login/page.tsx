'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import styles from './page.module.css'

export default function LoginPage() {
  const router = useRouter()
  const { isAnonymous, signInWithEmail, signUpWithEmail, linkAnonymousAccount } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isAnonymous) {
        // If user is currently anonymous, link their account to email/password
        console.log('绑定匿名账号到邮箱...')
        await linkAnonymousAccount(email, password, isSignUp ? name : undefined)
        console.log('账号绑定成功，数据已迁移')
        alert('账号绑定成功！您的数据已保留。')
      } else if (isSignUp) {
        // Create new account
        await signUpWithEmail(email, password, name)
        console.log('注册成功')
      } else {
        // Sign in with existing account
        await signInWithEmail(email, password)
        console.log('登录成功')
      }
      
      // Redirect to reports page after successful login
      router.push('/reports')
    } catch (err: any) {
      console.error('认证错误:', err)
      
      // Handle specific Firebase error codes
      if (err.code === 'auth/email-already-in-use') {
        setError('该邮箱已被使用，请尝试登录')
      } else if (err.code === 'auth/weak-password') {
        setError('密码强度不够，请使用至少6个字符')
      } else if (err.code === 'auth/invalid-email') {
        setError('邮箱格式不正确')
      } else if (err.code === 'auth/user-not-found') {
        setError('账号不存在，请先注册')
      } else if (err.code === 'auth/wrong-password') {
        setError('密码错误，请重试')
      } else if (err.code === 'auth/credential-already-in-use') {
        setError('该邮箱已被其他账号使用')
      } else {
        setError(err.message || '操作失败，请重试')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            {isAnonymous 
              ? '绑定您的账号' 
              : (isSignUp ? 'Create Account' : 'Welcome Back')}
          </h1>
          <p className={styles.subtitle}>
            {isAnonymous
              ? '将您的临时账号绑定到邮箱，永久保存您的数据'
              : (isSignUp 
                ? 'Sign up to access full PHA analysis features'
                : 'Sign in to access your PHA analysis')}
          </p>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {(isSignUp || isAnonymous) && (
            <div className={styles.formGroup}>
              <label htmlFor="name" className={styles.label}>
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.input}
                placeholder="Enter your full name"
                required={isSignUp}
              />
            </div>
          )}

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
              placeholder="Enter your password (at least 6 characters)"
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={loading}
          >
            {loading 
              ? '处理中...' 
              : (isAnonymous 
                ? '绑定账号' 
                : (isSignUp ? 'Sign Up' : 'Sign In'))}
          </button>
        </form>

        {!isAnonymous && (
          <div className={styles.footer}>
            <p className={styles.footerText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <button 
                type="button"
                className={styles.toggleButton}
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError('')
                }}
                disabled={loading}
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

