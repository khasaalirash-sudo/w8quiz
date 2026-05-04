import { redirect } from 'next/navigation'

/**
 * Корень приложения → сразу на дашборд.
 * Это внутрянка для клиентов, лендинга нет.
 */
export default function HomePage() {
  redirect('/dashboard')
}
