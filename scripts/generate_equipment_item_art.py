"""Generate reproducible per-item equipment art from an explicit catalog."""

from __future__ import annotations

import argparse
import colorsys
import hashlib
import io
import json
import os
import sys
import tempfile
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
    destination = manifest_path.expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(build_manifest_bytes(entries, contract_source))


def build_manifest_bytes(entries: dict[str, str], contract_source: Path) -> bytes:
    source = load_contract_metadata(contract_source)
    manifest = {
        **{key: value for key, value in source.items() if key != "entries"},
        "entries": dict(sorted(entries.items())),
    }
    return (json.dumps(manifest, ensure_ascii=False, indent=1) + "\n").encode("utf-8")


def load_catalog(path: Path, source_dir: Path) -> list[dict]:
    catalog_path = require_file(path)
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    if not isinstance(catalog, list):
        raise ValueError(f"Catalog must be a JSON array: {catalog_path}")

    rows: list[dict] = []
    names: set[str] = set()
    for entry in catalog:
        if not isinstance(entry, dict):
            raise ValueError(f"Catalog entry must be an object: {catalog_path}")
        name = entry.get("name")
        family_key = entry.get("familyKey")
        if not isinstance(name, str) or not name:
            raise ValueError(f"Catalog entry is missing a name: {catalog_path}")
        if name in names:
            raise ValueError(f"Catalog contains a duplicate name: {name}")
        names.add(name)
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


def encode_png(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False)
    return output.getvalue()


def stage_bytes(destination: Path, payload: bytes) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, stage_name = tempfile.mkstemp(
        prefix=f".{destination.name}.",
        suffix=".stage",
        dir=destination.parent,
    )
    stage_path = Path(stage_name)
    try:
        with os.fdopen(descriptor, "wb") as stage:
            stage.write(payload)
            stage.flush()
            os.fsync(stage.fileno())
        if stage_path.read_bytes() != payload:
            raise OSError(f"Staged artifact verification failed: {destination}")
        return stage_path
    except BaseException:
        stage_path.unlink(missing_ok=True)
        raise


def restore_destination(destination: Path, original: bytes | None) -> None:
    if original is None:
        destination.unlink(missing_ok=True)
        return
    with destination.open("wb") as target:
        target.write(original)
        target.flush()
        os.fsync(target.fileno())


def publish_staged_generation(
    staged_outputs: list[tuple[Path, Path]],
    staged_manifest: Path,
    manifest_path: Path,
) -> None:
    publications = [*staged_outputs, (staged_manifest, manifest_path)]
    destinations = [destination for _stage, destination in publications]
    if len(set(destinations)) != len(destinations):
        raise ValueError("Legacy generator publication destinations must be unique")
    originals = {
        destination: destination.read_bytes() if destination.is_file() else None
        for destination in destinations
    }
    published: list[Path] = []
    try:
        for stage_path, destination in publications:
            os.replace(stage_path, destination)
            published.append(destination)
    except OSError as publish_error:
        rollback_errors: list[OSError] = []
        for destination in reversed(published):
            try:
                restore_destination(destination, originals[destination])
            except OSError as rollback_error:
                rollback_errors.append(rollback_error)
        if rollback_errors:
            raise OSError(
                f"Legacy generator publication failed and rollback was incomplete: {publish_error}"
            ) from rollback_errors[0]
        raise
    finally:
        for stage_path, _destination in publications:
            stage_path.unlink(missing_ok=True)


def stage_and_publish_generation(
    outputs: list[tuple[Path, bytes]],
    manifest_path: Path,
    manifest_payload: bytes,
) -> None:
    staged_outputs: list[tuple[Path, Path]] = []
    staged_manifest: Path | None = None
    try:
        for destination, payload in outputs:
            stage_path = stage_bytes(destination, payload)
            staged_outputs.append((stage_path, destination))
            if hashlib.sha256(stage_path.read_bytes()).digest() != hashlib.sha256(payload).digest():
                raise OSError(f"Staged export hash verification failed: {destination}")
            with Image.open(stage_path) as staged_image:
                if staged_image.mode != "RGBA" or staged_image.size != (CANVAS, CANVAS):
                    raise OSError(f"Staged export PNG verification failed: {destination}")
        staged_manifest = stage_bytes(manifest_path, manifest_payload)
        if json.loads(staged_manifest.read_text(encoding="utf-8")) != json.loads(
            manifest_payload.decode("utf-8")
        ):
            raise OSError(f"Staged manifest verification failed: {manifest_path}")
        publish_staged_generation(staged_outputs, staged_manifest, manifest_path)
    finally:
        for stage_path, _destination in staged_outputs:
            stage_path.unlink(missing_ok=True)
        if staged_manifest is not None:
            staged_manifest.unlink(missing_ok=True)


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
    palettes = load_palettes()
    entries: dict[str, str] = {}
    outputs: list[tuple[Path, bytes]] = []
    for entry in catalog:
        slug = art_slug(entry["name"])
        image = build_item(entry, palettes, source_dir)
        outputs.append((output_dir / f"{slug}.png", encode_png(image)))
        entries[entry["name"]] = f"auto/{slug}"

    manifest_payload = build_manifest_bytes(entries, contract_source)
    stage_and_publish_generation(outputs, manifest_path, manifest_payload)
    print(f"{len(entries)} item arts generated → {output_dir}")
    print(f"manifest → {manifest_path}")


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError, OSError, json.JSONDecodeError) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from error
