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

interface SmartLoginResult {
  user: User
  merged: boolean
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isAnonymous: boolean
  currentTeamId: string | null
  smartLogin: (email: string, password: string, displayName?: string) => Promise<SmartLoginResult>
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
        console.log('User logged in:', firebaseUser.isAnonymous ? 'Anonymous User' : firebaseUser.email, firebaseUser.uid)
        
        // Sync existing user with backend
        await syncUserToBackend(firebaseUser)
        const teamId = await syncUserToApphub(firebaseUser)
        if (teamId) {
          setCurrentTeamId(teamId)
        }
        
        setLoading(false)
      } else {
        // No user logged in, sign in anonymously
        console.log('No user detected, creating anonymous account...')
        try {
          const result = await signInAnonymously(auth)
          console.log('Anonymous login successful:', result.user.uid)
          setUser(result.user)
          setIsAnonymous(true)
          
          // Sync anonymous user with backend
          await syncUserToBackend(result.user)
          const teamId = await syncUserToApphub(result.user)
          if (teamId) {
            setCurrentTeamId(teamId)
          }
        } catch (error: any) {
          console.error('Anonymous login failed:', error.message)
          setUser(null)
          setIsAnonymous(false)
        } finally {
          setLoading(false)
        }
      }
    })

    return () => unsubscribe()
  }, [])

  // Smart login: automatically handles anonymous upgrade, login, and data merge
  const smartLogin = async (email: string, password: string, displayName?: string): Promise<SmartLoginResult> => {
    console.log('开始智能登录流程...')
    const auth = getFirebaseAuth()
    const anonUser = auth.currentUser
    
    const credential = EmailAuthProvider.credential(email, password)

    // 如果没有提供displayName，使用邮箱@前面的部分
    const finalDisplayName = displayName || email.split('@')[0]

    console.log('anonUser:', anonUser ? `${anonUser.isAnonymous ? 'Anonymous User' : 'Authenticated User'} (${anonUser.uid})` : 'No User')
    // 1️⃣ 匿名用户，优先尝试升级
    if (anonUser?.isAnonymous) {
      try {
        const linkResult = await linkWithCredential(anonUser, credential)
        console.log('匿名账号升级成功:', linkResult.user.email)
        
        // Update display name
        if (linkResult.user) {
          await updateProfile(linkResult.user, { displayName: finalDisplayName })
        }
        
        // 手动更新状态，因为 linkWithCredential 不会触发 onAuthStateChanged
        setUser(linkResult.user)
        setIsAnonymous(false)
        
        return { user: linkResult.user, merged: false }
      } catch (err: any) {
        // 捕获邮箱已存在的两种错误代码
        if (err.code !== 'auth/credential-already-in-use' && err.code !== 'auth/email-already-in-use') {
          throw err
        }
        // 冲突，继续走登录流程
        console.log('邮箱已存在，继续登录并合并数据...')
      }
    }

    // 2️⃣ 正常登录
    const result = await signInWithEmailAndPassword(auth, email, password)
    const realUser = result.user
    console.log('登录成功:', realUser.email)

    // 3️⃣ 有匿名账号才需要合并
    if (anonUser && anonUser.uid !== realUser.uid) {
      console.log('检测到匿名账号，开始合并数据...')
      await migrateUserData(anonUser.uid, realUser.uid)
      console.log('✅ 数据合并完成，匿名账号将自动失效')
      // 注意：不需要手动删除匿名账号，因为：
      // 1. 登录后匿名账号的认证上下文已失效，无法删除（会报 admin-restricted-operation 错误）
      // 2. 数据已经迁移，匿名账号不会再被使用
      // 3. Firebase 会自动清理不活跃的匿名账号
      return { user: realUser, merged: true }
    }

    return { user: realUser, merged: false }
  }

  // Sign in with email and password (for existing users)
  const signInWithEmail = async (email: string, password: string) => {
    const auth = getFirebaseAuth()
    const currentUser = auth.currentUser
    
    // If there's an anonymous user, sign them out first before signing in with email
    if (currentUser && currentUser.isAnonymous) {
      console.log('Signing out anonymous user before email sign in...')
      await auth.signOut()
    }
    
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error: any) {
      console.error('Email login failed:', error.message)
      throw error
    }
  }

  // Sign up with email and password (create new account)
  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    const auth = getFirebaseAuth()
    const currentUser = auth.currentUser
    
    // If there's an anonymous user, sign them out first before creating new account
    if (currentUser && currentUser.isAnonymous) {
      console.log('Signing out anonymous user before email sign up...')
      await auth.signOut()
    }
    
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      // 如果没有提供displayName，使用邮箱@前面的部分
      const finalDisplayName = displayName || email.split('@')[0]
      if (result.user) {
        await updateProfile(result.user, { displayName: finalDisplayName })
      }
    } catch (error: any) {
      console.error('Email sign up failed:', error.message)
      throw error
    }
  }

  // Link anonymous account to email/password
  const linkAnonymousAccount = async (email: string, password: string, displayName?: string) => {
    const auth = getFirebaseAuth()
    const currentUser = auth.currentUser

    if (!currentUser || !currentUser.isAnonymous) {
      throw new Error('Current user is not an anonymous account')
    }

    try {
      // Create credential
      const credential = EmailAuthProvider.credential(email, password)
      
      // Link the credential to the anonymous account
      const result = await linkWithCredential(currentUser, credential)
      console.log('Account linked successfully:', result.user.email)

      // Update display name if provided
      if (displayName && result.user) {
        await updateProfile(result.user, { displayName })
      }

      // Call backend API to migrate data
      // This would be implemented based on your backend API
      await migrateUserData(currentUser.uid, result.user.uid)
      
      // 手动更新状态，因为 linkWithCredential 不会触发 onAuthStateChanged
      setUser(result.user)
      setIsAnonymous(false)
      
      return result.user
    } catch (error: any) {
      console.error('Account linking failed:', error.message)
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
      console.error('Logout failed:', error.message)
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
        smartLogin,
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

// Helper function to wait for Firebase to be ready and get token
async function waitForFirebaseToken(firebaseUser: User, maxRetries = 3): Promise<string | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Wait a bit for Firebase to initialize
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 * i))
      }
      const token = await firebaseUser.getIdToken(true)
      if (token) {
        return token
      }
    } catch (error) {
      console.warn(`Attempt ${i + 1}/${maxRetries} to get token failed:`, error)
      if (i === maxRetries - 1) {
        return null
      }
    }
  }
  return null
}

// Helper function to sync user with backend
async function syncUserToBackend(firebaseUser: User) {
  try {
    // Get Firebase ID token with retry logic
    const idToken = await waitForFirebaseToken(firebaseUser)
    if (!idToken) {
      console.error('Unable to get authentication token after retries')
      return
    }

    // Sync user with backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'
    
    // Wait 1 second to prevent "token used too early" errors due to clock skew
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
    // Get Firebase ID token with retry logic
    const idToken = await waitForFirebaseToken(firebaseUser)
    if (!idToken) {
      console.error('Unable to get authentication token after retries')
      return null
    }

    // Sync user with backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'
    
    // Wait 1 second to prevent "token used too early" errors due to clock skew
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
    const response = await fetch('/api/v1/migrate-user-data', {
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
      throw new Error('Data migration failed')
    }

    const data = await response.json()
    console.log('Data migration successful:', data)
  } catch (error: any) {
    console.error('Data migration API call failed:', error.message)
    // Note: We don't throw here to prevent blocking the account linking
    // The migration can be retried or handled separately
  }
}
