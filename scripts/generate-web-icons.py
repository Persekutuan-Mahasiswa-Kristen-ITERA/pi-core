#!/usr/bin/env python3
"""Regenerate the web app's favicon and home-screen icons from the organization's logo.

Source: `PMK_LOGO-removebg-preview.png` at the repo root (the official PMK ITERA seal,
transparent PNG, 500x500). Next.js serves `src/app/favicon.ico`, `src/app/icon.png` and
`src/app/apple-icon.png` by filename convention, so the files are written there directly.

Run from the repo root: `python3 scripts/generate-web-icons.py`
Requires Pillow (`pip install pillow`).
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "PMK_LOGO-removebg-preview.png"
APP = ROOT / "apps" / "web" / "src" / "app"

# The seal is circular with a wide transparent margin, so trim to the artwork before resizing —
# otherwise the mark shrinks to a dot inside a 16px tab.
def trimmed(image: Image.Image) -> Image.Image:
    box = image.getchannel("A").getbbox()
    return image.crop(box) if box is not None else image


def square(image: Image.Image, size: int, background: tuple[int, int, int] | None) -> Image.Image:
    """Fit the mark inside `size`, centred, on a transparent or solid canvas."""
    fitted = trimmed(image)
    scale = min(size / fitted.width, size / fitted.height)
    resized = fitted.resize(
        (max(1, round(fitted.width * scale)), max(1, round(fitted.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size), (*background, 255) if background else (0, 0, 0, 0))
    canvas.paste(resized, ((size - resized.width) // 2, (size - resized.height) // 2), resized)
    return canvas


def main() -> None:
    logo = Image.open(SOURCE).convert("RGBA")

    # 16/32/48 in one .ico; a browser picks the closest.
    square(logo, 48, None).save(
        APP / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )

    # Android/Chrome install icon and the PWA touch icon.
    square(logo, 256, None).save(APP / "icon.png", format="PNG")

    # iOS composites transparency onto black, which hides the dark ring: give it white.
    square(logo, 180, (255, 255, 255)).convert("RGB").save(APP / "apple-icon.png", format="PNG")

    for path in ("favicon.ico", "icon.png", "apple-icon.png"):
        written = Image.open(APP / path)
        print(f"{path}: {written.format} {written.size} from {SOURCE.name}")


if __name__ == "__main__":
    main()
