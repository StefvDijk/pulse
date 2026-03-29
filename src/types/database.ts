// Dit bestand wordt automatisch gegenereerd door:
// supabase gen types typescript --local > src/types/database.ts
// Voer dit uit na elke database migratie.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
