import iphoneFrame from './assets/iphone-frame.png'

/**
 * Geometry of an App Store screenshot panel. Every rect is in canvas pixels.
 *
 * The iPhone 6.5" values below are measured from the original GIMP template
 * (OnTrack_EN_iPhone_Template.xcf): canvas 1242x2688, frame layer 1087x2189 at
 * (78,483), screenshot layer 946x2054 at (148,546).
 */
export interface DevicePreset {
  id: string
  label: string
  canvas: { w: number; h: number }
  frame: { x: number; y: number; w: number; h: number; src: string }
  /** Where the uploaded screenshot sits, and the corner rounding of its mask. */
  screen: { x: number; y: number; w: number; h: number; radius: number }
  /** The caption is centered inside the band between the canvas top and the frame. */
  caption: { top: number; bottom: number; maxWidth: number }
}

export const IPHONE_65: DevicePreset = {
  id: 'iphone-6.5',
  label: 'iPhone 6.5" — 1242 × 2688',
  canvas: { w: 1242, h: 2688 },
  frame: { x: 78, y: 483, w: 1087, h: 2189, src: iphoneFrame },
  // The radius must exceed the frame's screen aperture (~135px) so the screenshot's corners
  // tuck under the bezel, but stay under ~150px or the rounding cuts into the visible aperture.
  screen: { x: 148, y: 546, w: 946, h: 2054, radius: 140 },
  caption: { top: 0, bottom: 483, maxWidth: 1100 },
}

export const PRESETS = [IPHONE_65]

/**
 * `system` is what the original template used (SF Pro Display on Apple platforms) and
 * matches the existing OnTrack screenshots to within 0.3%. It renders differently off
 * Apple platforms, so `Inter` is bundled as the portable choice: it is embedded in the
 * app, so its exports are byte-identical on any machine.
 */
export const FONTS = [
  { id: 'system', label: 'System (SF Pro)', stack: 'system-ui, -apple-system, sans-serif' },
  { id: 'inter', label: 'Inter (portable)', stack: 'Inter, sans-serif' },
  { id: 'helvetica', label: 'Helvetica', stack: '"Helvetica Neue", Helvetica, sans-serif' },
  { id: 'arial', label: 'Arial', stack: 'Arial, sans-serif' },
  { id: 'georgia', label: 'Georgia', stack: 'Georgia, serif' },
] as const

export interface Design {
  backgroundColor: string
  sentence: string
  /** Indices into the caption's tokens (see src/text.ts — not a whitespace split). */
  highlightIndices: number[]
  highlightColor: string
  textColor: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  lineHeight: number
}

/**
 * The starting design. Colors, size and line-height come from the original OnTrack
 * template (ink height 90px, baselines 154px apart => ~119px / 1.32); the caption is a
 * neutral placeholder for whatever app the user is making screenshots for.
 */
export const DEFAULT_DESIGN: Design = {
  backgroundColor: '#001027',
  // Hard break: greedy wrapping would otherwise leave "App" orphaned on its own line.
  sentence: 'MyApp\nis the Best App',
  highlightIndices: [0],
  highlightColor: '#007AFF',
  textColor: '#FFFFFF',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 119,
  fontWeight: 800,
  lineHeight: 1.32,
}

