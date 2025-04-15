"use client"

import { motion } from "framer-motion"

export const ChatTypingIndicator = () => {
  return (
    <div className="flex space-x-2 items-center h-6 px-2">
      <motion.div
        className="w-2 h-2 rounded-full bg-primary/60"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.6, repeat: Number.POSITIVE_INFINITY, repeatType: "loop" }}
      />
      <motion.div
        className="w-2 h-2 rounded-full bg-primary/60"
        animate={{ y: [0, -5, 0] }}
        transition={{
          duration: 0.6,
          repeat: Number.POSITIVE_INFINITY,
          repeatType: "loop",
          delay: 0.2,
        }}
      />
      <motion.div
        className="w-2 h-2 rounded-full bg-primary/60"
        animate={{ y: [0, -5, 0] }}
        transition={{
          duration: 0.6,
          repeat: Number.POSITIVE_INFINITY,
          repeatType: "loop",
          delay: 0.4,
        }}
      />
    </div>
  )
}
