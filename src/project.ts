/**
 * A project is every device's deck of screenshots — the designs, and the captures dropped into
 * them. This module is the boundary between the live state the app edits and the inert record
 * that gets stored, and it is the only place that turns one into the other.
 *
 * There is one such record and two places it goes: the browser's database (`src/db.ts`, bytes
 * inline) and a saved .zip (bytes as archive entries). Both read back through `fromProject`, so
 * both get the same validation.
 *
 * That validation matters because a stored project is *untrusted input*. A .zip is a file on
 * disk that anyone can edit, and a database record can outlive the build that wrote it. Nothing
 * from either is handed to the renderer without passing through `sanitizeDesign`.
 */
import type { StoredImage, StoredProject, StoredSlide } from './db'
import { blobToImage } from './render'
import {
  DEFAULT_DESIGN,
  FONTS,
  MAX_SCREENSHOTS,
  PRESETS,
  presetById,
  type Design,
} from './template'
import { unzip } from './unzip'
import type { ZipEntry } from './zip'

/**
 * The capture on a screenshot: the decoded image the canvas draws, and the bytes of the file it
 * came from. The bytes are kept because they are what gets saved — re-encoding the image element
 * through a canvas would store a recompressed PNG of the user's file rather than the file itself.
 *
 * `key` is where those bytes live in storage. It is minted once, when the file is picked, and the
 * bytes under it never change; that is what lets a save write the design on every keystroke while
 * writing each image exactly once.
 */
export interface Shot {
  key: string
  img: HTMLImageElement
  name: string
  bytes: Uint8Array
  type: string
}

/** One marketing screenshot: the panel's design, and the phone capture dropped into it. */
export interface Slide {
  design: Design
  shot: Shot | null
}

/** A device's screenshots, in the order they will be exported. Every device has its own. */
export type Decks = Record<string, Slide[]>

export const blankDeck = (): Slide[] => [{ design: { ...DEFAULT_DESIGN }, shot: null }]

export const emptyDecks = (): Decks =>
  Object.fromEntries(PRESETS.map((p) => [p.id, blankDeck()]))

const FONT_STACKS = new Set<string>(FONTS.map((f) => f.stack))

const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback)
const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

/**
 * A `Design` from storage, with every field either the user's or the template's.
 *
 * The spread is what lets a project written by an older build pick up fields it never knew about:
 * they arrive as the current defaults instead of as `undefined`.
 *
 * `fontFamily` gets a stricter check than the rest because it is the one field handed straight to
 * `ctx.font`. A stack this build does not ship cannot be drawn the same way on two machines — the
 * whole point of bundling Inter — so anything unrecognized falls back rather than rendering in
 * whatever the canvas happens to resolve it to.
 */
export function sanitizeDesign(input: unknown): Design {
  const d = (input ?? {}) as Partial<Design>
  return {
    backgroundColor: str(d.backgroundColor, DEFAULT_DESIGN.backgroundColor),
    sentence: str(d.sentence, DEFAULT_DESIGN.sentence),
    highlightIndices: Array.isArray(d.highlightIndices)
      ? d.highlightIndices.filter((n) => Number.isInteger(n) && n >= 0)
      : [...DEFAULT_DESIGN.highlightIndices],
    highlightColor: str(d.highlightColor, DEFAULT_DESIGN.highlightColor),
    textColor: str(d.textColor, DEFAULT_DESIGN.textColor),
    fontFamily: FONT_STACKS.has(str(d.fontFamily, ''))
      ? (d.fontFamily as string)
      : DEFAULT_DESIGN.fontFamily,
    fontSize: num(d.fontSize, DEFAULT_DESIGN.fontSize),
    fontWeight: num(d.fontWeight, DEFAULT_DESIGN.fontWeight),
    lineHeight: num(d.lineHeight, DEFAULT_DESIGN.lineHeight),
  }
}

/**
 * The live decks, flattened into the record that gets stored, plus the images it refers to.
 *
 * The two come apart because they are written on completely different schedules: the record is
 * small and is rewritten on every edit, while an image is written once, under the key its shot has
 * carried since the file was picked.
 */
export function toProject(
  id: string,
  name: string,
  decks: Decks,
  cursors: Record<string, number>,
  deviceId: string,
): { project: StoredProject; images: StoredImage[] } {
  const images: StoredImage[] = []

  const project: StoredProject = {
    id,
    name,
    updatedAt: Date.now(),
    // Only a preset this build knows about: the id is what a load resolves geometry from.
    deviceId: presetById(deviceId).id,
    devices: Object.fromEntries(
      PRESETS.map((p) => {
        const slides = decks[p.id] ?? blankDeck()
        return [
          p.id,
          {
            cursor: Math.min(Math.max(cursors[p.id] ?? 0, 0), slides.length - 1),
            slides: slides.map((s): StoredSlide => {
              if (!s.shot) return { design: s.design, image: null }
              const { key, name: file, type, bytes } = s.shot
              images.push({ key, name: file, type, bytes })
              return { design: s.design, image: key }
            }),
          },
        ]
      }),
    ),
  }

  return { project, images }
}

/** A screenshot's picture, decoded. A corrupt one costs its picture, not the whole load. */
async function decodeShot(image: StoredImage | undefined): Promise<Shot | null> {
  if (!image?.bytes) return null
  try {
    // A record read back from a database or an archive may hold a plain buffer, not a view.
    const bytes = image.bytes instanceof Uint8Array ? image.bytes : new Uint8Array(image.bytes)
    const type = str(image.type, '')
    return {
      key: image.key,
      img: await blobToImage(bytes, type),
      name: str(image.name, 'image'),
      bytes,
      type,
    }
  } catch {
    return null
  }
}

/** Every image key a project's screenshots point at, so a caller knows what to go and fetch. */
export function imageKeys(project: StoredProject): string[] {
  const keys: string[] = []
  for (const device of Object.values(project?.devices ?? {})) {
    for (const slide of device?.slides ?? []) {
      if (slide?.image) keys.push(slide.image)
    }
  }
  return keys
}

/**
 * The stored record and its images, back into live state. Every image is decoded before anything
 * is returned, so a caller can drop the whole thing into state in one write — no half-loaded deck,
 * and no slow decode landing on a screenshot the user has since switched away from.
 *
 * An image the store has lost costs its screenshot's picture, not the load: the design, caption,
 * and colors of that screenshot still come back, over an empty frame.
 */
export async function fromProject(
  // Only the parts a project is rebuilt from, so a manifest — which has no storage id — fits too.
  project: Pick<StoredProject, 'deviceId' | 'devices'>,
  images: Map<string, StoredImage>,
): Promise<{ decks: Decks; cursors: Record<string, number>; deviceId: string }> {
  const decks = emptyDecks()
  const cursors: Record<string, number> = {}

  for (const [id, device] of Object.entries(project?.devices ?? {})) {
    // A preset dropped from a later build leaves screenshots nothing can render them.
    if (!(id in decks)) continue
    const stored = Array.isArray(device?.slides) ? device.slides.slice(0, MAX_SCREENSHOTS) : []
    if (stored.length === 0) continue

    decks[id] = await Promise.all(
      stored.map(async (s) => ({
        design: sanitizeDesign(s?.design),
        shot: await decodeShot(s?.image ? images.get(s.image) : undefined),
      })),
    )
    cursors[id] = Math.min(Math.max(num(device?.cursor, 0), 0), decks[id].length - 1)
  }

  return { decks, cursors, deviceId: presetById(str(project?.deviceId, '')).id }
}

/* --------------------------------------------------------------------------------------------
 * The project file: a zip holding one manifest and every image, which is what the user gets to
 * keep, back up, and move to another machine. The database survives a reload; this survives the
 * browser.
 * ------------------------------------------------------------------------------------------ */

export const PROJECT_KIND = 'screenshot-studio-project'
export const PROJECT_VERSION = 1
const MANIFEST = 'project.json'

/**
 * What the manifest says, on top of the stored project: what kind of file this is, and the name
 * and type of the file each image entry was made from.
 *
 * A slide's `image` here is the *path of an entry in this archive*, not a database key — the
 * archive is self-contained, and a key into a database on some other machine would mean nothing.
 * Everything else is the record from `toProject` verbatim, so a saved project and a stored one
 * are the same shape and read back through the same `fromProject`.
 */
interface Manifest extends Omit<StoredProject, 'id'> {
  kind: string
  version: number
  images: Record<string, { name: string; type: string }>
}

/** Images are written under an opaque path, so the name is recorded rather than derived. */
const extensionOf = (image: StoredImage): string => {
  const named = /\.([a-z0-9]{1,5})$/i.exec(image.name)?.[1]
  if (named) return named.toLowerCase()
  const typed = /^image\/([a-z0-9+.-]+)$/i.exec(image.type)?.[1]
  return typed === 'jpeg' ? 'jpg' : (typed ?? 'png')
}

/**
 * The whole project as zip entries: the manifest, then one entry per image.
 *
 * Image paths are indexed (`images/iphone-6.5/3.png`), never derived from the caption the way the
 * PNG export names its files. Captions collide across screenshots, can be empty, and can be
 * entirely CJK — all three would silently put two screenshots' images at one path. The manifest
 * names the path for each screenshot explicitly, so nothing depends on guessing it back.
 */
export function toZip(
  decks: Decks,
  cursors: Record<string, number>,
  deviceId: string,
  name: string,
): ZipEntry[] {
  const { project, images } = toProject('project', name, decks, cursors, deviceId)
  const byKey = new Map(images.map((i) => [i.key, i]))
  const paths = new Map<string, string>()
  const meta: Manifest['images'] = {}
  const entries: ZipEntry[] = []

  for (const [id, device] of Object.entries(project.devices)) {
    device.slides.forEach((slide, i) => {
      const image = slide.image ? byKey.get(slide.image) : undefined
      if (!image) return
      // Two screenshots can hold the same capture; it is written once and pointed at twice.
      let path = paths.get(image.key)
      if (!path) {
        path = `images/${id}/${i + 1}.${extensionOf(image)}`
        paths.set(image.key, path)
        meta[path] = { name: image.name, type: image.type }
        entries.push({ name: path, data: image.bytes })
      }
      slide.image = path
    })
  }

  // The project's storage id is left out: it names a row in this browser's database, and means
  // nothing in a file that is meant to open on someone else's machine.
  const { id: _id, ...rest } = project
  const manifest: Manifest = {
    kind: PROJECT_KIND,
    version: PROJECT_VERSION,
    ...rest,
    images: meta,
  }
  // The manifest goes first: it is what anyone opening the archive looks at, and what a reader
  // needs before it can make sense of anything else in there.
  entries.unshift({
    name: MANIFEST,
    data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
  })
  return entries
}

/** Why a file could not be opened as a project. The caller turns these into something readable. */
export type LoadFailure = 'unreadable' | 'not-a-project' | 'too-new'

export class ProjectLoadError extends Error {
  reason: LoadFailure

  constructor(reason: LoadFailure) {
    super(reason)
    this.reason = reason
  }
}

/**
 * A project file, back into live state.
 *
 * Everything in here is untrusted: it is a file on disk that anyone can edit, and it may have been
 * written by a different build. The kind and version are checked, the designs are sanitized, and
 * an image the archive is missing costs that screenshot its picture rather than the load.
 */
export async function fromZip(
  blob: Blob,
): Promise<{ decks: Decks; cursors: Record<string, number>; deviceId: string; name: string }> {
  let files
  try {
    files = await unzip(blob)
  } catch {
    // Not a zip, or a damaged one. Either way there is nothing here to open.
    throw new ProjectLoadError('unreadable')
  }

  const entry = files.find((f) => f.name === MANIFEST)
  if (!entry) throw new ProjectLoadError('not-a-project')

  let manifest: Manifest
  try {
    manifest = JSON.parse(new TextDecoder().decode(entry.bytes)) as Manifest
  } catch {
    throw new ProjectLoadError('not-a-project')
  }
  if (manifest?.kind !== PROJECT_KIND) throw new ProjectLoadError('not-a-project')
  // A file from a later version may lean on things this build has no idea how to draw. Better to
  // say so than to open two thirds of someone's project and let them save it back over the rest.
  if (num(manifest.version, 0) > PROJECT_VERSION) throw new ProjectLoadError('too-new')

  const images = new Map<string, StoredImage>()
  for (const file of files) {
    if (file.name === MANIFEST) continue
    const described = manifest.images?.[file.name]
    images.set(file.name, {
      // A *fresh* key, not the archive path. The path is only unique within one archive: load two
      // projects and both would claim `images/iphone-6.5/1.png`, and the second one's picture
      // would be silently dropped in favor of the first one's bytes already under that key.
      key: crypto.randomUUID(),
      name: str(described?.name, file.name),
      type: str(described?.type, ''),
      bytes: file.bytes,
    })
  }

  const restored = await fromProject(manifest, images)
  return { ...restored, name: str(manifest.name, 'project') }
}
