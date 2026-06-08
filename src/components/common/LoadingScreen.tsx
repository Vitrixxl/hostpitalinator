import { motion } from "motion/react"

const startupProgressTransition = {
  duration: 3,
  ease: "easeInOut",
} as const

export function LoadingScreen({ label }: { label: string }) {
  return (
    <motion.main
      className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <motion.section
        className="w-full max-w-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-4">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-card"
          >
            <span className="text-sm font-semibold text-foreground">
              CH
            </span>
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Centre Hospitalier
            </p>
            <h1 className="mt-1 text-2xl font-semibold leading-none">
              CH de Versailles
            </h1>
          </div>
        </div>

        <div className="mt-8">
          <div className="h-0.5 overflow-hidden bg-border" aria-hidden="true">
            <motion.div
              className="h-full w-full origin-left bg-primary"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={startupProgressTransition}
            />
          </div>

          <p className="mt-4 text-sm text-muted-foreground">{label}</p>
        </div>
      </motion.section>
    </motion.main>
  )
}
