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
 * Get a valid Firebase ID token
 * @returns The Firebase ID token or null if unavailable
 */
async function getValidToken(): Promise<string | null> {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser
    
    if (!user) {
      return null
    }
    
    // Get Firebase ID token (automatically refreshes if needed)
    const token = await user.getIdToken()
    return token
  } catch (error) {
    console.error('Failed to get Firebase token:', error)
    return null
  }
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
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  // If no token, headers will be empty (no Authorization header)
  // Backend will return 401 if auth is required
  
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
