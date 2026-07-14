/**
 * The browser's own database, holding the user's projects — designs *and* the image bytes.
 *
 * localStorage cannot do this job: it stores strings, and about 5MB of them. A phone capture is
 * several MB of binary, so it would have to be base64'd (a third larger again) and would blow the
 * quota on the first screenshot. That is why a reload used to come back with empty screens.
 * IndexedDB stores binary as binary, and its quota is a share of free disk.
 *
 * Three object stores, written together in one transaction:
 *
 * - `projects` — a project's decks: the designs, and a *key* per screenshot's image.
 * - `images`   — the bytes, keyed. Written once, when the user picks the file.
 * - `slots`    — just the id, name, and mtime of each project.
 *
 * The splits are what make the saving honest.
 *
 * Images are separate from the designs because otherwise a project is one record with tens of MB
 * of pictures in it, and every keystroke of a caption rewrites all of them. That forces a debounce,
 * and a debounce means a reload can beat the save: the user changes a color, reloads, and the
 * stale record loads back over their edit. Keyed separately, a design write is a few hundred bytes
 * and can happen on every change, so there is no window in which the database is behind the app.
 *
 * `slots` is separate so that listing the user's projects doesn't have to read every image in
 * every one of them into memory just to print their names.
 *
 * Every call here can reject: private-mode browsers can refuse to open a database at all. Nothing
 * in this module is load-bearing for rendering — a failure costs durability, not the app.
 */
import type { Design } from './template'

const DB_NAME = 'screenshot-studio'
const DB_VERSION = 1
const PROJECTS = 'projects'
const IMAGES = 'images'
const SLOTS = 'slots'

/** The id of the project the app autosaves into. Slots the user names sit beside it. */
export const CURRENT_SLOT = 'current'

/** The bytes of a capture, as the user picked them, under the key its screenshot refers to. */
export interface StoredImage {
  key: string
  name: string
  type: string
  bytes: Uint8Array
}

export interface StoredSlide {
  design: Design
  /** The key of this screenshot's image in the `images` store, or null for an empty frame. */
  image: string | null
}

export interface StoredDevice {
  /** Which of this device's screenshots was on the canvas. */
  cursor: number
  slides: StoredSlide[]
}

/**
 * A whole project: every device's deck, and which device was selected.
 *
 * This is deliberately the shape a saved .zip's manifest describes — there, an image key is the
 * path of an entry in the archive; here it is a key into `images`. One shape, so saving to a file
 * and saving to the database stay one serialization rather than two.
 */
export interface StoredProject {
  id: string
  name: string
  updatedAt: number
  deviceId: string
  devices: Record<string, StoredDevice>
}

/** What the `slots` store holds: a project's identity, without the weight of its images. */
export type Slot = Pick<StoredProject, 'id' | 'name' | 'updatedAt'>

/** IndexedDB predates promises; every call in it is an event-emitting request object. */
function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * A write is only durable once the *transaction* commits, which is a later event than the last
 * request's success. Awaiting the request alone would report a save that can still fail.
 */
function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new DOMException('aborted', 'AbortError'))
  })
}

let db: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  db ??= new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('IndexedDB is unavailable'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    // The one place stores may be created. It runs on first open, and again on a version bump.
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(PROJECTS)) {
        database.createObjectStore(PROJECTS, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(IMAGES)) {
        database.createObjectStore(IMAGES, { keyPath: 'key' })
      }
      if (!database.objectStoreNames.contains(SLOTS)) {
        database.createObjectStore(SLOTS, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => {
      const database = request.result
      // Another connection wants to upgrade or delete this database — a second tab running a
      // newer build, say. Holding this one open would block it indefinitely, so step aside and
      // let the next call reopen.
      database.onversionchange = () => {
        database.close()
        db = null
      }
      database.onclose = () => {
        db = null
      }
      resolve(database)
    }
    request.onerror = () => reject(request.error)
  })
  // A failed open must not be cached as the answer forever — the next call gets to try again.
  db.catch(() => {
    db = null
  })
  return db
}

/** Every image key any project still points at. What is not in here is garbage. */
const referencedKeys = (projects: StoredProject[]): Set<string> => {
  const keys = new Set<string>()
  for (const project of projects) {
    for (const device of Object.values(project.devices ?? {})) {
      for (const slide of device?.slides ?? []) {
        if (slide?.image) keys.add(slide.image)
      }
    }
  }
  return keys
}

export async function getProject(id: string): Promise<StoredProject | null> {
  const database = await open()
  const tx = database.transaction(PROJECTS, 'readonly')
  const project = await promisify<StoredProject | undefined>(tx.objectStore(PROJECTS).get(id))
  return project ?? null
}

/** The images a project's slides point at, by key. Missing keys are simply absent. */
export async function getImages(keys: string[]): Promise<Map<string, StoredImage>> {
  const found = new Map<string, StoredImage>()
  if (keys.length === 0) return found
  const database = await open()
  const tx = database.transaction(IMAGES, 'readonly')
  const store = tx.objectStore(IMAGES)
  const images = await Promise.all(
    keys.map((key) => promisify<StoredImage | undefined>(store.get(key))),
  )
  for (const image of images) if (image) found.set(image.key, image)
  return found
}

/**
 * Write the project, its slot entry, and any image it refers to that isn't stored yet.
 *
 * Only *new* images are written: an image's bytes never change once picked, so re-putting them on
 * every caption keystroke would be tens of MB of pointless writes. Images nothing refers to any
 * more are dropped in the same transaction, which is the only thing keeping deleted screenshots
 * from filling the user's disk forever.
 */
export async function saveProject(project: StoredProject, images: StoredImage[]): Promise<void> {
  const database = await open()
  const tx = database.transaction([PROJECTS, IMAGES, SLOTS], 'readwrite')
  const projectStore = tx.objectStore(PROJECTS)
  const imageStore = tx.objectStore(IMAGES)

  const slot: Slot = { id: project.id, name: project.name, updatedAt: project.updatedAt }
  projectStore.put(project)
  tx.objectStore(SLOTS).put(slot)

  const stored = new Set(await promisify<IDBValidKey[]>(imageStore.getAllKeys()))
  for (const image of images) {
    if (!stored.has(image.key)) imageStore.put(image)
  }

  // Garbage-collect against every project, not just this one: two projects can share an image.
  const all = await promisify<StoredProject[]>(projectStore.getAll())
  const live = referencedKeys(all)
  for (const key of stored) {
    if (typeof key === 'string' && !live.has(key)) imageStore.delete(key)
  }

  await committed(tx)
}

export async function deleteProject(id: string): Promise<void> {
  const database = await open()
  const tx = database.transaction([PROJECTS, IMAGES, SLOTS], 'readwrite')
  const projectStore = tx.objectStore(PROJECTS)
  const imageStore = tx.objectStore(IMAGES)

  projectStore.delete(id)
  tx.objectStore(SLOTS).delete(id)

  // The images it held are garbage unless another project points at them too.
  const remaining = (await promisify<StoredProject[]>(projectStore.getAll())).filter(
    (p) => p.id !== id,
  )
  const live = referencedKeys(remaining)
  for (const key of await promisify<IDBValidKey[]>(imageStore.getAllKeys())) {
    if (typeof key === 'string' && !live.has(key)) imageStore.delete(key)
  }

  await committed(tx)
}

/** Newest first: a project list is a list of things to go back to. */
export async function listSlots(): Promise<Slot[]> {
  const database = await open()
  const tx = database.transaction(SLOTS, 'readonly')
  const slots = await promisify<Slot[]>(tx.objectStore(SLOTS).getAll())
  return slots.sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * IndexedDB is durable, but it is not a safe: a browser under storage pressure may evict it.
 * Asking to be exempt costs one call and is not always granted, so nothing depends on the answer.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

/** A quota refusal is the one failure the caller must tell the user about, so name it. */
export const isQuotaError = (e: unknown): boolean =>
  e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)
