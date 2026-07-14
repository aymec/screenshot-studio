/**
 * The browser's own database, holding the user's projects — designs *and* the image bytes.
 *
 * localStorage cannot do this job: it stores strings, and about 5MB of them. A phone capture is
 * several MB of binary, so it would have to be base64'd (a third larger again) and would blow the
 * quota on the first screenshot. That is why a reload used to come back with empty screens.
 * IndexedDB stores binary as binary, and its quota is a share of free disk.
 *
 * A project is stored across two object stores, written together in one transaction:
 *
 * - `projects` — the whole thing, images included. Reading one costs whatever its images weigh.
 * - `slots`    — just the id, name, and mtime of each project.
 *
 * The split exists so that listing the user's projects doesn't have to read every image in every
 * one of them into memory just to print their names.
 *
 * Every call here can reject: private-mode browsers can refuse to open a database at all. Nothing
 * in this module is load-bearing for rendering — a failure costs durability, not the app.
 */
import type { Design } from './template'

const DB_NAME = 'screenshot-studio'
const DB_VERSION = 1
const PROJECTS = 'projects'
const SLOTS = 'slots'

/** The id of the project the app autosaves into. Slots the user names sit beside it. */
export const CURRENT_SLOT = 'current'

/** The bytes of a capture, as they were picked. See the Shot type in App.tsx. */
export interface StoredImage {
  name: string
  type: string
  bytes: Uint8Array
}

export interface StoredSlide {
  design: Design
  image: StoredImage | null
}

export interface StoredDevice {
  /** Which of this device's screenshots was on the canvas. */
  cursor: number
  slides: StoredSlide[]
}

/**
 * A whole project: every device's deck, and which device was selected.
 *
 * This is deliberately the same shape a saved .zip's manifest describes — the only difference is
 * that here an image's bytes sit inline, and there they are a separate entry in the archive. One
 * shape, so saving to a file and saving to the database are the same serialization.
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
      if (!database.objectStoreNames.contains(SLOTS)) {
        database.createObjectStore(SLOTS, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  // A failed open must not be cached as the answer forever — the next call gets to try again.
  db.catch(() => {
    db = null
  })
  return db
}

export async function getProject(id: string): Promise<StoredProject | null> {
  const database = await open()
  const tx = database.transaction(PROJECTS, 'readonly')
  const project = await promisify<StoredProject | undefined>(tx.objectStore(PROJECTS).get(id))
  return project ?? null
}

/** Write the project and its slot entry together, so a listed project always has a record. */
export async function putProject(project: StoredProject): Promise<void> {
  const database = await open()
  const tx = database.transaction([PROJECTS, SLOTS], 'readwrite')
  const slot: Slot = { id: project.id, name: project.name, updatedAt: project.updatedAt }
  tx.objectStore(PROJECTS).put(project)
  tx.objectStore(SLOTS).put(slot)
  await committed(tx)
}

export async function deleteProject(id: string): Promise<void> {
  const database = await open()
  const tx = database.transaction([PROJECTS, SLOTS], 'readwrite')
  tx.objectStore(PROJECTS).delete(id)
  tx.objectStore(SLOTS).delete(id)
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
