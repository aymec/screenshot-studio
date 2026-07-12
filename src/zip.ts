/**
 * A minimal ZIP writer, so "export all" hands back one file instead of firing ten downloads.
 *
 * Entries are *stored*, not deflated: the payloads are PNGs, which are already deflate
 * compressed, so re-compressing them would buy nothing and cost a dependency. That keeps this
 * to the two headers and a CRC — and keeps the app's runtime dependency list at React.
 */

const crcTable = /* @__PURE__ */ (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** MS-DOS date/time, which is what a ZIP entry stores. Second resolution is 2s — hence the >>> 1. */
function dosTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >>> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

export interface ZipEntry {
  name: string
  data: Uint8Array
}

/** Pack the entries into a ZIP. Sizes here are far below 4GB, so no Zip64 is needed. */
export function zip(entries: ZipEntry[]): Blob {
  const { time, date } = dosTime(new Date())
  const encoder = new TextEncoder()
  const locals: BlobPart[] = []
  const centrals: BlobPart[] = []
  let offset = 0
  let size = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const crc = crc32(entry.data)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true) // local file header
    local.setUint16(4, 20, true) // version needed
    local.setUint16(6, 0, true) // flags
    local.setUint16(8, 0, true) // method: stored
    local.setUint16(10, time, true)
    local.setUint16(12, date, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, entry.data.length, true) // compressed size
    local.setUint32(22, entry.data.length, true) // uncompressed size
    local.setUint16(26, name.length, true)
    local.setUint16(28, 0, true) // extra field length
    locals.push(local.buffer, name, entry.data as BlobPart)

    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true) // central directory header
    central.setUint16(4, 20, true) // version made by
    central.setUint16(6, 20, true) // version needed
    central.setUint16(8, 0, true)
    central.setUint16(10, 0, true)
    central.setUint16(12, time, true)
    central.setUint16(14, date, true)
    central.setUint32(16, crc, true)
    central.setUint32(20, entry.data.length, true)
    central.setUint32(24, entry.data.length, true)
    central.setUint16(28, name.length, true)
    central.setUint16(30, 0, true) // extra
    central.setUint16(32, 0, true) // comment
    central.setUint16(34, 0, true) // disk number
    central.setUint16(36, 0, true) // internal attrs
    central.setUint32(38, 0, true) // external attrs
    central.setUint32(42, offset, true) // where the local header for this entry is
    centrals.push(central.buffer, name)

    offset += 30 + name.length + entry.data.length
    size += 46 + name.length
  }

  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true) // end of central directory
  end.setUint16(4, 0, true) // this disk
  end.setUint16(6, 0, true) // disk with the central directory
  end.setUint16(8, entries.length, true) // entries on this disk
  end.setUint16(10, entries.length, true) // entries total
  end.setUint32(12, size, true) // central directory size
  end.setUint32(16, offset, true) // central directory offset
  end.setUint16(20, 0, true) // comment length

  return new Blob([...locals, ...centrals, end.buffer], { type: 'application/zip' })
}
