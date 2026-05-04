import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'w8Quiz — конструктор квизов для лидогенерации',
    template: '%s | w8Quiz',
  },
  description: 'Создавайте квизы с ветвлением логики и встроенной аналитикой. Собирайте лиды без кода.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-neutral-50 text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  )
}
