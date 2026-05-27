import { Suspense } from 'react'
import { SettingsPage } from '@/components/settings/SettingsPage'

export default function Page() {
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  )
}
