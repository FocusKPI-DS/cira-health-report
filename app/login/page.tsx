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
        console.log('Linking anonymous account to email...')
        await linkAnonymousAccount(email, password, isSignUp ? name : undefined)
        console.log('Account linked successfully, data migrated')
        alert('Account linked successfully! Your data has been preserved.')
      } else if (isSignUp) {
        // Create new account
        await signUpWithEmail(email, password, name)
        console.log('Sign up successful')
      } else {
        // Sign in with existing account
        await signInWithEmail(email, password)
        console.log('Sign in successful')
      }
      
      // Redirect to reports page after successful login
      router.push('/reports')
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
        setError('Incorrect password, please try again')
      } else if (err.code === 'auth/credential-already-in-use') {
        setError('This email is already used by another account')
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
            {isAnonymous 
              ? 'Bind Your Account' 
              : (isSignUp ? 'Create Account' : 'Welcome Back')}
          </h1>
          <p className={styles.subtitle}>
            {isAnonymous
              ? 'Bind your temporary account to an email to permanently save your data'
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
              ? 'Processing...' 
              : (isAnonymous 
                ? 'Bind Account' 
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

