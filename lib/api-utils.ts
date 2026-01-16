/**
 * API utility functions for making API requests
 */

import { getFirebaseAuth } from './firebase'

/**
 * Get the current user ID from Firebase auth
 * @returns The user ID (Firebase UID) or null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser
    
    if (!user) {
      return null
    }
    
    return user.uid
  } catch (error) {
    return null
  }
}

/**
 * Get a valid Firebase ID token with retry logic
 * @param maxRetries Maximum number of retry attempts (default: 3)
 * @returns The Firebase ID token or null if unavailable after retries
 */
async function getValidToken(maxRetries: number = 3): Promise<string | null> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const auth = getFirebaseAuth()
      const user = auth.currentUser
      
      if (!user) {
        // Wait before retry if Firebase hasn't initialized yet
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
          continue
        }
        return null
      }
      
      // Get Firebase ID token (automatically refreshes only if expired or within 5 minutes of expiring)
      // Set force refresh to false to use cached token when valid
      const token = await user.getIdToken(false)
      if (token) {
        return token
      }
    } catch (error) {
      console.warn(`Attempt ${i + 1}/${maxRetries} to get token failed:`, error)
      if (i === maxRetries - 1) {
        console.error('Failed to get Firebase token after retries:', error)
        return null
      }
      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  return null
}

/**
 * Create headers for API requests with Firebase authentication
 * @param includeContentType Whether to include Content-Type header (default: true)
 * @returns Headers object with Content-Type and Authorization (Bearer token)
 */
export async function getAuthHeaders(includeContentType: boolean = true): Promise<HeadersInit> {
  const headers: HeadersInit = {}
  
  if (includeContentType) {
    headers['Content-Type'] = 'application/json'
  }
  
  // Get a valid Firebase ID token
  const token = await getValidToken()
  
  console.log('[getAuthHeaders] Token available:', !!token)
  console.log('[getAuthHeaders] Token length:', token ? token.length : 0)
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  // If no token, headers will be empty (no Authorization header)
  // Backend will return 401 if auth is required
  
  console.log('[getAuthHeaders] Final headers:', Object.keys(headers))
  
  return headers
}

/**
 * Make an authenticated API request with automatic redirect on 401 errors
 * @param url API endpoint URL
 * @param options Fetch options (method, body, etc.)
 * @returns Response object
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get auth headers
  const authHeaders = await getAuthHeaders()
  
  // Merge with existing headers
  const headers = {
    ...authHeaders,
    ...options.headers,
  }
  
  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
  })
  
  // If we got a 401, redirect to login
  if (response.status === 401) {
    // Sign out from Firebase
    try {
      const auth = getFirebaseAuth()
      await auth.signOut()
    } catch (error) {
      console.error('Failed to sign out:', error)
    }
    
    // Redirect to login page
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      // Only redirect if not already on login page
      if (!currentPath.startsWith('/login')) {
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
      }
    }
  }
  
  return response
}
