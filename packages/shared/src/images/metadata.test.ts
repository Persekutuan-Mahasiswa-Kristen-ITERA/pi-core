/**
 * Image metadata stripping — the tests build real container structures byte by byte.
 *
 * Hand-built fixtures rather than checked-in binaries: a fixture I cannot read in the diff is a fixture
 * nobody will maintain, and the point here is precisely which bytes survive. Each case asserts BOTH that
 * the identifying metadata is gone AND that the pieces that make the image render are still there —
 * stripping too much is the failure mode that matters, because it corrupts every upload silently.
 */
import { describe, expect, it } from "vitest";
import { detectImageType, stripImageMetadata } from "./metadata";

function bytes(...parts: Array<number[] | Uint8Array>): Uint8Array {
  const flat: number[] = [];
  for (const part of parts) for (const byte of part) flat.push(byte);
  return new Uint8Array(flat);
}

const asciiBytes = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

function uint16be(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function uint32be(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function uint32le(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

/** `FFxx` + big-endian length (which includes itself) + payload. */
function jpegSegment(marker: number, payload: number[]): number[] {
  return [0xff, marker, ...uint16be(payload.length + 2), ...payload];
}

function buildJpeg(): Uint8Array {
  const exif = [...asciiBytes("Exif"), 0, 0, ...asciiBytes("GPS 51.5N 0.1W Canon EOS")];
  return bytes(
    [0xff, 0xd8], // SOI
    jpegSegment(0xe0, [...asciiBytes("JFIF"), 0]), // APP0 — kept
    jpegSegment(0xe1, exif), // APP1 — dropped
    jpegSegment(0xed, asciiBytes("Photoshop 3.0 IPTC")), // APP13 — dropped
    jpegSegment(0xfe, asciiBytes("shot by someone")), // COM — dropped
    jpegSegment(0xe2, [...asciiBytes("ICC_PROFILE"), 0, 1, 2, 3]), // APP2 — kept (colour)
    jpegSegment(0xc0, [8, 0, 16, 0, 16, 1, 1, 0x11, 0]), // SOF0
    [0xff, 0xda, 0, 4, 1, 1], // SOS
    [0x12, 0x34, 0x56, 0x78], // entropy data
    [0xff, 0xd9], // EOI
  );
}

function pngChunk(type: string, payload: number[]): number[] {
  // The CRC is not validated by the stripper, so a placeholder keeps the fixture readable.
  return [...uint32be(payload.length), ...asciiBytes(type), ...payload, 0, 0, 0, 0];
}

function buildPng(): Uint8Array {
  return bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    pngChunk("IHDR", [...uint32be(16), ...uint32be(16), 8, 6, 0, 0, 0]),
    pngChunk("sRGB", [0]),
    pngChunk("tEXt", asciiBytes("Comment\u0000taken in Bandar Lampung")),
    pngChunk("eXIf", [...asciiBytes("MM"), 0, 42]),
    pngChunk("IDAT", [1, 2, 3, 4, 5]),
    pngChunk("IEND", []),
  );
}

function webpChunk(fourcc: string, payload: number[]): number[] {
  const padding = payload.length % 2 === 1 ? [0] : [];
  return [...asciiBytes(fourcc), ...uint32le(payload.length), ...payload, ...padding];
}

function buildWebp(): Uint8Array {
  const chunks = [
    webpChunk("VP8X", [0x0c, 0, 0, 0, 15, 0, 0, 15, 0, 0]), // flags with EXIF|XMP set
    webpChunk("VP8L", [0x2f, 1, 2, 3, 4, 5]),
    webpChunk("EXIF", asciiBytes("Exif\u0000\u0000GPS")),
    webpChunk("XMP ", asciiBytes("<x:xmpmeta>author</x:xmpmeta>")),
  ];
  const body: number[] = [...asciiBytes("WEBP")];
  for (const chunk of chunks) body.push(...chunk);
  return bytes(asciiBytes("RIFF"), uint32le(body.length), body);
}

describe("detectImageType", () => {
  it("identifies each supported container from its magic bytes", () => {
    expect(detectImageType(buildJpeg())).toBe("image/jpeg");
    expect(detectImageType(buildPng())).toBe("image/png");
    expect(detectImageType(buildWebp())).toBe("image/webp");
  });

  it("refuses anything that is not one of the three", () => {
    // The case that matters: a client can declare `image/png` and send this instead.
    expect(detectImageType(bytes(asciiBytes("<?php system($_GET['c']); ?>")))).toBeNull();
    expect(detectImageType(bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBeNull(); // GIF89a
    expect(detectImageType(bytes([]))).toBeNull();
    expect(detectImageType(bytes([0xff, 0xd8]))).toBeNull(); // truncated JPEG
  });
});

describe("stripImageMetadata", () => {
  it("removes JPEG EXIF, IPTC and comments", () => {
    const stripped = stripImageMetadata(buildJpeg());
    const text = String.fromCharCode(...stripped);
    expect(text).not.toContain("GPS");
    expect(text).not.toContain("Canon");
    expect(text).not.toContain("Photoshop");
    expect(text).not.toContain("shot by someone");
  });

  it("keeps the JPEG parts that make it render", () => {
    const stripped = stripImageMetadata(buildJpeg());
    const text = String.fromCharCode(...stripped);
    expect(text).toContain("JFIF"); // APP0
    expect(text).toContain("ICC_PROFILE"); // APP2 — colour, not identity
    expect(stripped[0]).toBe(0xff);
    expect(stripped[1]).toBe(0xd8); // SOI
    expect(stripped[stripped.length - 2]).toBe(0xff);
    expect(stripped[stripped.length - 1]).toBe(0xd9); // EOI still last
    expect(text).toContain("\u0012\u0034\u0056\u0078"); // entropy data survived
  });

  it("removes PNG text and EXIF chunks", () => {
    const stripped = stripImageMetadata(buildPng());
    const text = String.fromCharCode(...stripped);
    expect(text).not.toContain("tEXt");
    expect(text).not.toContain("Bandar Lampung");
    expect(text).not.toContain("eXIf");
  });

  it("keeps the PNG signature, IHDR and IDAT", () => {
    const stripped = stripImageMetadata(buildPng());
    const text = String.fromCharCode(...stripped);
    expect(text).toContain("IHDR");
    expect(text).toContain("sRGB");
    expect(text).toContain("IDAT");
    expect(text).toContain("IEND");
    expect(stripped[0]).toBe(0x89);
  });

  it("removes WebP EXIF and XMP chunks and clears the VP8X flags", () => {
    const stripped = stripImageMetadata(buildWebp());
    const text = String.fromCharCode(...stripped);
    expect(text).not.toContain("EXIF");
    expect(text).not.toContain("XMP ");
    expect(text).not.toContain("xmpmeta");
    expect(text).toContain("VP8L"); // pixel data survives
    expect(text).toContain("VP8X");
    // Flags byte sits at offset 20 (12 header + 4 fourcc + 4 size).
    expect((stripped[20] ?? 0xff) & 0x0c).toBe(0);
  });

  it("fixes the RIFF size after dropping WebP chunks", () => {
    const original = buildWebp();
    const stripped = stripImageMetadata(original);
    const declared = (stripped[4] ?? 0) | ((stripped[5] ?? 0) << 8) | ((stripped[6] ?? 0) << 16) | ((stripped[7] ?? 0) << 24);
    expect(declared).toBe(stripped.length - 8);
    expect(stripped.length).toBeLessThan(original.length);
  });

  it("returns unrecognised input untouched rather than guessing", () => {
    const notAnImage = bytes(asciiBytes("just some text, definitely not an image"));
    expect(stripImageMetadata(notAnImage)).toBe(notAnImage);
  });

  it("does not corrupt a truncated JPEG", () => {
    const truncated = bytes([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x40]); // claims 64 bytes, has 0
    const stripped = stripImageMetadata(truncated);
    expect(stripped[0]).toBe(0xff);
    expect(stripped[1]).toBe(0xd8);
    expect(stripped.length).toBeGreaterThanOrEqual(2);
  });
});
