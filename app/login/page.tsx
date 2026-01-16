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
      // Use smartLogin to automatically handle upgrade/registration/login/merge
      const result = await smartLogin(email, password, name)
      console.log('Authentication successful:', result.merged ? 'Data merged' : 'Direct login')
      
      if (result.merged) {
        console.log('✅ Anonymous account data successfully merged')
      }
      
      // Redirect to results page after successful login
      router.push('/results')
    } catch (err: any) {
      console.error('Authentication error:', err)
      
      // Handle specific Firebase error codes
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use, please try signing in')
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak, please use at least 6 characters')
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email format')
      } else if (err.code === 'auth/user-not-found') {
        setError('Account not found, please sign up first')
      } else if (err.code === 'auth/wrong-password') {
        setError('Wrong Password, please try again')
      } else if (err.code === 'auth/invalid-credential') {
        setError('Invalid Email or Password, please try again')
      } else {
        setError(err.message || 'Operation failed, please try again')
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
              ? 'Loading...' 
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

