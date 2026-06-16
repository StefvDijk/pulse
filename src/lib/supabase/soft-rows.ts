/**
 * Defensief uitlezen van een Supabase-query resultaat.
 *
 * Voor niet-kritieke databronnen (bv. een tabel die door een migratie-lag nog
 * niet bestaat): log de fout en val terug op een lege lijst i.p.v. te throwen.
 * Zo sloopt één optionele/falende bron niet de hele pagina (zie het
 * `activities`-incident: ontbrekende tabel op prod → PGRST205 → homepage down).
 *
 * Gebruik dit NIET voor kerntabellen waar een fout wél een echt probleem is —
 * laat die gewoon throwen.
 */
export function softRows<T>(
  result: { data: T[] | null; error: unknown },
  label: string,
): T[] {
  if (result.error) {
    console.error(`[softRows] ${label} faalde, val terug op leeg:`, result.error)
    return []
  }
  return result.data ?? []
}
