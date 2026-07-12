export const en = {
  // The store and the canvas size both follow the selected device, so they are parameters.
  brandSubtitle: '{{store}} panel · {{size}}',
  about: 'About',
  light: 'Light',
  dark: 'Dark',
  closeControls: 'Close controls',
  showControls: 'Show controls',
  switchToLight: 'Switch to light mode',
  switchToDark: 'Switch to dark mode',

  device: 'Device',
  screenshot: 'Screenshot',
  dropImage: 'Click or drop an image',
  replaceImage: 'Replace image',

  // The strip under the preview. `screenshotN` names one screenshot of the device's set; it is
  // also the chip's accessible name, so it has to contain the number the chip shows.
  screenshots: 'Screenshots',
  screenshotN: 'Screenshot {{n}}',
  previousScreenshot: 'Previous screenshot',
  nextScreenshot: 'Next screenshot',
  addScreenshot: 'Add screenshot',
  deleteScreenshot: 'Delete screenshot {{n}}',
  deleteScreenshotBody: 'Its image, caption, and colors go with it. This cannot be undone.',
  yes: 'Yes',
  no: 'No',

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
  exportAll: 'Export all',
  exporting: 'Exporting…',
  reset: 'Reset to template defaults',

  aboutTitle: 'About this site',
  closeInfo: 'Close info',
  modalTagline: 'Make App Store and Google Play marketing screenshots in your browser.',
  modalIntro:
    'Pick a device, drop a raw screenshot from your phone, tablet, or simulator into its frame, add a caption with one word picked out in a highlight color, and export a ready-to-upload PNG at the exact size that store asks for. Everything runs locally in your browser: nothing is uploaded anywhere.',

  step1Title: 'Pick the device and add your screenshot.',
  step1Body:
    "Choose an iPhone, iPad, Android phone, or Android tablet, then click the drop zone (or drag an image onto it). It's scaled to fill the device's screen and cropped from the center, so any size works.",
  step2Title: 'Write the caption.',
  step2Body: 'Press Enter for a line break. It stays centered in the space above the device.',
  step3Title: 'Pick the highlighted words.',
  step3Body: 'Tap any word chip to toggle it into the highlight color. Tap it again to turn it off.',
  step4Title: 'Set the colors and type.',
  step4Body: 'Background, highlight, and text colors, plus the font, size, weight, and line height.',
  step5Title: 'Build the whole set.',
  step5Body:
    'Add up to 10 screenshots per device with the + under the preview, and switch between them with the numbered chips. Each one keeps its own image, caption, colors, and type.',
  step6Title: 'Export.',
  step6Body:
    'The preview is the real canvas at full resolution, so the PNG you download is exactly what you see. Export the screenshot you are on, or the whole set at once.',

  modalFootnote:
    'Your settings are saved in this browser and restored next time. The images are not — drop them in again after a reload.',
  gotIt: 'Got it',
} as const

export type Dict = Record<keyof typeof en, string>
