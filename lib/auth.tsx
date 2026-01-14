'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { 
  User,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  linkWithCredential,
  EmailAuthProvider,
  updateProfile
} from 'firebase/auth'
import { getFirebaseAuth } from './firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
  isAnonymous: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>
  linkAnonymousAccount: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAnonymous, setIsAnonymous] = useState(false)

  useEffect(() => {
    const auth = getFirebaseAuth()

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        setIsAnonymous(firebaseUser.isAnonymous)
        console.log('用户已登录:', firebaseUser.isAnonymous ? '匿名用户' : firebaseUser.email, firebaseUser.uid)
        setLoading(false)
      } else {
        // No user logged in, sign in anonymously
        console.log('未检测到用户，正在创建匿名账号...')
        try {
          const result = await signInAnonymously(auth)
          console.log('匿名登录成功:', result.user.uid)
          setUser(result.user)
          setIsAnonymous(true)
        } catch (error: any) {
          console.error('匿名登录失败:', error.message)
          setUser(null)
          setIsAnonymous(false)
        } finally {
          setLoading(false)
        }
      }
    })

    return () => unsubscribe()
  }, [])

  // Sign in with email and password (for existing users)
  const signInWithEmail = async (email: string, password: string) => {
    const auth = getFirebaseAuth()
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error: any) {
      console.error('邮箱登录失败:', error.message)
      throw error
    }
  }

  // Sign up with email and password (create new account)
  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    const auth = getFirebaseAuth()
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      if (displayName && result.user) {
        await updateProfile(result.user, { displayName })
      }
    } catch (error: any) {
      console.error('邮箱注册失败:', error.message)
      throw error
    }
  }

  // Link anonymous account to email/password
  const linkAnonymousAccount = async (email: string, password: string, displayName?: string) => {
    const auth = getFirebaseAuth()
    const currentUser = auth.currentUser

    if (!currentUser || !currentUser.isAnonymous) {
      throw new Error('当前用户不是匿名账号')
    }

    try {
      // Create credential
      const credential = EmailAuthProvider.credential(email, password)
      
      // Link the credential to the anonymous account
      const result = await linkWithCredential(currentUser, credential)
      console.log('账号绑定成功:', result.user.email)

      // Update display name if provided
      if (displayName && result.user) {
        await updateProfile(result.user, { displayName })
      }

      // Call backend API to migrate data
      // This would be implemented based on your backend API
      await migrateUserData(currentUser.uid, result.user.uid)
      
      return result.user
    } catch (error: any) {
      console.error('账号绑定失败:', error.message)
      throw error
    }
  }

  // Logout
  const logout = async () => {
    const auth = getFirebaseAuth()
    try {
      await auth.signOut()
      // After signing out, the onAuthStateChanged listener will automatically sign in anonymously
    } catch (error: any) {
      console.error('登出失败:', error.message)
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAnonymous,
        signInWithEmail,
        signUpWithEmail,
        linkAnonymousAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper function to call backend API for data migration
async function migrateUserData(anonymousUid: string, authenticatedUid: string) {
  try {
    // TODO: Replace with your actual API endpoint
    const response = await fetch('/api/migrate-user-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        anonymousUid,
        authenticatedUid,
      }),
    })

    if (!response.ok) {
      throw new Error('数据迁移失败')
    }

    const data = await response.json()
    console.log('数据迁移成功:', data)
  } catch (error: any) {
    console.error('数据迁移API调用失败:', error.message)
    // Note: We don't throw here to prevent blocking the account linking
    // The migration can be retried or handled separately
  }
}
