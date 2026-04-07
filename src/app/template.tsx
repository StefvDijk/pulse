'use client'

import { motion } from 'motion/react'
import { pageTransition, springContent } from '@/lib/motion-presets'

/**
 * Next.js App Router template — her-rendert bij elke navigatie (anders dan
 * layout.tsx die persisteert). Ideaal voor page transitions.
 *
 * Gebruikt Apple-achtige spring physics: fade + subtle rise.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      transition={springContent}
    >
      {children}
    </motion.div>
  )
}
