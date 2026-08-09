#!/usr/bin/env python3
"""Import, validate, and normalize Aetheria canonical character art."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from collections import Counter, deque
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = REPO_ROOT / "src/data/characterArtManifest.json"
DEFAULT_SOURCE_DIR = REPO_ROOT / "scripts/art_sources/characters"
DEFAULT_RUNTIME_DIR = REPO_ROOT / "public/assets/avatars/canonical"
DEFAULT_EVIDENCE_DIR = REPO_ROOT / "docs/evidence/art"

LINEAGE_ORDER = (
    "adventurer",
    "warrior",
    "knight",
    "dragon-knight",
    "berserker",
    "mage",
    "archmage",
    "grand-mage",
    "warlock",
    "cleric",
    "paladin",
    "shaman",
    "chronomancer",
    "rogue",
    "assassin",
    "shadow-lord",
    "ranger",
    "hunt-lord",
)

MAX_CHARACTER_WIDTH = 600
MAX_CHARACTER_HEIGHT = 630
CONTACT_COLUMNS = 6
CONTACT_ROWS = 3
CONTACT_CELL_WIDTH = 192
CONTACT_CELL_HEIGHT = 208
CONTACT_THUMBNAIL_SIZE = 168


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_assignment(value: str) -> tuple[str, Path]:
    slug, separator, raw_path = value.partition("=")
    if not separator or not slug or not raw_path:
        raise argparse.ArgumentTypeError("expected SLUG=PATH")
    return slug, Path(raw_path).expanduser().resolve()


def load_manifest(path: Path) -> dict[str, object]:
    with path.open(encoding="utf-8") as source:
        manifest = json.load(source)
    entries = manifest.get("entries")
    art = manifest.get("art")
    if not isinstance(entries, dict) or not isinstance(art, dict):
        raise ValueError(f"{path}: character manifest requires entries and art objects")
    return manifest


def entry_maps(manifest: dict[str, object]) -> tuple[dict[str, dict[str, str]], dict[str, str]]:
    entries = manifest["entries"]
    assert isinstance(entries, dict)
    by_slug: dict[str, dict[str, str]] = {}
    job_by_slug: dict[str, str] = {}
    for job, raw_entry in entries.items():
        if not isinstance(job, str) or not isinstance(raw_entry, dict):
            raise ValueError("character manifest entries must map job names to objects")
        slug = raw_entry.get("slug")
        runtime_path = raw_entry.get("runtimePath")
        if not isinstance(slug, str) or not isinstance(runtime_path, str):
            raise ValueError(f"{job}: character manifest entry requires slug and runtimePath")
        if slug in by_slug:
            raise ValueError(f"duplicate character slug: {slug}")
        by_slug[slug] = {"job": job, "slug": slug, "runtimePath": runtime_path}
        job_by_slug[slug] = job
    return by_slug, job_by_slug


def has_transparent_pixels(image: Image.Image) -> bool:
    alpha = image.getchannel("A")
    extrema = alpha.getextrema()
    return extrema is not None and extrema[0] == 0


def choose_border_palette(image: Image.Image, tolerance: int) -> tuple[tuple[int, int, int], ...]:
    pixels = image.load()
    width, height = image.size
    border = [pixels[x, 0][:3] for x in range(width)]
    border.extend(pixels[x, height - 1][:3] for x in range(width))
    border.extend(pixels[0, y][:3] for y in range(1, height - 1))
    border.extend(pixels[width - 1, y][:3] for y in range(1, height - 1))
    counts = Counter(border)
    palette: list[tuple[int, int, int]] = []
    covered = 0
    required = max(1, math.ceil(len(border) * 0.995))
    for color, count in sorted(counts.items(), key=lambda item: (-item[1], item[0])):
        if not any(max(abs(channel - candidate) for channel, candidate in zip(color, existing)) <= tolerance for existing in palette):
            palette.append(color)
        covered += count
        if covered >= required or len(palette) >= 12:
            break
    if not palette:
        raise ValueError("working image has no border pixels")
    return tuple(palette)


def remove_edge_connected_background(image: Image.Image, tolerance: int) -> Image.Image:
    """Remove only pixels connected to the canvas edge and close to its palette."""

    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    palette = choose_border_palette(rgba, tolerance)
    match_cache: dict[tuple[int, int, int], bool] = {}

    def is_background(x: int, y: int) -> bool:
        color = pixels[x, y][:3]
        cached = match_cache.get(color)
        if cached is not None:
            return cached
        matches = any(
            max(abs(channel - candidate) for channel, candidate in zip(color, reference)) <= tolerance
            for reference in palette
        )
        match_cache[color] = matches
        return matches

    pending: deque[tuple[int, int]] = deque()
    visited = bytearray(width * height)

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if not visited[index] and is_background(x, y):
            visited[index] = 1
            pending.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(1, height - 1):
        enqueue(0, y)
        enqueue(width - 1, y)

    removed = 0
    while pending:
        x, y = pending.popleft()
        red, green, blue, _ = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        removed += 1
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    if removed == 0 or not has_transparent_pixels(rgba):
        raise ValueError("working-background cleanup did not produce transparent pixels")
    return rgba


def validate_master(image: Image.Image, path: Path) -> Image.Image:
    rgba = image.convert("RGBA")
    if rgba.width != rgba.height:
        raise ValueError(f"{path}: tracked source master must use a square canvas")
    if not has_transparent_pixels(rgba):
        raise ValueError(
            f"{path}: tracked source master must contain transparent pixels; "
            "use --import-source for deterministic working-background cleanup"
        )
    if rgba.getchannel("A").getbbox() is None:
        raise ValueError(f"{path}: tracked source master has no opaque character pixels")
    return rgba


def import_master(raw_path: Path, destination: Path, tolerance: int) -> None:
    if not raw_path.is_file():
        raise ValueError(f"working source does not exist: {raw_path}")
    with Image.open(raw_path) as source:
        source.load()
        imported = source.convert("RGBA")
    if not has_transparent_pixels(imported):
        imported = remove_edge_connected_background(imported, tolerance)
    imported = validate_master(imported, raw_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    imported.save(destination, format="PNG", optimize=False)


def normalize_character(
    source: Image.Image,
    *,
    width: int,
    height: int,
    foot_baseline: int,
) -> tuple[Image.Image, dict[str, int]]:
    alpha_bounds = source.getchannel("A").getbbox()
    if alpha_bounds is None:
        raise ValueError("source master has no opaque character pixels")
    cropped = source.crop(alpha_bounds)
    scale = min(MAX_CHARACTER_WIDTH / cropped.width, MAX_CHARACTER_HEIGHT / cropped.height)
    scaled_width = max(1, min(MAX_CHARACTER_WIDTH, math.floor(cropped.width * scale)))
    scaled_height = max(1, min(MAX_CHARACTER_HEIGHT, math.floor(cropped.height * scale)))
    resized = cropped.resize((scaled_width, scaled_height), Image.Resampling.LANCZOS)

    left = (width - scaled_width) // 2
    top = foot_baseline - scaled_height + 1
    if left < 0 or top < 0 or left + scaled_width > width or top + scaled_height > height:
        raise ValueError("normalized character does not fit the declared canvas and baseline")

    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(resized, (left, top))
    final_bounds = canvas.getchannel("A").getbbox()
    if final_bounds is None:
        raise ValueError("normalized character export is empty")
    return canvas, {
        "left": final_bounds[0],
        "top": final_bounds[1],
        "right": final_bounds[2] - 1,
        "bottom": final_bounds[3] - 1,
        "width": final_bounds[2] - final_bounds[0],
        "height": final_bounds[3] - final_bounds[1],
    }


def find_label_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        Path("/System/Library/Fonts/AppleSDGothicNeo.ttc"),
        Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    )
    for candidate in candidates:
        if candidate.is_file():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def build_contact_sheet(
    rows: Iterable[dict[str, object]],
    *,
    destination: Path,
    anonymous: bool,
) -> None:
    entries = list(rows)
    if len(entries) != CONTACT_COLUMNS * CONTACT_ROWS:
        raise ValueError("character contact sheet requires exactly 18 entries")
    canvas = Image.new(
        "RGBA",
        (CONTACT_COLUMNS * CONTACT_CELL_WIDTH, CONTACT_ROWS * CONTACT_CELL_HEIGHT),
        (13, 15, 23, 255),
    )
    draw = ImageDraw.Draw(canvas)
    font = find_label_font(19)
    for index, entry in enumerate(entries):
        column = index % CONTACT_COLUMNS
        row = index // CONTACT_COLUMNS
        x = column * CONTACT_CELL_WIDTH
        y = row * CONTACT_CELL_HEIGHT
        draw.rounded_rectangle(
            (x + 5, y + 5, x + CONTACT_CELL_WIDTH - 6, y + CONTACT_CELL_HEIGHT - 6),
            radius=12,
            fill=(24, 27, 39, 255),
            outline=(75, 79, 101, 255),
            width=1,
        )
        runtime_path = Path(str(entry["absoluteRuntimePath"]))
        with Image.open(runtime_path) as runtime_source:
            portrait = runtime_source.convert("RGBA").resize(
                (CONTACT_THUMBNAIL_SIZE, CONTACT_THUMBNAIL_SIZE),
                Image.Resampling.LANCZOS,
            )
        portrait_x = x + (CONTACT_CELL_WIDTH - CONTACT_THUMBNAIL_SIZE) // 2
        canvas.alpha_composite(portrait, (portrait_x, y + 4))
        label = f"{index + 1:02d}" if anonymous else str(entry["job"])
        label_bounds = draw.textbbox((0, 0), label, font=font)
        label_width = label_bounds[2] - label_bounds[0]
        draw.text(
            (x + (CONTACT_CELL_WIDTH - label_width) // 2, y + 178),
            label,
            font=font,
            fill=(230, 235, 245, 255),
        )
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, format="PNG", optimize=False)


def write_processing_provenance(
    path: Path,
    *,
    manifest: dict[str, object],
    rows: list[dict[str, object]],
) -> None:
    provenance: dict[str, object] = {}
    if path.is_file():
        with path.open(encoding="utf-8") as source:
            existing = json.load(source)
        if isinstance(existing, dict):
            provenance.update(existing)
    provenance.update({
        "version": 1,
        "catalogSha256": manifest.get("catalogSha256"),
        "styleVersion": manifest.get("styleVersion"),
        "processing": {
            "script": "scripts/process_character_art.py",
            "canvas": manifest["art"],
            "maxCharacterBounds": {
                "width": MAX_CHARACTER_WIDTH,
                "height": MAX_CHARACTER_HEIGHT,
            },
            "lineageOrder": list(LINEAGE_ORDER),
            "contactSheetGrid": "6x3",
        },
        "entries": [
            {
                key: value
                for key, value in entry.items()
                if key != "absoluteRuntimePath"
            }
            for entry in rows
        ],
    })
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{json.dumps(provenance, ensure_ascii=False, indent=2)}\n", encoding="utf-8")


def process_characters(args: argparse.Namespace) -> list[dict[str, object]]:
    manifest = load_manifest(args.manifest)
    by_slug, _ = entry_maps(manifest)
    manifest_slugs = set(by_slug)
    if manifest_slugs != set(LINEAGE_ORDER):
        missing = sorted(set(LINEAGE_ORDER) - manifest_slugs)
        extra = sorted(manifest_slugs - set(LINEAGE_ORDER))
        raise ValueError(f"manifest/lineage mismatch: missing={missing}, extra={extra}")

    selected = list(dict.fromkeys(args.only or LINEAGE_ORDER))
    unknown = sorted(set(selected) - manifest_slugs)
    if unknown:
        raise ValueError(f"unknown character slug(s): {', '.join(unknown)}")

    imports = dict(args.import_source or [])
    unknown_imports = sorted(set(imports) - manifest_slugs)
    if unknown_imports:
        raise ValueError(f"unknown import slug(s): {', '.join(unknown_imports)}")
    for slug, raw_path in imports.items():
        import_master(raw_path, args.source_dir / f"{slug}.png", args.cleanup_tolerance)

    art = manifest["art"]
    assert isinstance(art, dict)
    width = int(art["width"])
    height = int(art["height"])
    margin = int(art["margin"])
    foot_baseline = int(art["footBaseline"])

    rows: list[dict[str, object]] = []
    for slug in selected:
        entry = by_slug[slug]
        source_path = args.source_dir / f"{slug}.png"
        if not source_path.is_file():
            raise ValueError(f"missing tracked source master: {source_path}")
        with Image.open(source_path) as source_file:
            source_file.load()
            source = validate_master(source_file, source_path)
        runtime, opaque_bounds = normalize_character(
            source,
            width=width,
            height=height,
            foot_baseline=foot_baseline,
        )
        if (
            opaque_bounds["left"] < margin
            or opaque_bounds["top"] < margin
            or opaque_bounds["right"] > width - margin - 1
            or opaque_bounds["bottom"] > height - margin - 1
        ):
            raise ValueError(f"{slug}: normalized export exceeds declared margin {margin}")
        if opaque_bounds["bottom"] != foot_baseline:
            raise ValueError(f"{slug}: normalized export missed foot baseline {foot_baseline}")

        runtime_path = args.runtime_dir / f"{slug}.png"
        runtime_path.parent.mkdir(parents=True, exist_ok=True)
        runtime.save(runtime_path, format="PNG", optimize=False)
        rows.append({
            "job": entry["job"],
            "slug": slug,
            "sourcePath": f"scripts/art_sources/characters/{slug}.png",
            "runtimePath": entry["runtimePath"],
            "sourceSha256": sha256_file(source_path),
            "exportSha256": sha256_file(runtime_path),
            "opaqueBounds": opaque_bounds,
            "absoluteRuntimePath": str(runtime_path),
        })

    if not args.only:
        export_hashes = [str(row["exportSha256"]) for row in rows]
        if len(set(export_hashes)) != len(export_hashes):
            raise ValueError("canonical character exports must have unique SHA-256 values")
        build_contact_sheet(
            rows,
            destination=args.evidence_dir / "character-contact-sheet.png",
            anonymous=False,
        )
        build_contact_sheet(
            rows,
            destination=args.evidence_dir / "character-contact-sheet-anonymous.png",
            anonymous=True,
        )
        write_processing_provenance(
            args.evidence_dir / "character-provenance.json",
            manifest=manifest,
            rows=rows,
        )
    return rows


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--runtime-dir", type=Path, default=DEFAULT_RUNTIME_DIR)
    parser.add_argument("--evidence-dir", type=Path, default=DEFAULT_EVIDENCE_DIR)
    parser.add_argument("--only", action="append", metavar="SLUG")
    parser.add_argument(
        "--import-source",
        action="append",
        type=parse_assignment,
        metavar="SLUG=PATH",
        help="Import one working PNG; opaque edge-connected backgrounds are removed before tracking.",
    )
    parser.add_argument("--cleanup-tolerance", type=int, default=32)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if not 0 <= args.cleanup_tolerance <= 64:
        parser.error("--cleanup-tolerance must be between 0 and 64")
    try:
        rows = process_characters(args)
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        print(f"character art processing failed: {error}", file=sys.stderr)
        return 1
    public_rows = [
        {key: value for key, value in row.items() if key != "absoluteRuntimePath"}
        for row in rows
    ]
    print(json.dumps({"ok": True, "entries": public_rows}, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
