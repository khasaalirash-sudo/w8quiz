import type { Metadata } from 'next'
import { Raleway } from 'next/font/google'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

const raleway = Raleway({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'w8Quiz — конструктор квизов для лидогенерации',
    template: '%s | w8Quiz',
  },
  description: 'Создавайте квизы с ветвлением логики и встроенной аналитикой. Собирайте лиды без кода.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${raleway.variable} ${GeistMono.variable}`}>
      <body className="bg-neutral-50 text-neutral-900 antialiased font-sans">
        {children}
      </body>
    </html>
  )
}
