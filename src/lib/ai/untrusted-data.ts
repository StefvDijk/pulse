/** Escape delimiter characters before embedding stored/runtime data in prompts. */
export function escapeUntrustedData(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function wrapUntrustedData(source: string, value: string): string {
  if (!value.trim()) return ''
  return `<user_data source="${source}">\n${escapeUntrustedData(value)}\n</user_data>`
}
