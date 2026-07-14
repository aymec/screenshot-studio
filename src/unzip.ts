/**
 * A minimal ZIP reader — the other half of `src/zip.ts`, for loading a saved project back.
 *
 * The writer only ever *stores* entries, and this could have only understood stored entries. It
 * would then fail on a file the user considers perfectly valid: unzip a project, tweak the JSON,
 * re-zip it in Finder or Explorer, and every entry comes back **deflated**, wrapped in a folder,
 * next to a `__MACOSX/` sidecar. So this reads what those tools produce, not just what we write.
 * Inflating costs no dependency: `DecompressionStream` is in the browser already.
 *
 * The central directory is the authority, not the local headers. That is not pedantry — an archive
 * written in one pass sets the sizes in a *data descriptor* after the entry and leaves zeroes in
 * the local header, so trusting local headers reads zero bytes out of a perfectly good file.
 */
import { crc32 } from './zip'

export interface ZipFile {
  name: string
  bytes: Uint8Array
}

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_SIGNATURE = 0x02014b50
const STORED = 0
const DEFLATED = 8

/** The end-of-central-directory record: last in the file, and the only fixed point to start from. */
function findEocd(view: DataView): number {
  // It is 22 bytes, plus a comment of up to 64KB that can otherwise look like anything.
  const earliest = Math.max(0, view.byteLength - 22 - 0xffff)
  for (let i = view.byteLength - 22; i >= earliest; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) return i
  }
  throw new Error('Not a zip file')
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  // `deflate-raw`, not `deflate`: a zip entry has no zlib header around its deflate stream.
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Entries a project can't use, and that a user never put there: the metadata sidecar macOS adds
 * when it zips, the directory entries themselves, and Finder/Explorer's desktop-services files.
 */
const isNoise = (name: string) =>
  name.endsWith('/') || name.startsWith('__MACOSX/') || name.split('/').pop() === '.DS_Store'

/**
 * Zipping a *folder* — which is what a user does when re-zipping an unpacked project — puts every
 * entry under that folder's name. Strip a leading segment shared by everything, so the manifest is
 * at `project.json` whether the archive was written by us or repacked by the OS.
 */
function stripCommonRoot(files: ZipFile[]): ZipFile[] {
  if (files.length === 0) return files
  const root = files[0].name.split('/')[0]
  const shared = files.every((f) => f.name.startsWith(`${root}/`))
  return shared ? files.map((f) => ({ ...f, name: f.name.slice(root.length + 1) })) : files
}

/** Unpack an archive. Rejects if it is not a zip, or if an entry fails its checksum. */
export async function unzip(blob: Blob): Promise<ZipFile[]> {
  const buffer = await blob.arrayBuffer()
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const decoder = new TextDecoder()

  const eocd = findEocd(view)
  const count = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)

  const files: ZipFile[] = []

  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) throw new Error('Damaged zip directory')

    const method = view.getUint16(offset + 10, true)
    const crc = view.getUint32(offset + 16, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))

    offset += 46 + nameLength + extraLength + commentLength

    if (isNoise(name)) continue
    if (method !== STORED && method !== DEFLATED) {
      throw new Error(`Unsupported compression in "${name}"`)
    }

    // The local header repeats the name and extra field, at its own lengths — the extra field is
    // routinely a different size here than in the central directory, so it must be read again.
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const start = localOffset + 30 + localNameLength + localExtraLength
    const raw = bytes.subarray(start, start + compressedSize)

    const data = method === DEFLATED ? await inflate(raw) : new Uint8Array(raw)
    // The checksum is the difference between "this file is damaged" and a corrupt image with no
    // explanation. It is cheap, and the archive is the user's only copy of the project.
    if (crc32(data) !== crc) throw new Error(`"${name}" is damaged`)

    files.push({ name, bytes: data })
  }

  return stripCommonRoot(files)
}
