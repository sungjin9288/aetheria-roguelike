#!/usr/bin/env python3
"""Validate and normalize one declared six-icon equipment source sheet."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

from PIL import Image


CANVAS = 160
MARGIN = 8
CELL_ORDER = (
    "top-left",
    "top-center",
    "top-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_file(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if not resolved.is_file():
        raise FileNotFoundError(f"Missing input path: {resolved}")
    return resolved


def read_json(path: Path) -> dict:
    source_path = require_file(path)
    value = json.loads(source_path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object: {source_path}")
    return value


def validate_batch(batch: dict) -> list[dict]:
    batch_id = batch.get("batchId")
    identities = batch.get("identities")
    identity_names = batch.get("identityNames")
    grid = batch.get("grid")
    if not isinstance(batch_id, str) or not batch_id:
        raise ValueError("Batch manifest requires batchId")
    if grid != {"columns": 3, "rows": 2, "cellOrder": list(CELL_ORDER)}:
        raise ValueError(f"Batch manifest has an invalid fixed 2x3 grid: {batch_id}")
    if not isinstance(identities, list) or len(identities) != len(CELL_ORDER):
        raise ValueError(f"Batch manifest requires exactly six identities: {batch_id}")
    if not isinstance(identity_names, list) or len(identity_names) != len(CELL_ORDER):
        raise ValueError(f"Batch manifest requires six declared identity names: {batch_id}")

    names: list[str] = []
    runtime_paths: set[str] = set()
    for index, identity in enumerate(identities):
        if not isinstance(identity, dict):
            raise ValueError(f"Batch identity must be an object: {batch_id}")
        name = identity.get("name")
        cell = identity.get("cell")
        runtime_path = identity.get("runtimePath")
        if not isinstance(name, str) or not name or cell != CELL_ORDER[index]:
            raise ValueError(f"Batch identity order is invalid: {batch_id}")
        if not isinstance(runtime_path, str) or not runtime_path.startswith("/assets/equipment-exact/"):
            raise ValueError(f"Batch runtime path is invalid: {name}")
        if ".." in Path(runtime_path).parts:
            raise ValueError(f"Batch runtime path is invalid: {name}")
        names.append(name)
        runtime_paths.add(runtime_path)

    if names != identity_names or len(set(names)) != len(names) or len(runtime_paths) != len(names):
        raise ValueError(f"Batch manifest identities are not unique and ordered: {batch_id}")
    return identities


def validate_declaration(batch: dict, declaration: dict) -> None:
    batch_id = batch["batchId"]
    if declaration.get("batchId") != batch_id or declaration.get("identityNames") != batch["identityNames"]:
        raise ValueError(f"Declared identities do not match batch manifest: {batch_id}")


def validate_manifest_identities(manifest: dict, identities: list[dict]) -> None:
    entries = manifest.get("entries")
    if not isinstance(entries, dict):
        raise ValueError("Equipment manifest requires entries")
    for identity in identities:
        if identity["name"] not in entries:
            raise ValueError(f"Equipment manifest is missing batch identity: {identity['name']}")


def resolve_runtime_path(public_root: Path, runtime_path: str) -> Path:
    destination = (public_root / runtime_path.lstrip("/")).resolve()
    root = public_root.resolve()
    if root not in destination.parents:
        raise ValueError(f"Runtime path escapes public root: {runtime_path}")
    return destination


def normalize_cell(cell: Image.Image) -> Image.Image:
    source = cell.convert("RGBA")
    bounds = source.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("Source sheet cell has no opaque icon pixels")
    cropped = source.crop(bounds)
    max_dimension = CANVAS - MARGIN * 2
    scale = min(max_dimension / cropped.width, max_dimension / cropped.height)
    width = max(1, min(max_dimension, math.floor(cropped.width * scale)))
    height = max(1, min(max_dimension, math.floor(cropped.height * scale)))
    icon = cropped.resize((width, height), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(icon, ((CANVAS - width) // 2, (CANVAS - height) // 2))
    return canvas


def build_outputs(source_sheet: Path, identities: list[dict], public_root: Path) -> list[tuple[dict, Path, Image.Image]]:
    with Image.open(source_sheet) as image:
        source = image.convert("RGBA")
    if source.width % 3 != 0 or source.height % 2 != 0:
        raise ValueError("Source sheet dimensions must divide into a fixed 3x2 grid")

    cell_width = source.width // 3
    cell_height = source.height // 2
    outputs: list[tuple[dict, Path, Image.Image]] = []
    for index, identity in enumerate(identities):
        column = index % 3
        row = index // 3
        cell = source.crop((column * cell_width, row * cell_height, (column + 1) * cell_width, (row + 1) * cell_height))
        outputs.append((identity, resolve_runtime_path(public_root, identity["runtimePath"]), normalize_cell(cell)))
    return outputs


def append_provenance(path: Path, record: dict) -> None:
    provenance = {"version": 1, "batches": []}
    if path.is_file():
        existing = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(existing, dict) or existing.get("version") != 1 or not isinstance(existing.get("batches"), list):
            raise ValueError(f"Invalid provenance ledger: {path}")
        provenance = existing
    provenance["batches"].append(record)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(provenance, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Process one declared six-icon equipment art source sheet.")
    parser.add_argument("--batch", required=True, type=Path)
    parser.add_argument("--source-sheet", required=True, type=Path)
    parser.add_argument("--source-declaration", required=True, type=Path)
    parser.add_argument("--public-root", required=True, type=Path)
    parser.add_argument("--equipment-manifest", required=True, type=Path)
    parser.add_argument("--provenance", required=True, type=Path)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    batch = read_json(args.batch)
    identities = validate_batch(batch)
    declaration = read_json(args.source_declaration)
    validate_declaration(batch, declaration)

    manifest = read_json(args.equipment_manifest)
    validate_manifest_identities(manifest, identities)
    source_sheet = require_file(args.source_sheet)
    public_root = args.public_root.expanduser().resolve()
    outputs = build_outputs(source_sheet, identities, public_root)

    if args.dry_run:
        print(f"dry run: validated {len(outputs)} equipment identities for {batch['batchId']}")
        return

    exports: list[dict] = []
    for identity, destination, image in outputs:
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, format="PNG", optimize=False)
        exports.append({
            "cell": identity["cell"],
            "name": identity["name"],
            "runtimePath": identity["runtimePath"],
            "exportSha256": sha256_file(destination),
        })
    append_provenance(args.provenance.expanduser().resolve(), {
        "batchId": batch["batchId"],
        "cohort": batch.get("cohort"),
        "identityNames": batch["identityNames"],
        "sourceSheet": source_sheet.name,
        "sourceSheetSha256": sha256_file(source_sheet),
        "exports": exports,
    })
    print(f"processed {len(exports)} equipment icons for {batch['batchId']}")


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError, OSError, json.JSONDecodeError) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from error
