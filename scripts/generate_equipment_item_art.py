"""Generate reproducible per-item equipment art from an explicit catalog."""

from __future__ import annotations

import argparse
import colorsys
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_signature_pixel_art import (  # noqa: E402
    add_aura,
    add_sparkles,
    load_palettes,
    seed_rng,
)


REPO_ROOT = Path(__file__).resolve().parents[1]
FAMILY_DIR = REPO_ROOT / "public" / "assets" / "equipment-family" / "items"
OUTPUT_DIR = REPO_ROOT / "public" / "assets" / "equipment-exact" / "auto"
MANIFEST = REPO_ROOT / "src" / "data" / "equipmentArtManifest.json"

CANVAS = 160
CONTRACT_METADATA_KEYS = ("$comment", "version", "catalogSha256", "styleVersion", "art")

TONE_BY_ELEM = {
    "화염": "fire",
    "냉기": "frost",
    "어둠": "shadow",
    "빛": "holy",
    "자연": "nature",
    "대지": "earth",
    "바람": "nature",
    "에테르": "arcane",
}

TONE_BY_TIER = {1: "rust", 2: "steel", 3: "steel", 4: "earth", 5: "holy", 6: "arcane"}


def jittered_hue_shift(image: Image.Image, target_rgb, rng) -> Image.Image:
    """Preserve material value while applying deterministic item-specific hue jitter."""
    th, ts, _ = colorsys.rgb_to_hsv(*(channel / 255.0 for channel in target_rgb))
    th = (th + (rng() - 0.5) * 0.1) % 1.0
    sat_scale = 0.9 + rng() * 0.3
    out = image.copy()
    pixels = out.load()
    for y in range(out.height):
        for x in range(out.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                continue
            hue, saturation, value = colorsys.rgb_to_hsv(red / 255.0, green / 255.0, blue / 255.0)
            if saturation > 0.08:
                hue_delta = ((th - hue + 0.5) % 1.0) - 0.5
                next_hue = (hue + hue_delta * 0.9) % 1.0
                next_saturation = min(1.0, (saturation * 0.82 + ts * 0.3) * sat_scale)
                next_value = value
            elif value > 0.35:
                next_hue = th
                next_saturation = min(1.0, ts * 0.4 * value * sat_scale)
                next_value = value
            else:
                next_hue, next_saturation, next_value = hue, saturation, value
            next_red, next_green, next_blue = colorsys.hsv_to_rgb(next_hue, next_saturation, next_value)
            pixels[x, y] = (int(next_red * 255), int(next_green * 255), int(next_blue * 255), alpha)
    return out


def art_slug(name: str) -> str:
    return "auto-" + hashlib.sha1(name.encode("utf-8")).hexdigest()[:12]


def require_file(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if not resolved.is_file():
        raise FileNotFoundError(f"Missing input path: {resolved}")
    return resolved


def require_directory(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if not resolved.is_dir():
        raise FileNotFoundError(f"Missing input path: {resolved}")
    return resolved


def load_contract_metadata(contract_source: Path) -> dict:
    source_path = require_file(contract_source)
    source = json.loads(source_path.read_text(encoding="utf-8"))
    missing = [key for key in CONTRACT_METADATA_KEYS if key not in source]
    if missing:
        raise ValueError(f"Missing art contract metadata: {', '.join(missing)}")
    return source


def write_manifest(
    entries: dict[str, str],
    manifest_path: Path = MANIFEST,
    contract_source: Path = MANIFEST,
) -> None:
    """Replace generated entries while retaining all Task 2 contract metadata."""
    source = load_contract_metadata(contract_source)
    manifest = {
        **{key: value for key, value in source.items() if key != "entries"},
        "entries": dict(sorted(entries.items())),
    }
    destination = manifest_path.expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def load_catalog(path: Path, source_dir: Path) -> list[dict]:
    catalog_path = require_file(path)
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    if not isinstance(catalog, list):
        raise ValueError(f"Catalog must be a JSON array: {catalog_path}")

    rows: list[dict] = []
    for entry in catalog:
        if not isinstance(entry, dict):
            raise ValueError(f"Catalog entry must be an object: {catalog_path}")
        name = entry.get("name")
        family_key = entry.get("familyKey")
        if not isinstance(name, str) or not name:
            raise ValueError(f"Catalog entry is missing a name: {catalog_path}")
        if not isinstance(family_key, str) or not family_key:
            raise ValueError(f"Catalog entry is missing familyKey: {name}")
        require_file(source_dir / f"{family_key}.png")
        rows.append(entry)
    return rows


def build_item(entry: dict, palettes, source_dir: Path = FAMILY_DIR) -> Image.Image:
    base = Image.open(source_dir / f"{entry['familyKey']}.png").convert("RGBA")
    bounds = base.getchannel("A").getbbox()
    if bounds:
        base = base.crop(bounds)

    tier = int(entry.get("tier") or 1)
    tone_key = TONE_BY_ELEM.get(entry.get("elem") or "", TONE_BY_TIER.get(tier, "steel"))
    tone = palettes[tone_key]
    rng = seed_rng(entry["name"])

    sprite = jittered_hue_shift(base, tone["mid"], rng)
    sprite.thumbnail((132, 132), Image.Resampling.NEAREST)
    position = ((CANVAS - sprite.width) // 2, (CANVAS - sprite.height) // 2)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    if tier >= 5:
        add_aura(canvas, sprite, position, tone["trim"])
    canvas.alpha_composite(sprite, position)
    if tier >= 4:
        add_sparkles(canvas, rng, tone["trim"], count=min(4, tier - 2))
    return canvas


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate per-item equipment art from an explicit catalog.")
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    source_dir = require_directory(args.source_dir)
    catalog = load_catalog(args.catalog, source_dir)
    manifest_path = args.manifest.expanduser().resolve()
    contract_source = manifest_path if manifest_path.is_file() else MANIFEST
    load_contract_metadata(contract_source)

    if args.dry_run:
        print(f"dry run: validated {len(catalog)} equipment catalog rows")
        return

    output_dir = args.output_dir.expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    palettes = load_palettes()
    entries: dict[str, str] = {}
    for entry in catalog:
        slug = art_slug(entry["name"])
        image = build_item(entry, palettes, source_dir)
        image.save(output_dir / f"{slug}.png")
        entries[entry["name"]] = f"auto/{slug}"

    write_manifest(entries, manifest_path, contract_source)
    print(f"{len(entries)} item arts generated → {output_dir}")
    print(f"manifest → {manifest_path}")


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError, OSError, json.JSONDecodeError) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from error
