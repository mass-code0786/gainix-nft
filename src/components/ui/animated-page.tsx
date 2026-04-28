"use client";

import { motion } from "framer-motion";
import type { PropsWithChildren } from "react";

export function AnimatedPage({ children }: PropsWithChildren) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.2, 0.7, 0.2, 1] }}
      className="space-y-4 sm:space-y-6"
    >
      {children}
    </motion.div>
  );
}
