'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import styles from './page.module.css'

export default function LoginPage() {
  const router = useRouter()
  const { isAnonymous, smartLogin } = useAuth()
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
      // 统一使用 smartLogin 自动处理升级/注册/登录/合并
      const result = await smartLogin(email, password, name)
      console.log('认证成功:', result.merged ? '已合并数据' : '直接登录')
      
      if (result.merged) {
        console.log('✅ 匿名账号数据已成功合并')
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
      } else if (err.code === 'auth/invalid-credential') {
        setError('邮箱或密码错误')
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
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className={styles.subtitle}>
            {isSignUp 
              ? 'Sign up to access full PHA analysis features'
              : 'Sign in to access your PHA analysis'}
          </p>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {isSignUp && (
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
                required
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
              : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

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
      </div>
    </main>
  )
}

