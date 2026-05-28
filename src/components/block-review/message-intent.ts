export function isNextBlockQuestionTurn(text: string): boolean {
  const t = text.trim().toLowerCase()
  const asksForChange =
    /\b(vervang\w*|verlaag\w*|verminder\w*|verhoog\w*|minder|meer|maak|herstel\w*|repareer\w*|wijzig\w*|schrap\w*|toevoeg\w*|voeg|haal weg|zet|switch\w*|verplaats\w*|lichter|zwaarder)\b/.test(t) ||
    t.includes('pas aan')
  if (asksForChange) return false
  return (
    t.endsWith('?') ||
    /^(waarom|wat|hoe|wanneer|welke|klopt|kan|kun|leg|verklaar|bedoel|is dit|is dat|wat als)\b/.test(t)
  )
}

export function isNextBlockProceedTurn(text: string): boolean {
  const t = text.trim().toLowerCase()
  return (
    /\b(stap\s*6|6\/6|volgende|verder|doorgaan|door naar|naar bevestig|naar bevestigen|afronden|bevestigen)\b/.test(t) ||
    /\b(goed zo|prima zo|akkoord|ik ben akkoord|ik vind het goed|dit is goed|ziet er goed uit)\b/.test(t)
  )
}
