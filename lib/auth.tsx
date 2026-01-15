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
  currentTeamId: string | null
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>
  linkAnonymousAccount: (email: string, password: string, displayName?: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null)

  useEffect(() => {
    const auth = getFirebaseAuth()

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        setIsAnonymous(firebaseUser.isAnonymous)
        console.log('用户已登录:', firebaseUser.isAnonymous ? '匿名用户' : firebaseUser.email, firebaseUser.uid)
        
        // Sync existing user with backend
        await syncUserToBackend(firebaseUser)
        const teamId = await syncUserToApphub(firebaseUser)
        if (teamId) {
          setCurrentTeamId(teamId)
        }
        
        setLoading(false)
      } else {
        // No user logged in, sign in anonymously
        console.log('未检测到用户，正在创建匿名账号...')
        try {
          const result = await signInAnonymously(auth)
          console.log('匿名登录成功:', result.user.uid)
          setUser(result.user)
          setIsAnonymous(true)
          
          // Sync anonymous user with backend
          await syncUserToBackend(result.user)
          const teamId = await syncUserToApphub(result.user)
          if (teamId) {
            setCurrentTeamId(teamId)
          }
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
        currentTeamId,
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

// Helper function to sync user with backend
async function syncUserToBackend(firebaseUser: User) {
  try {
    // Get Firebase ID token
    let idToken: string
    try {
      idToken = await firebaseUser.getIdToken(true) // Force refresh to ensure valid token
    } catch (tokenError) {
      console.error('Unable to get authentication token:', tokenError)
      return
    }

    // Sync user with backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'
    
    // Wait 1 second before syncing
    await new Promise(resolve => setTimeout(resolve, 1000))

    let syncResponse: Response
    try {
      syncResponse = await fetch(`${apiUrl}/auth/sync-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      })
    } catch (fetchError) {
      console.error('Network error syncing user:', fetchError)
      return
    }

    if (!syncResponse.ok) {
      const errorData = await syncResponse.json().catch(() => ({ detail: 'Failed to sync user' }))
      const errorDetail = errorData.detail || 'Failed to sync user with backend'
      
      if (syncResponse.status === 401 || syncResponse.status === 403) {
        console.error('Authentication error:', errorDetail)
        return
      }
      
      console.error('Sync error:', errorDetail)
      return
    }

    const syncResult = await syncResponse.json()
    
    if (!syncResult.success) {
      console.error('User sync failed:', syncResult)
      return
    }

    console.log('User synced successfully with backend')
  } catch (error) {
    console.error('Sync user error:', error)
    // Don't throw - allow login to continue even if sync fails
  }
}
async function syncUserToApphub(firebaseUser: User): Promise<string | null> {
  try {
    // Get Firebase ID token
    let idToken: string
    try {
      idToken = await firebaseUser.getIdToken(true) // Force refresh to ensure valid token
    } catch (tokenError) {
      console.error('Unable to get authentication token:', tokenError)
      return null
    }

    // Sync user with backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'
    
    // Wait 1 second before syncing
    await new Promise(resolve => setTimeout(resolve, 1000))

    let syncResponse: Response
    try {
      syncResponse = await fetch(`${apiUrl}/api/v1/anonclient/initAnonymousUser`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      })
    } catch (fetchError) {
      console.error('Network error syncing user:', fetchError)
      return null
    }

    if (!syncResponse.ok) {
      const errorData = await syncResponse.json().catch(() => ({ detail: 'Failed to sync user' }))
      const errorDetail = errorData.detail || 'Failed to sync user with backend'
      
      if (syncResponse.status === 401 || syncResponse.status === 403) {
        console.error('Authentication error:', errorDetail)
        return null
      }
      
      console.error('Sync error:', errorDetail)
      return null
    }

    const syncResult = await syncResponse.json()
    
    if (!syncResult.success) {
      console.error('User sync failed:', syncResult)
      return null
    }

    console.log('User synced successfully with apphub backend')
    return syncResult.team_id || null
  } catch (error) {
    console.error('Sync user error:', error)
    // Don't throw - allow login to continue even if sync fails
    return null
  }
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
