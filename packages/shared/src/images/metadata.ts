/**
 * Image metadata stripping — closes the NFR-8 gap left open by story 4.4.
 *
 * Story 4.4 shipped a presigned PUT, which is the right shape for the Workers free plan (no bytes through
 * the Worker, no CPU spent on I/O). But a presigned PUT cannot rewrite the object, so "metadata stripped"
 * could not be honoured on the way in — the client's bytes land in R2 verbatim, EXIF and all. The gap was
 * recorded rather than papered over, and this module is the fix.
 *
 * The fix does NOT need an image decoder. Metadata in JPEG, PNG and WebP lives in *separate segments or
 * chunks* around the compressed pixel data, so removing it is a structural walk over the container and a
 * copy of the pieces we keep — no entropy decoding, no canvas, no dependency. That matters on the free
 * plan: it is a linear scan, not a transform, so a 2 MiB avatar costs a few milliseconds rather than a
 * decode plus re-encode.
 *
 * WHAT IS REMOVED, AND WHAT IS DELIBERATELY KEPT — the distinction is the whole point, because "strip all
 * metadata" is the wrong instruction:
 *
 *   removed (privacy-bearing): JPEG APP1 (EXIF + XMP), APP13 (IPTC/Photoshop), COM (comments);
 *                              PNG tEXt/zTXt/iTXt/eXIf/tIME; WebP EXIF and XMP chunks
 *   kept (NOT privacy-bearing, and removing them changes how the image renders):
 *                              JPEG APP0 (JFIF), APP2 (ICC colour profile), APP14 (Adobe colour
 *                              transform); PNG colour chunks (IHDR/PLTE/gAMA/sRGB/cHRM/tRNS/bKGD/pHYs);
 *                              WebP ICCP, VP8/VP8L/VP8X/ALPH
 *
 * Stripping an ICC profile or the Adobe transform would silently shift the colours of every uploaded
 * photo. Stripping only what identifies a person or a device is the actual requirement.
 *
 * KNOWN CONSEQUENCE, stated because it is user-visible: EXIF also carries the *orientation* tag, so a
 * photo straight off a phone that relies on it will no longer be auto-rotated. The correct place to
 * handle that is the uploader, which re-encodes through a canvas and bakes the rotation in — which is
 * also what makes the upload a re-encode rather than a passthrough. Stripping orientation server-side
 * and pretending nothing happened would be worse than saying so.
 */

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Identify an image from its magic bytes, not from the declared content type.
 *
 * This is what makes the upload check meaningful: a client can call a file anything, but it cannot change
 * what the first bytes are. Anything that is not a real JPEG/PNG/WebP is refused.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let i = start; i < start + length; i += 1) out += String.fromCharCode(bytes[i] ?? 0);
  return out;
}

function readUint32(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
  const b0 = bytes[offset] ?? 0;
  const b1 = bytes[offset + 1] ?? 0;
  const b2 = bytes[offset + 2] ?? 0;
  const b3 = bytes[offset + 3] ?? 0;
  return littleEndian
    ? (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0
    : ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
}

function writeUint32(target: Uint8Array, offset: number, value: number, littleEndian: boolean): void {
  if (littleEndian) {
    target[offset] = value & 0xff;
    target[offset + 1] = (value >>> 8) & 0xff;
    target[offset + 2] = (value >>> 16) & 0xff;
    target[offset + 3] = (value >>> 24) & 0xff;
  } else {
    target[offset] = (value >>> 24) & 0xff;
    target[offset + 1] = (value >>> 16) & 0xff;
    target[offset + 2] = (value >>> 8) & 0xff;
    target[offset + 3] = value & 0xff;
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** APP1 (EXIF/XMP), APP13 (IPTC) and COM carry the identifying metadata. APP0/APP2/APP14 do not. */
function isPrivateJpegMarker(marker: number): boolean {
  return marker === 0xe1 || marker === 0xed || marker === 0xfe;
}

function stripJpeg(bytes: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [bytes.subarray(0, 2)]; // SOI
  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) {
      // Not a marker boundary — the container is malformed. Keep the rest untouched rather than
      // guessing, so a file we do not understand is never silently corrupted.
      kept.push(bytes.subarray(i));
      return concat(kept);
    }
    const marker = bytes[i + 1] ?? 0;
    // Standalone markers have no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (marker === 0xda) {
      // Start of scan: everything from here to the end is entropy-coded pixel data.
      kept.push(bytes.subarray(i));
      return concat(kept);
    }
    if (i + 3 >= bytes.length) {
      kept.push(bytes.subarray(i));
      return concat(kept);
    }
    const segmentLength = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
    const end = i + 2 + segmentLength;
    if (segmentLength < 2 || end > bytes.length) {
      kept.push(bytes.subarray(i));
      return concat(kept);
    }
    if (!isPrivateJpegMarker(marker)) kept.push(bytes.subarray(i, end));
    i = end;
  }
  return concat(kept);
}

/** Text/EXIF/time chunks. Colour and pixel chunks are untouched. */
const PNG_STRIP = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);

function stripPng(bytes: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [bytes.subarray(0, 8)];
  let i = 8;
  while (i + 8 <= bytes.length) {
    const chunkLength = readUint32(bytes, i, false);
    const type = ascii(bytes, i + 4, 4);
    const end = i + 12 + chunkLength;
    if (end > bytes.length) {
      kept.push(bytes.subarray(i));
      return concat(kept);
    }
    if (!PNG_STRIP.has(type)) kept.push(bytes.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return concat(kept);
}

function stripWebp(bytes: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [];
  let i = 12; // "RIFF" + size + "WEBP"
  let sawVp8x = false;
  while (i + 8 <= bytes.length) {
    const fourcc = ascii(bytes, i, 4);
    const chunkSize = readUint32(bytes, i + 4, true);
    const padded = chunkSize + (chunkSize % 2);
    const end = i + 8 + padded;
    if (end > bytes.length) break;
    if (fourcc === "EXIF" || fourcc === "XMP ") {
      // dropped
    } else if (fourcc === "VP8X") {
      sawVp8x = true;
      kept.push(bytes.subarray(i, end));
    } else {
      kept.push(bytes.subarray(i, end));
    }
    i = end;
  }

  const body = concat(kept);
  const out = new Uint8Array(12 + body.length);
  out.set(bytes.subarray(0, 12), 0);
  out.set(body, 12);
  writeUint32(out, 4, 4 + body.length, true); // RIFF size = "WEBP" + chunks

  if (sawVp8x) {
    // VP8X flags advertise which optional chunks are present. Leaving the EXIF/XMP bits set after
    // removing those chunks produces a file that claims metadata it no longer has.
    let offset = 12;
    while (offset + 8 <= out.length) {
      const fourcc = ascii(out, offset, 4);
      const size = readUint32(out, offset + 4, true);
      if (fourcc === "VP8X") {
        const flagsIndex = offset + 8;
        out[flagsIndex] = (out[flagsIndex] ?? 0) & ~0x0c; // clear EXIF (0x08) and XMP (0x04)
        break;
      }
      offset += 8 + size + (size % 2);
    }
  }
  return out;
}

/**
 * Remove identifying metadata. Returns the input unchanged when the type is not recognised, so a caller
 * that skips `detectImageType` cannot have its bytes mangled by a guess.
 */
export function stripImageMetadata(bytes: Uint8Array): Uint8Array {
  switch (detectImageType(bytes)) {
    case "image/jpeg":
      return stripJpeg(bytes);
    case "image/png":
      return stripPng(bytes);
    case "image/webp":
      return stripWebp(bytes);
    default:
      return bytes;
  }
}
