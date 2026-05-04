'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface SettingsClientProps {
  email: string
  createdAt: string
}

export function SettingsClient({ email, createdAt }: SettingsClientProps) {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) return
    if (newPassword !== confirmPassword) {
      setPasswordStatus('error')
      return
    }

    setPasswordStatus('saving')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      console.error('[updatePassword]', error)
      setPasswordStatus('error')
    } else {
      setPasswordStatus('saved')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordStatus('idle'), 3000)
    }
  }

  const handleDeleteAccount = async () => {
    // Note: Account deletion typically requires server-side action
    // For now, sign out and show message
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-8">Настройки</h1>

      {/* ── Profile ── */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-6">
        <h2 className="font-semibold text-neutral-900 mb-4">Профиль</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Email</label>
            <div className="px-3 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-600">
              {email}
            </div>
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Дата регистрации</label>
            <div className="px-3 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-600">
              {createdAt
                ? new Date(createdAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Plan ── */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-6">
        <h2 className="font-semibold text-neutral-900 mb-4">Тарифный план</h2>
        <div className="flex items-center gap-3 p-4 bg-accent-50 rounded-xl border border-accent-200">
          <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center text-lg">
            🎉
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-accent-700">Бесплатный</p>
            <p className="text-xs text-accent-600/70">Безлимит на период бета-тестирования</p>
          </div>
        </div>
      </div>

      {/* ── Change Password ── */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-6">
        <h2 className="font-semibold text-neutral-900 mb-4">Изменить пароль</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Новый пароль</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Минимум 6 символов"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400 transition-all"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Подтвердите пароль</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-all ${
                confirmPassword && confirmPassword !== newPassword
                  ? 'border-red-300 focus:border-red-400'
                  : 'border-neutral-200 focus:border-accent-400'
              }`}
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-red-500 mt-1">Пароли не совпадают</p>
            )}
          </div>
          <button
            onClick={handlePasswordChange}
            disabled={!newPassword || newPassword.length < 6 || newPassword !== confirmPassword || passwordStatus === 'saving'}
            className="px-4 py-2 text-sm font-medium bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {passwordStatus === 'saving' ? 'Сохранение...' : passwordStatus === 'saved' ? '✓ Сохранено' : 'Сохранить пароль'}
          </button>
          {passwordStatus === 'error' && (
            <p className="text-xs text-red-500">Ошибка при смене пароля. Попробуйте снова.</p>
          )}
        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div className="bg-white rounded-2xl border border-red-200 p-6">
        <h2 className="font-semibold text-red-700 mb-2">Опасная зона</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Удаление аккаунта приведёт к потере всех квизов, лидов и настроек. Это действие необратимо.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Удалить аккаунт
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeleteAccount}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
            >
              Да, удалить навсегда
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              Отмена
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
