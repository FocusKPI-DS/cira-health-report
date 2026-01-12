import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'First PHA Analysis Draft under 30 minutes',
  description: 'Generate your Process Hazard Analysis quickly and efficiently',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

