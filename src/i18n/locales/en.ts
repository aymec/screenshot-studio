export const en = {
  brandSubtitle: 'App Store panel · 1242 × 2688',
  about: 'About',
  light: 'Light',
  dark: 'Dark',
  closeControls: 'Close controls',
  showControls: 'Show controls',
  switchToLight: 'Switch to light mode',
  switchToDark: 'Switch to dark mode',

  screenshot: 'Screenshot',
  dropImage: 'Click or drop an image',
  replaceImage: 'Replace image',

  caption: 'Caption',
  captionHint: 'Press Enter for a line break.',
  highlightedWords: 'Highlighted words',
  noWords: 'No words yet',

  backgroundColor: 'Background color',
  highlightColor: 'Highlight color',
  textColor: 'Text color',

  font: 'Font',
  fontSystem: 'System (SF Pro)',
  fontInter: 'Inter (portable)',
  language: 'Language',

  size: 'Size — {{value}}px',
  weight: 'Weight — {{value}}',
  lineHeight: 'Line height — {{value}}',

  exportPng: 'Export PNG',
  reset: 'Reset to template defaults',

  aboutTitle: 'About this site',
  closeInfo: 'Close info',
  modalTagline: 'Make App Store marketing screenshots in your browser.',
  modalIntro:
    "Drop a raw screenshot from your phone or simulator into an iPhone frame, add a caption with one word picked out in a highlight color, and export a ready-to-upload 1242 × 2688 PNG — the App Store's 6.5\" size. Everything runs locally in your browser: nothing is uploaded anywhere.",

  step1Title: 'Add your screenshot.',
  step1Body:
    "Click the drop zone (or drag an image onto it). It's scaled to fill the phone's screen and cropped from the center, so any size works.",
  step2Title: 'Write the caption.',
  step2Body: 'Press Enter for a line break. It stays centered in the space above the phone.',
  step3Title: 'Pick the highlighted words.',
  step3Body: 'Tap any word chip to toggle it into the highlight color. Tap it again to turn it off.',
  step4Title: 'Set the colors and type.',
  step4Body: 'Background, highlight, and text colors, plus the font, size, weight, and line height.',
  step5Title: 'Export.',
  step5Body:
    'The preview is the real canvas at full resolution, so the PNG you download is exactly what you see.',

  modalFootnote:
    'Your settings are saved in this browser and restored next time. The image is not — drop it in again after a reload.',
  gotIt: 'Got it',
} as const

export type Dict = Record<keyof typeof en, string>
