'use client'

import { motion, MotionConfig } from 'motion/react'
import { pageTransition, springContent } from '@/lib/motion-presets'

/**
 * Next.js App Router template — her-rendert bij elke navigatie (anders dan
 * layout.tsx die persisteert). Ideaal voor page transitions.
 *
 * Gebruikt Apple-achtige spring physics: fade + subtle rise.
 *
 * `MotionConfig reducedMotion="user"` zorgt dat alle motion/react
 * animaties (variants/transitions/whileHover/whileTap) automatisch
 * getransform-vrij worden zodra de gebruiker prefers-reduced-motion
 * heeft aanstaan. Eén plek voor de hele app.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={pageTransition}
        initial="initial"
        animate="animate"
        transition={springContent}
      >
        {children}
      </motion.div>
    </MotionConfig>
  )
}
