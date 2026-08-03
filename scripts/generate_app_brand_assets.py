#!/usr/bin/env python3

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts/art_sources/app-brand/aetheria-app-icon-master.png"
OUTPUT = ROOT / "output/imagegen/app-brand/aetheria-app-icon-master.png"
BACKGROUND = (3, 7, 13)

IOS_ICON = ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
IOS_SPLASHES = [
    ROOT / "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png",
    ROOT / "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png",
    ROOT / "ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png",
]

ANDROID_ICON_SIZES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

ANDROID_FOREGROUND_SIZES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}

ANDROID_SPLASH_SIZES = {
    "drawable/splash.png": (480, 320),
    "drawable-port-mdpi/splash.png": (320, 480),
    "drawable-port-hdpi/splash.png": (480, 800),
    "drawable-port-xhdpi/splash.png": (720, 1280),
    "drawable-port-xxhdpi/splash.png": (960, 1600),
    "drawable-port-xxxhdpi/splash.png": (1280, 1920),
    "drawable-land-mdpi/splash.png": (480, 320),
    "drawable-land-hdpi/splash.png": (800, 480),
    "drawable-land-xhdpi/splash.png": (1280, 720),
    "drawable-land-xxhdpi/splash.png": (1600, 960),
    "drawable-land-xxxhdpi/splash.png": (1920, 1280),
}


def resize(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def make_round_icon(master: Image.Image, size: int) -> Image.Image:
    icon = resize(master, size).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    icon.putalpha(mask)
    return icon


def make_adaptive_foreground(master: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGB", (size, size), BACKGROUND)
    safe_size = round(size * 0.72)
    icon = resize(master, safe_size)
    offset = (size - safe_size) // 2
    canvas.paste(icon, (offset, offset))
    return canvas


def make_splash(master: Image.Image, width: int, height: int) -> Image.Image:
    canvas = Image.new("RGB", (width, height), BACKGROUND)
    emblem_size = round(min(width, height) * 0.48)
    emblem = resize(master, emblem_size)
    inset = max(1, round(emblem_size * 0.04))
    mask = Image.new("L", (emblem_size, emblem_size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (inset, inset, emblem_size - inset, emblem_size - inset),
        radius=round(emblem_size * 0.12),
        fill=255,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(round(emblem_size * 0.04)))
    canvas.paste(
        emblem,
        ((width - emblem_size) // 2, (height - emblem_size) // 2),
        mask,
    )
    return canvas


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Brand source is missing: {SOURCE}")

    master = Image.open(SOURCE).convert("RGB")
    master = resize(master, 1024)

    save_png(master, OUTPUT)
    save_png(master, IOS_ICON)
    save_png(resize(master, 512), ROOT / "public/icons/icon-512.png")
    save_png(resize(master, 192), ROOT / "public/icons/icon-192.png")
    save_png(resize(master, 180), ROOT / "public/apple-touch-icon.png")

    for density, size in ANDROID_ICON_SIZES.items():
        directory = ROOT / f"android/app/src/main/res/mipmap-{density}"
        save_png(resize(master, size), directory / "ic_launcher.png")
        save_png(make_round_icon(master, size), directory / "ic_launcher_round.png")

    for density, size in ANDROID_FOREGROUND_SIZES.items():
        directory = ROOT / f"android/app/src/main/res/mipmap-{density}"
        save_png(make_adaptive_foreground(master, size), directory / "ic_launcher_foreground.png")

    ios_splash = make_splash(master, 2732, 2732)
    for path in IOS_SPLASHES:
        save_png(ios_splash, path)

    for relative_path, (width, height) in ANDROID_SPLASH_SIZES.items():
        save_png(
            make_splash(master, width, height),
            ROOT / "android/app/src/main/res" / relative_path,
        )

    print("[app-brand-assets] generated iOS, Android, and PWA assets")


if __name__ == "__main__":
    main()
