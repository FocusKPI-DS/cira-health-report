// Google Analytics tracking utility

declare global {
  interface Window {
    gtag?: (command: string, ...args: any[]) => void
  }
}

/**
 * Track an event in Google Analytics
 * @param eventName - The name of the event to track
 * @param params - Optional parameters to send with the event
 */
export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params)
  }
}
