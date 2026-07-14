interface Props {
  open: boolean
  /** What the app is doing. Exporting, saving a project, and loading one all raise this. */
  message: string
}

/**
 * Covers the app while it works through something long: the export loop walking every screenshot,
 * a project being packed into a zip, a project being unpacked out of one. The canvas visibly flips
 * through the whole deck as it exports, which without this reads as the app doing something wrong.
 *
 * It is also what stops the user editing mid-operation: the render effect and the export loop share
 * one canvas, and a click landing between two frames would be drawn into the zip.
 */
export function BusyOverlay({ open, message }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={open}
      data-busy={open ? '' : undefined}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/60 transition-opacity duration-200 ${
        open ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {open && (
        <>
          <svg className="h-10 w-10 animate-spin text-white" viewBox="0 0 24 24" fill="none">
            {/* The dim ring is the track; the bright arc is what reads as motion. */}
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <p className="text-sm font-semibold text-white">{message}</p>
        </>
      )}
    </div>
  )
}
