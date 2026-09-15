import '@testing-library/jest-dom/vitest'
import { assertLocalSupabaseTarget } from './src/lib/supabase/safe-target'

assertLocalSupabaseTarget(process.env.NEXT_PUBLIC_SUPABASE_URL, 'Vitest')
