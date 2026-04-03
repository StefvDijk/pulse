'use client'

import { useState } from 'react'
import Image from 'next/image'
import { MuscleGroupDot } from '@/components/home/MuscleGroupDot'

interface ExerciseImageProps {
  imageUrl: string | null
  muscleGroup: string
  name: string
  size?: 'sm' | 'md'
}

export function ExerciseImage({ imageUrl, muscleGroup, name, size = 'md' }: ExerciseImageProps) {
  const [failed, setFailed] = useState(false)

  if (!imageUrl || failed) {
    return <MuscleGroupDot muscleGroup={muscleGroup} size={size} />
  }

  const px = size === 'sm' ? 28 : 36

  return (
    <div
      className={`${size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'} shrink-0 overflow-hidden rounded-full bg-bg-subtle`}
      title={name}
    >
      <Image
        src={imageUrl}
        alt={name}
        width={px}
        height={px}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
        unoptimized
      />
    </div>
  )
}
