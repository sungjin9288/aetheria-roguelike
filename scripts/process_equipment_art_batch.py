#!/usr/bin/env python3
"""Validate and atomically publish one declared six-icon equipment source sheet."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import os
import re
import sys
import tempfile
from pathlib import Path, PurePosixPath

from PIL import Image


CANVAS = 160
MARGIN = 8
SOURCE_SIZE = (600, 400)
CELL_SIZE = (200, 200)
MIN_ICON_DIMENSION = 2
CELL_ORDER = (
    "top-left",
    "top-center",
    "top-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
)
CATALOG_ROW_FIELDS = (
    "name",
    "type",
    "tier",
    "elem",
    "familyKey",
    "runtimePath",
    "cohort",
)
SUPPORTED_COHORTS = {
    "armor",
    "offhand-headgear",
    "signature-mythic",
    "weapon-core",
    "weapon-ranged-magic",
}
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_json_bytes(value: object, *, sort_keys: bool = False) -> bytes:
    return (
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
            separators=(",", ": "),
            sort_keys=sort_keys,
        )
        + "\n"
    ).encode("utf-8")


def compact_json_bytes(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


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


def read_catalog(path: Path) -> list[dict]:
    source_path = require_file(path)
    value = json.loads(source_path.read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise ValueError(f"Catalog must be a JSON array: {source_path}")
    return value


def validate_runtime_path(runtime_path: object, name: str) -> str:
    if not isinstance(runtime_path, str) or not runtime_path.startswith("/assets/equipment-exact/"):
        raise ValueError(f"Batch runtime path is invalid: {name}")
    if ".." in PurePosixPath(runtime_path).parts or not runtime_path.endswith(".png"):
        raise ValueError(f"Batch runtime path is invalid: {name}")
    return runtime_path


def validate_manifest(manifest: dict) -> tuple[dict, str, str, str]:
    entries = manifest.get("entries")
    art = manifest.get("art")
    pipeline = manifest.get("pipeline")
    catalog_sha256 = manifest.get("catalogSha256")
    if not isinstance(entries, dict):
        raise ValueError("Equipment manifest requires entries")
    if not isinstance(art, dict) or not isinstance(art.get("assetRoot"), str):
        raise ValueError("Equipment manifest requires art.assetRoot")
    if not SHA256_PATTERN.fullmatch(catalog_sha256 or ""):
        raise ValueError("Equipment manifest requires catalogSha256")
    catalog_contract = pipeline.get("catalog") if isinstance(pipeline, dict) else None
    rows_sha256 = catalog_contract.get("rowsSha256") if isinstance(catalog_contract, dict) else None
    if not SHA256_PATTERN.fullmatch(rows_sha256 or ""):
        raise ValueError("Equipment manifest requires pipeline.catalog.rowsSha256")
    if catalog_contract.get("rowFields") != list(CATALOG_ROW_FIELDS):
        raise ValueError("Equipment manifest catalog rowFields do not match the processor contract")
    return entries, art["assetRoot"], catalog_sha256, rows_sha256


def validate_catalog(catalog: list[dict], expected_rows_sha256: str) -> tuple[dict[str, dict], str]:
    rows: list[dict] = []
    names: set[str] = set()
    runtime_paths: set[str] = set()
    previous_name: str | None = None
    for entry in catalog:
        if not isinstance(entry, dict) or set(entry) != set(CATALOG_ROW_FIELDS):
            raise ValueError("Catalog rows must contain exactly the authoritative seven fields")
        row = {field: entry[field] for field in CATALOG_ROW_FIELDS}
        name = row["name"]
        if not isinstance(name, str) or not name:
            raise ValueError("Catalog row requires a non-empty name")
        if previous_name is not None and previous_name >= name:
            raise ValueError("Catalog rows must use strict Unicode code-point order")
        previous_name = name
        if name in names:
            raise ValueError(f"Catalog contains a duplicate identity: {name}")
        names.add(name)
        if not isinstance(row["type"], str) or not row["type"]:
            raise ValueError(f"Catalog type is invalid: {name}")
        if isinstance(row["tier"], bool) or not isinstance(row["tier"], int) or row["tier"] < 0:
            raise ValueError(f"Catalog tier is invalid: {name}")
        if not isinstance(row["elem"], str) or not isinstance(row["familyKey"], str) or not row["familyKey"]:
            raise ValueError(f"Catalog family or element is invalid: {name}")
        if row["cohort"] not in SUPPORTED_COHORTS:
            raise ValueError(f"Catalog cohort is unsupported: {name}")
        runtime_path = validate_runtime_path(row["runtimePath"], name)
        if runtime_path in runtime_paths:
            raise ValueError(f"Catalog contains a duplicate runtime path: {runtime_path}")
        runtime_paths.add(runtime_path)
        rows.append(row)

    rows_sha256 = sha256_bytes(compact_json_bytes(rows))
    if rows_sha256 != expected_rows_sha256:
        raise ValueError(
            "Catalog rows do not match authoritative catalogSha256 "
            f"({rows_sha256} != {expected_rows_sha256})"
        )
    return {row["name"]: row for row in rows}, rows_sha256


def validate_batch(
    batch: dict,
    catalog_by_name: dict[str, dict],
    catalog_rows_sha256: str,
    entries: dict,
    asset_root: str,
    catalog_sha256: str,
) -> list[dict]:
    batch_id = batch.get("batchId")
    identities = batch.get("identities")
    identity_names = batch.get("identityNames")
    grid = batch.get("grid")
    cohort = batch.get("cohort")
    if not isinstance(batch_id, str) or not batch_id:
        raise ValueError("Batch manifest requires batchId")
    if batch.get("catalogSha256") != catalog_sha256:
        raise ValueError(f"Batch catalogSha256 does not match the equipment manifest: {batch_id}")
    if batch.get("catalogRowsSha256") != catalog_rows_sha256:
        raise ValueError(f"Batch catalogSha256 does not match the authoritative catalog rows: {batch_id}")
    if cohort not in SUPPORTED_COHORTS:
        raise ValueError(f"Batch cohort is unsupported: {batch_id}")
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
        if not isinstance(name, str) or not name or identity.get("cell") != CELL_ORDER[index]:
            raise ValueError(f"Batch identity order is invalid: {batch_id}")
        runtime_path = validate_runtime_path(identity.get("runtimePath"), name)
        authoritative = catalog_by_name.get(name)
        if authoritative is None:
            raise ValueError(f"Batch identity is missing from the authoritative catalog: {name}")
        projected = {field: identity.get(field) for field in CATALOG_ROW_FIELDS}
        if projected != authoritative:
            raise ValueError(f"Batch identity does not match the authoritative catalog row: {name}")
        if identity.get("cohort") != cohort:
            raise ValueError(f"Batch identity cohort does not match batch cohort: {name}")
        manifest_entry = entries.get(name)
        if not isinstance(manifest_entry, str) or not manifest_entry or ".." in PurePosixPath(manifest_entry).parts:
            raise ValueError(f"Equipment manifest is missing batch identity: {name}")
        expected_runtime_path = f"{asset_root.rstrip('/')}/{manifest_entry}.png"
        if runtime_path != expected_runtime_path:
            raise ValueError(f"Batch runtime path does not match the equipment manifest: {name}")
        if not isinstance(identity.get("prompt"), str) or not identity["prompt"]:
            raise ValueError(f"Batch identity prompt is missing: {name}")
        names.append(name)
        runtime_paths.add(runtime_path)

    if names != identity_names or len(set(names)) != len(names) or len(runtime_paths) != len(names):
        raise ValueError(f"Batch manifest identities are not unique and ordered: {batch_id}")
    return identities


def validate_declaration(batch: dict, declaration: dict) -> None:
    batch_id = batch["batchId"]
    if declaration.get("batchId") != batch_id or declaration.get("identityNames") != batch["identityNames"]:
        raise ValueError(f"Declared identities do not match batch manifest: {batch_id}")


def resolve_runtime_path(public_root: Path, runtime_path: str) -> Path:
    destination = (public_root / runtime_path.lstrip("/")).resolve()
    root = public_root.resolve()
    if root not in destination.parents:
        raise ValueError(f"Runtime path escapes public root: {runtime_path}")
    return destination


def validate_cell(cell: Image.Image, cell_name: str) -> tuple[int, int, int, int]:
    alpha = cell.getchannel("A")
    minimum, maximum = alpha.getextrema()
    if maximum == 0:
        raise ValueError(f"Source sheet cell is empty and has no opaque icon pixels: {cell_name}")
    if minimum != 0 or maximum != 255:
        raise ValueError(f"Source sheet cell must contain transparent and opaque pixels: {cell_name}")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError(f"Source sheet cell is empty: {cell_name}")
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    if width < MIN_ICON_DIMENSION or height < MIN_ICON_DIMENSION:
        raise ValueError(f"Source sheet cell has degenerate icon bounds: {cell_name}")
    if bounds[0] == 0 or bounds[1] == 0 or bounds[2] == CELL_SIZE[0] or bounds[3] == CELL_SIZE[1]:
        raise ValueError(f"Source sheet cell bounds require transparent padding: {cell_name}")
    return bounds


def normalize_cell(cell: Image.Image, cell_name: str) -> Image.Image:
    bounds = validate_cell(cell, cell_name)
    cropped = cell.crop(bounds)
    max_dimension = CANVAS - MARGIN * 2
    scale = min(max_dimension / cropped.width, max_dimension / cropped.height)
    width = max(1, min(max_dimension, math.floor(cropped.width * scale)))
    height = max(1, min(max_dimension, math.floor(cropped.height * scale)))
    icon = cropped.resize((width, height), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(icon, ((CANVAS - width) // 2, (CANVAS - height) // 2))
    return canvas


def encode_png(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False)
    return output.getvalue()


def build_outputs(
    source_sheet: Path,
    identities: list[dict],
    public_root: Path,
) -> list[tuple[dict, Path, bytes, str]]:
    with Image.open(source_sheet) as image:
        image.load()
        if image.mode != "RGBA":
            raise ValueError("Source sheet must use true RGBA alpha")
        if image.size != SOURCE_SIZE:
            raise ValueError("Source sheet dimensions must be exactly 600x400 for the fixed 3x2 grid")
        source = image.copy()

    outputs: list[tuple[dict, Path, bytes, str]] = []
    for index, identity in enumerate(identities):
        column = index % 3
        row = index // 3
        left = column * CELL_SIZE[0]
        top = row * CELL_SIZE[1]
        cell = source.crop((left, top, left + CELL_SIZE[0], top + CELL_SIZE[1]))
        payload = encode_png(normalize_cell(cell, identity["cell"]))
        outputs.append((
            identity,
            resolve_runtime_path(public_root, identity["runtimePath"]),
            payload,
            sha256_bytes(payload),
        ))
    return outputs


def replay_key(batch_id: str, source_sheet_sha256: str, identity_names: list[str]) -> str:
    return sha256_bytes(compact_json_bytes({
        "batchId": batch_id,
        "sourceSheetSha256": source_sheet_sha256,
        "identityNames": identity_names,
    }))


def read_provenance(path: Path) -> dict:
    if not path.is_file():
        return {"version": 1, "batches": []}
    try:
        provenance = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(provenance, dict) or provenance.get("version") != 1:
            raise ValueError
        batches = provenance.get("batches")
        if not isinstance(batches, list):
            raise ValueError
        batch_ids: set[str] = set()
        for record in batches:
            if not isinstance(record, dict):
                raise ValueError
            batch_id = record.get("batchId")
            identity_names = record.get("identityNames")
            exports = record.get("exports")
            if not isinstance(batch_id, str) or not batch_id or batch_id in batch_ids:
                raise ValueError
            batch_ids.add(batch_id)
            if (
                not isinstance(identity_names, list)
                or len(identity_names) != len(CELL_ORDER)
                or len(set(identity_names)) != len(CELL_ORDER)
            ):
                raise ValueError
            if not SHA256_PATTERN.fullmatch(record.get("sourceSheetSha256") or ""):
                raise ValueError
            if not SHA256_PATTERN.fullmatch(record.get("replayKey") or ""):
                raise ValueError
            if not isinstance(exports, list) or len(exports) != len(CELL_ORDER):
                raise ValueError
            if any(
                not isinstance(export, dict)
                or not SHA256_PATTERN.fullmatch(export.get("exportSha256") or "")
                for export in exports
            ):
                raise ValueError
        return provenance
    except (json.JSONDecodeError, OSError, TypeError, ValueError) as error:
        raise ValueError(f"Invalid provenance ledger: {path}") from error


def build_provenance_record(
    batch: dict,
    source_sheet: Path,
    source_sheet_sha256: str,
    outputs: list[tuple[dict, Path, bytes, str]],
) -> dict:
    return {
        "batchId": batch["batchId"],
        "catalogSha256": batch["catalogSha256"],
        "catalogRowsSha256": batch["catalogRowsSha256"],
        "cohort": batch["cohort"],
        "identityNames": batch["identityNames"],
        "sourceSheet": source_sheet.name,
        "sourceSheetSha256": source_sheet_sha256,
        "replayKey": replay_key(batch["batchId"], source_sheet_sha256, batch["identityNames"]),
        "exports": [
            {
                "cell": identity["cell"],
                "name": identity["name"],
                "runtimePath": identity["runtimePath"],
                "exportSha256": export_sha256,
            }
            for identity, _destination, _payload, export_sha256 in outputs
        ],
    }


def prepare_next_provenance(
    provenance: dict,
    record: dict,
    outputs: list[tuple[dict, Path, bytes, str]],
) -> tuple[bool, bytes | None]:
    existing = next(
        (entry for entry in provenance["batches"] if entry["batchId"] == record["batchId"]),
        None,
    )
    if existing is not None:
        existing_projection = {key: value for key, value in existing.items() if key != "sourceSheet"}
        record_projection = {key: value for key, value in record.items() if key != "sourceSheet"}
        if existing.get("replayKey") != record["replayKey"] or existing_projection != record_projection:
            raise ValueError(f"Conflicting batchId in provenance ledger: {record['batchId']}")
        for _identity, destination, _payload, export_sha256 in outputs:
            if not destination.is_file() or sha256_file(destination) != export_sha256:
                raise ValueError(f"Exact replay output does not match provenance: {destination}")
        return True, None

    next_provenance = dict(provenance)
    next_provenance["batches"] = [*provenance["batches"], record]
    return False, canonical_json_bytes(next_provenance, sort_keys=True)


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


def publish_staged_batch(
    staged_outputs: list[tuple[Path, Path]],
    staged_provenance: Path,
    provenance_path: Path,
) -> None:
    publications = [*staged_outputs, (staged_provenance, provenance_path)]
    destinations = [destination for _stage, destination in publications]
    if len(set(destinations)) != len(destinations):
        raise ValueError("Batch publication destinations must be unique")
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
                f"Batch publication failed and rollback was incomplete: {publish_error}"
            ) from rollback_errors[0]
        raise
    finally:
        for stage_path, _destination in publications:
            stage_path.unlink(missing_ok=True)


def stage_and_publish_batch(
    outputs: list[tuple[dict, Path, bytes, str]],
    provenance_payload: bytes,
    provenance_path: Path,
) -> None:
    staged_outputs: list[tuple[Path, Path]] = []
    staged_provenance: Path | None = None
    try:
        for _identity, destination, payload, export_sha256 in outputs:
            stage_path = stage_bytes(destination, payload)
            staged_outputs.append((stage_path, destination))
            if sha256_file(stage_path) != export_sha256:
                raise OSError(f"Staged export hash verification failed: {destination}")
            with Image.open(stage_path) as staged_image:
                if staged_image.mode != "RGBA" or staged_image.size != (CANVAS, CANVAS):
                    raise OSError(f"Staged export PNG verification failed: {destination}")
        staged_provenance = stage_bytes(provenance_path, provenance_payload)
        if json.loads(staged_provenance.read_text(encoding="utf-8")) != json.loads(
            provenance_payload.decode("utf-8")
        ):
            raise OSError(f"Staged provenance verification failed: {provenance_path}")
        publish_staged_batch(staged_outputs, staged_provenance, provenance_path)
    finally:
        for stage_path, _destination in staged_outputs:
            stage_path.unlink(missing_ok=True)
        if staged_provenance is not None:
            staged_provenance.unlink(missing_ok=True)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Process one declared six-icon equipment art source sheet.")
    parser.add_argument("--batch", required=True, type=Path)
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--source-sheet", required=True, type=Path)
    parser.add_argument("--source-declaration", required=True, type=Path)
    parser.add_argument("--public-root", required=True, type=Path)
    parser.add_argument("--equipment-manifest", required=True, type=Path)
    parser.add_argument("--provenance", required=True, type=Path)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    manifest = read_json(args.equipment_manifest)
    entries, asset_root, catalog_sha256, expected_rows_sha256 = validate_manifest(manifest)
    catalog_by_name, catalog_rows_sha256 = validate_catalog(
        read_catalog(args.catalog),
        expected_rows_sha256,
    )
    batch = read_json(args.batch)
    identities = validate_batch(
        batch,
        catalog_by_name,
        catalog_rows_sha256,
        entries,
        asset_root,
        catalog_sha256,
    )
    validate_declaration(batch, read_json(args.source_declaration))

    source_sheet = require_file(args.source_sheet)
    public_root = args.public_root.expanduser().resolve()
    outputs = build_outputs(source_sheet, identities, public_root)
    source_sheet_sha256 = sha256_file(source_sheet)
    record = build_provenance_record(batch, source_sheet, source_sheet_sha256, outputs)
    provenance_path = args.provenance.expanduser().resolve()
    provenance = read_provenance(provenance_path)
    exact_replay, provenance_payload = prepare_next_provenance(provenance, record, outputs)

    if exact_replay:
        print(f"replay no-op: {len(outputs)} equipment icons already match {batch['batchId']}")
        return
    if args.dry_run:
        print(f"dry run: validated {len(outputs)} equipment identities for {batch['batchId']}")
        return

    if provenance_payload is None:
        raise ValueError(f"Missing next provenance payload: {batch['batchId']}")
    stage_and_publish_batch(outputs, provenance_payload, provenance_path)
    print(f"processed {len(outputs)} equipment icons for {batch['batchId']}")


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError, OSError, json.JSONDecodeError) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from error
