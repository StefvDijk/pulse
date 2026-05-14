interface ProfileHeaderProps {
  displayName: string
  weightKg: string
  heightCm: string
}

/**
 * ProfileHeader v2 — gradient-tinted profile card at the top of Settings.
 * Avatar is a 60px circle with the user's initial, gradient gym→purple.
 * Matches screens/More.jsx::Settings profile header.
 */
export function ProfileHeader({ displayName, weightKg, heightCm }: ProfileHeaderProps) {
  const initial = (displayName || 'S').charAt(0).toUpperCase()

  const meta = [
    heightCm ? `${heightCm} cm` : null,
    weightKg ? `${weightKg} kg` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className="flex items-center gap-3.5 rounded-[18px] border-[0.5px] border-bg-border-strong p-[18px]"
      style={{
        background: 'linear-gradient(135deg, rgba(0,229,199,0.10), rgba(124,58,237,0.10))',
      }}
    >
      {/* Avatar */}
      <div
        className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full text-[24px] font-bold text-white"
        style={{ background: 'linear-gradient(135deg, #00E5C7, #7C3AED)' }}
      >
        {initial}
      </div>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="text-[17px] font-semibold text-text-primary">
          {displayName || 'Pulse user'}
        </div>
        <div className="text-[12px] text-text-tertiary">
          {meta || 'Bewerk profiel hieronder'}
        </div>
      </div>
    </div>
  )
}
