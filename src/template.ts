import androidPhoneFrame from './assets/android-phone-frame.png'
import androidTabletFrame from './assets/android-tablet-frame.png'
import ipadFrame from './assets/ipad-frame.png'
import iphoneFrame from './assets/iphone-frame.png'

/** Which store a preset's canvas size is sized for. Shown in the UI; not a brand we translate. */
export type Store = 'App Store' | 'Google Play'

/**
 * Geometry of a store screenshot panel. Every rect is in canvas pixels.
 *
 * A preset's rects and its frame asset were authored against each other, so they only mean
 * anything together: the frame is drawn at `frame`, and `screen` is the hole in it. Swapping
 * one without the other misaligns the screenshot with the bezel.
 */
export interface DevicePreset {
  id: string
  label: string
  store: Store
  canvas: { w: number; h: number }
  frame: { x: number; y: number; w: number; h: number; src: string }
  /** Where the uploaded screenshot sits, and the corner rounding of its mask. */
  screen: { x: number; y: number; w: number; h: number; radius: number }
  /** The caption is centered inside the band between the canvas top and the frame. */
  caption: { top: number; bottom: number; maxWidth: number }
}

/**
 * `screen.radius` sits between two failure modes, and the safe window is different for every
 * frame because it depends on how far the screenshot rect overhangs the frame's screen
 * aperture. Too small and the screenshot's square corners poke out past the phone's rounded
 * body; too large and the mask pulls in tighter than the aperture, letting the background
 * bleed through at the screen's corners. `scripts/verify-frames.mjs` proves a preset's radius
 * is clear of both — run it if you touch these numbers.
 */
export const IPHONE_65: DevicePreset = {
  id: 'iphone-6.5',
  label: 'iPhone 6.5"',
  store: 'App Store',
  canvas: { w: 1242, h: 2688 },
  frame: { x: 78, y: 483, w: 1087, h: 2189, src: iphoneFrame },
  screen: { x: 148, y: 546, w: 946, h: 2054, radius: 130 },
  caption: { top: 0, bottom: 483, maxWidth: 1100 },
}

export const IPAD_13: DevicePreset = {
  id: 'ipad-13',
  label: 'iPad Pro 13"',
  store: 'App Store',
  canvas: { w: 2064, h: 2752 },
  frame: { x: 173, y: 479, w: 1718, h: 2220, src: ipadFrame },
  screen: { x: 258, y: 557, w: 1548, h: 2064, radius: 30 },
  caption: { top: 0, bottom: 479, maxWidth: 1922 },
}

export const ANDROID_PHONE: DevicePreset = {
  id: 'android-phone',
  label: 'Android phone',
  store: 'Google Play',
  canvas: { w: 1512, h: 2688 },
  frame: { x: 255, y: 513, w: 1007, h: 2128, src: androidPhoneFrame },
  screen: { x: 278, y: 543, w: 955, h: 2074, radius: 130 },
  caption: { top: 0, bottom: 513, maxWidth: 1370 },
}

export const ANDROID_TABLET: DevicePreset = {
  id: 'android-tablet',
  label: 'Android tablet',
  store: 'Google Play',
  canvas: { w: 1548, h: 2752 },
  frame: { x: 100, y: 561, w: 1349, h: 2055, src: androidTabletFrame },
  screen: { x: 168, y: 639, w: 1211, h: 1899, radius: 28 },
  caption: { top: 0, bottom: 561, maxWidth: 1406 },
}

export const PRESETS = [IPHONE_65, IPAD_13, ANDROID_PHONE, ANDROID_TABLET]

export const DEFAULT_PRESET = IPHONE_65

export const presetById = (id: string) => PRESETS.find((p) => p.id === id) ?? DEFAULT_PRESET

/**
 * `system` resolves to SF Pro Display on Apple platforms, which is the face App Store
 * captions are usually set in. It renders differently off Apple platforms, so `Inter` is
 * bundled as the portable choice: it is embedded in the app, so its exports are
 * byte-identical on any machine.
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
 * The starting design: a caption sized to fill the band above the phone (~119px, 1.32
 * line-height) with a neutral placeholder sentence for whatever app the user is making
 * screenshots for.
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

