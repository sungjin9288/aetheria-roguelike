#!/usr/bin/env python3
"""Validate and atomically publish paired signature item and wearable source sheets."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from pathlib import Path, PurePosixPath

from PIL import Image

from process_equipment_art_batch import (
    CELL_ORDER,
    CELL_SIZE,
    SOURCE_SIZE,
    canonical_json_bytes,
    compact_json_bytes,
    encode_png,
    is_safe_png_basename,
    publish_staged_batch,
    read_catalog,
    read_json,
    require_file,
    sha256_bytes,
    sha256_file,
    stage_bytes,
    validate_catalog,
    validate_cell,
    validate_declaration,
)


ITEM_CANVAS = 160
ITEM_MARGIN = 8
OVERLAY_CANVAS = 72
OVERLAY_MARGIN = 4
COHORT = "signature-mythic"
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
CATALOG_FIELDS = (
    "name",
    "type",
    "tier",
    "elem",
    "familyKey",
    "runtimePath",
    "cohort",
)
REGISTRY_FIELDS = ("spriteKey", "tier", "category", "tone", "setGroup", "artNote")
BATCH_REGISTRY_FIELDS = {
    "spriteKey": "spriteKey",
    "signatureTier": "tier",
    "category": "category",
    "tone": "tone",
    "setGroup": "setGroup",
    "artNote": "artNote",
}
RECORD_FIELDS = frozenset({
    "batchId",
    "catalogSha256",
    "catalogRowsSha256",
    "cohort",
    "identityNames",
    "itemSourceSheet",
    "itemSourceSheetSha256",
    "overlaySourceSheet",
    "overlaySourceSheetSha256",
    "replayKey",
    "itemExports",
    "overlayExports",
})
EXPORT_FIELDS = frozenset({"cell", "name", "runtimePath", "exportSha256"})
BASE_PROVENANCE_FIELDS = frozenset({"version", "batches"})
FINAL_PROVENANCE_FIELDS = BASE_PROVENANCE_FIELDS | {
    "catalogSha256",
    "catalogRowsSha256",
    "cohort",
    "registrySha256",
    "generationReview",
}
GENERATION_REVIEW_FIELDS = frozenset({"tool", "accepted", "rejected"})
ACCEPTED_REVIEW_FIELDS = frozenset({"batchId", "surface", "rawImage", "rawSha256"})
REJECTED_REVIEW_FIELDS = ACCEPTED_REVIEW_FIELDS | {"reason"}


def validate_runtime_path(value: object, root: str, name: str) -> str:
    if (
        not isinstance(value, str)
        or not value.startswith(root)
        or not value.endswith(".png")
        or ".." in PurePosixPath(value).parts
    ):
        raise ValueError(f"Signature runtime path is invalid: {name}")
    return value


def resolve_runtime_path(public_root: Path, runtime_path: str) -> Path:
    destination = (public_root / runtime_path.lstrip("/")).resolve()
    root = public_root.resolve()
    if root not in destination.parents:
        raise ValueError(f"Signature runtime path escapes public root: {runtime_path}")
    return destination


def validate_manifest(manifest: dict) -> tuple[dict, str, str]:
    entries = manifest.get("entries")
    art = manifest.get("art")
    pipeline = manifest.get("pipeline")
    catalog_sha256 = manifest.get("catalogSha256")
    if not isinstance(entries, dict) or not isinstance(art, dict):
        raise ValueError("Signature processor requires equipment manifest entries and art metadata")
    if art.get("assetRoot") != "/assets/equipment-exact/":
        raise ValueError("Signature item asset root is invalid")
    if art.get("signatureOverlay") != {
        "width": OVERLAY_CANVAS,
        "height": OVERLAY_CANVAS,
        "margin": OVERLAY_MARGIN,
        "assetRoot": "/assets/equipment-wearable-exact/",
    }:
        raise ValueError("Signature overlay art contract is invalid")
    if not SHA256_PATTERN.fullmatch(catalog_sha256 or ""):
        raise ValueError("Signature manifest catalogSha256 is invalid")
    rows_sha256 = pipeline.get("catalog", {}).get("rowsSha256") if isinstance(pipeline, dict) else None
    if not SHA256_PATTERN.fullmatch(rows_sha256 or ""):
        raise ValueError("Signature manifest catalog rows hash is invalid")
    return entries, catalog_sha256, rows_sha256


def validate_registry(document: dict) -> tuple[dict, str]:
    entries = document.get("entries")
    if not isinstance(entries, dict) or len(entries) != 25:
        raise ValueError("Signature registry must contain exactly 25 entries")
    normalized: dict[str, dict] = {}
    for name, metadata in entries.items():
        if not isinstance(name, str) or not name or not isinstance(metadata, dict):
            raise ValueError("Signature registry identity is invalid")
        required = {"spriteKey", "tier", "category", "tone", "artNote"}
        if not required.issubset(metadata) or set(metadata).difference(REGISTRY_FIELDS):
            raise ValueError(f"Signature registry schema is invalid: {name}")
        normalized[name] = {
            "spriteKey": metadata["spriteKey"],
            "tier": metadata["tier"],
            "category": metadata["category"],
            "tone": metadata["tone"],
            "setGroup": metadata.get("setGroup", ""),
            "artNote": metadata["artNote"],
        }
        if any(not isinstance(normalized[name][field], str) or not normalized[name][field] for field in ("spriteKey", "tier", "category", "tone", "artNote")):
            raise ValueError(f"Signature registry metadata is invalid: {name}")
        if not isinstance(normalized[name]["setGroup"], str):
            raise ValueError(f"Signature registry setGroup is invalid: {name}")
    registry_sha256 = sha256_file(require_file(Path(document["__path"]))) if "__path" in document else ""
    return normalized, registry_sha256


def registry_hash(path: Path) -> str:
    return sha256_file(require_file(path))


def validate_batch(
    batch: dict,
    catalog_by_name: dict[str, dict],
    catalog_sha256: str,
    rows_sha256: str,
    manifest_entries: dict,
    registry: dict[str, dict],
) -> list[dict]:
    batch_id = batch.get("batchId")
    identities = batch.get("identities")
    identity_names = batch.get("identityNames")
    if not isinstance(batch_id, str) or not re.fullmatch(r"signature-mythic-[a-z0-9-]+", batch_id):
        raise ValueError("Signature batchId is invalid")
    if batch.get("catalogSha256") != catalog_sha256 or batch.get("catalogRowsSha256") != rows_sha256:
        raise ValueError(f"Signature batch catalog binding is invalid: {batch_id}")
    if batch.get("cohort") != COHORT:
        raise ValueError(f"Signature batch cohort is invalid: {batch_id}")
    if batch.get("grid") != {"columns": 3, "rows": 2, "cellOrder": list(CELL_ORDER)}:
        raise ValueError(f"Signature batch grid is invalid: {batch_id}")
    if not isinstance(identities, list) or not 1 <= len(identities) <= len(CELL_ORDER):
        raise ValueError(f"Signature batch identity count is invalid: {batch_id}")
    if not isinstance(identity_names, list) or len(identity_names) != len(identities):
        raise ValueError(f"Signature batch identity declaration is invalid: {batch_id}")
    if not isinstance(batch.get("itemPrompt"), str) or not batch["itemPrompt"].strip():
        raise ValueError(f"Signature batch item prompt is missing: {batch_id}")
    if not isinstance(batch.get("overlayPrompt"), str) or not batch["overlayPrompt"].strip():
        raise ValueError(f"Signature batch overlay prompt is missing: {batch_id}")

    families: set[str] = set()
    names: list[str] = []
    for index, identity in enumerate(identities):
        if not isinstance(identity, dict) or identity.get("cell") != CELL_ORDER[index]:
            raise ValueError(f"Signature batch cell order is invalid: {batch_id}")
        name = identity.get("name")
        row = catalog_by_name.get(name)
        metadata = registry.get(name)
        if row is None or row.get("cohort") != COHORT or metadata is None:
            raise ValueError(f"Signature batch identity is outside the live registry catalog: {name}")
        if {field: identity.get(field) for field in CATALOG_FIELDS} != row:
            raise ValueError(f"Signature batch catalog identity is invalid: {name}")
        if any(identity.get(batch_field) != metadata[registry_field] for batch_field, registry_field in BATCH_REGISTRY_FIELDS.items()):
            raise ValueError(f"Signature batch registry identity is invalid: {name}")
        if not isinstance(identity.get("itemPrompt"), str) or metadata["artNote"] not in identity["itemPrompt"]:
            raise ValueError(f"Signature item prompt does not bind artNote: {name}")
        if not isinstance(identity.get("overlayPrompt"), str) or metadata["artNote"] not in identity["overlayPrompt"]:
            raise ValueError(f"Signature overlay prompt does not bind artNote: {name}")
        if manifest_entries.get(name) != metadata["spriteKey"]:
            raise ValueError(f"Signature manifest item route does not bind registry spriteKey: {name}")
        families.add(row["familyKey"])
        names.append(name)
    if names != identity_names or len(set(names)) != len(names) or len(families) != 1:
        raise ValueError(f"Signature batch must be ordered, unique, and family-pure: {batch_id}")
    return identities


def normalize_cell(cell: Image.Image, cell_name: str, canvas_size: int, margin: int) -> Image.Image:
    bounds = validate_cell(cell, cell_name)
    cropped = cell.crop(bounds)
    maximum = canvas_size - margin * 2
    scale = min(maximum / cropped.width, maximum / cropped.height)
    width = max(1, min(maximum, math.floor(cropped.width * scale)))
    height = max(1, min(maximum, math.floor(cropped.height * scale)))
    icon = cropped.resize((width, height), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    canvas.alpha_composite(icon, ((canvas_size - width) // 2, (canvas_size - height) // 2))
    return canvas


def read_source(source_path: Path, count: int, label: str) -> Image.Image:
    with Image.open(source_path) as image:
        image.load()
        if image.mode != "RGBA" or image.size != SOURCE_SIZE:
            raise ValueError(f"Signature {label} source must be true RGBA 600x400")
        source = image.copy()
    for index in range(count, len(CELL_ORDER)):
        left = (index % 3) * CELL_SIZE[0]
        top = (index // 3) * CELL_SIZE[1]
        cell = source.crop((left, top, left + CELL_SIZE[0], top + CELL_SIZE[1]))
        if cell.getchannel("A").getextrema()[1] != 0:
            raise ValueError(f"Signature {label} source unused trailing cell {CELL_ORDER[index]} must be completely transparent")
    return source


def largest_connected_component(pixels: set[int]) -> int:
    remaining = set(pixels)
    largest = 0
    while remaining:
        pending = [remaining.pop()]
        size = 0
        while pending:
            pixel = pending.pop()
            size += 1
            x = pixel % CELL_SIZE[0]
            y = pixel // CELL_SIZE[0]
            neighbors = (
                pixel - 1 if x > 0 else -1,
                pixel + 1 if x < CELL_SIZE[0] - 1 else -1,
                pixel - CELL_SIZE[0] if y > 0 else -1,
                pixel + CELL_SIZE[0] if y < CELL_SIZE[1] - 1 else -1,
            )
            for neighbor in neighbors:
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    pending.append(neighbor)
        largest = max(largest, size)
    return largest


def validate_signature_chroma(cell: Image.Image, identity: dict, surface: str) -> None:
    green_pixels = {
        index
        for index, (red, green, blue, alpha) in enumerate(cell.get_flattened_data())
        if alpha > 0 and green >= 180 and green >= red + 50 and green >= blue + 50
    }
    if not green_pixels:
        return
    if identity.get("elem") != "자연" and identity.get("tone") != "nature":
        raise ValueError(
            f"Signature {surface} source contains chroma-green residual: "
            f"{identity['name']} ({len(green_pixels)} pixels)"
        )
    largest = largest_connected_component(green_pixels)
    if len(green_pixels) > 400 or largest > 200:
        raise ValueError(
            f"Signature {surface} nature source contains excessive chroma-green region: "
            f"{identity['name']} ({len(green_pixels)} pixels, component {largest})"
        )


def build_outputs(
    item_source_path: Path,
    overlay_source_path: Path,
    identities: list[dict],
    registry: dict[str, dict],
    public_root: Path,
) -> tuple[list[tuple[dict, Path, bytes, str]], list[tuple[dict, Path, bytes, str]]]:
    item_source = read_source(item_source_path, len(identities), "item")
    overlay_source = read_source(overlay_source_path, len(identities), "overlay")
    item_outputs = []
    overlay_outputs = []
    for index, identity in enumerate(identities):
        left = (index % 3) * CELL_SIZE[0]
        top = (index // 3) * CELL_SIZE[1]
        box = (left, top, left + CELL_SIZE[0], top + CELL_SIZE[1])
        item_cell = item_source.crop(box)
        overlay_cell = overlay_source.crop(box)
        validate_signature_chroma(item_cell, identity, "item")
        validate_signature_chroma(overlay_cell, identity, "overlay")
        item_payload = encode_png(normalize_cell(item_cell, identity["cell"], ITEM_CANVAS, ITEM_MARGIN))
        overlay_payload = encode_png(normalize_cell(overlay_cell, identity["cell"], OVERLAY_CANVAS, OVERLAY_MARGIN))
        item_path = validate_runtime_path(identity["runtimePath"], "/assets/equipment-exact/", identity["name"])
        overlay_path = validate_runtime_path(
            f"/assets/equipment-wearable-exact/{registry[identity['name']]['spriteKey']}.png",
            "/assets/equipment-wearable-exact/",
            identity["name"],
        )
        item_outputs.append((identity, resolve_runtime_path(public_root, item_path), item_payload, sha256_bytes(item_payload)))
        overlay_outputs.append((identity, resolve_runtime_path(public_root, overlay_path), overlay_payload, sha256_bytes(overlay_payload)))
    return item_outputs, overlay_outputs


def replay_key(batch_id: str, item_hash: str, overlay_hash: str, identity_names: list[str]) -> str:
    return sha256_bytes(compact_json_bytes({
        "batchId": batch_id,
        "itemSourceSheetSha256": item_hash,
        "overlaySourceSheetSha256": overlay_hash,
        "identityNames": identity_names,
    }))


def build_record(batch: dict, item_source: Path, overlay_source: Path, item_outputs: list, overlay_outputs: list) -> dict:
    item_hash = sha256_file(item_source)
    overlay_hash = sha256_file(overlay_source)
    return {
        "batchId": batch["batchId"],
        "catalogSha256": batch["catalogSha256"],
        "catalogRowsSha256": batch["catalogRowsSha256"],
        "cohort": COHORT,
        "identityNames": batch["identityNames"],
        "itemSourceSheet": item_source.name,
        "itemSourceSheetSha256": item_hash,
        "overlaySourceSheet": overlay_source.name,
        "overlaySourceSheetSha256": overlay_hash,
        "replayKey": replay_key(batch["batchId"], item_hash, overlay_hash, batch["identityNames"]),
        "itemExports": [
            {"cell": identity["cell"], "name": identity["name"], "runtimePath": identity["runtimePath"], "exportSha256": export_hash}
            for identity, _destination, _payload, export_hash in item_outputs
        ],
        "overlayExports": [
            {
                "cell": identity["cell"],
                "name": identity["name"],
                "runtimePath": f"/assets/equipment-wearable-exact/{identity['spriteKey']}.png",
                "exportSha256": export_hash,
            }
            for identity, _destination, _payload, export_hash in overlay_outputs
        ],
    }


def validate_export(export: object, name: str, cell: str, root: str) -> str:
    if not isinstance(export, dict) or set(export) != EXPORT_FIELDS:
        raise ValueError
    if export.get("name") != name or export.get("cell") != cell:
        raise ValueError
    path = validate_runtime_path(export.get("runtimePath"), root, name)
    if not SHA256_PATTERN.fullmatch(export.get("exportSha256") or ""):
        raise ValueError
    return path


def validate_record(record: object, catalog_by_name: dict[str, dict], registry: dict[str, dict], catalog_sha256: str, rows_sha256: str) -> None:
    if not isinstance(record, dict) or set(record) != RECORD_FIELDS:
        raise ValueError
    batch_id = record.get("batchId")
    names = record.get("identityNames")
    if not isinstance(batch_id, str) or not batch_id or not isinstance(names, list) or not 1 <= len(names) <= 6 or len(set(names)) != len(names):
        raise ValueError
    if record.get("catalogSha256") != catalog_sha256 or record.get("catalogRowsSha256") != rows_sha256 or record.get("cohort") != COHORT:
        raise ValueError
    item_source = record.get("itemSourceSheet")
    overlay_source = record.get("overlaySourceSheet")
    item_hash = record.get("itemSourceSheetSha256")
    overlay_hash = record.get("overlaySourceSheetSha256")
    if (
        not is_safe_png_basename(item_source)
        or not is_safe_png_basename(overlay_source)
        or item_source != f"{batch_id}-item.png"
        or overlay_source != f"{batch_id}-overlay.png"
        or not SHA256_PATTERN.fullmatch(item_hash or "")
        or not SHA256_PATTERN.fullmatch(overlay_hash or "")
        or item_hash == overlay_hash
        or record.get("replayKey") != replay_key(batch_id, item_hash, overlay_hash, names)
    ):
        raise ValueError
    if len(record.get("itemExports", [])) != len(names) or len(record.get("overlayExports", [])) != len(names):
        raise ValueError
    families = set()
    for index, name in enumerate(names):
        row = catalog_by_name.get(name)
        metadata = registry.get(name)
        if row is None or row.get("cohort") != COHORT or metadata is None:
            raise ValueError
        item_path = validate_export(record["itemExports"][index], name, CELL_ORDER[index], "/assets/equipment-exact/")
        overlay_path = validate_export(record["overlayExports"][index], name, CELL_ORDER[index], "/assets/equipment-wearable-exact/")
        if item_path != row["runtimePath"] or overlay_path != f"/assets/equipment-wearable-exact/{metadata['spriteKey']}.png":
            raise ValueError
        families.add(row["familyKey"])
    if len(families) != 1:
        raise ValueError


def validate_generation_review(review: object, manifest: dict, active_batch_ids: set[str]) -> None:
    if not isinstance(review, dict) or set(review) != GENERATION_REVIEW_FIELDS:
        raise ValueError
    if not isinstance(review.get("tool"), str) or not review["tool"].strip():
        raise ValueError
    accepted = review.get("accepted")
    rejected = review.get("rejected")
    if not isinstance(accepted, list) or not isinstance(rejected, list):
        raise ValueError
    accepted_pairs: set[tuple[str, str]] = set()
    raw_names: set[str] = set()
    raw_hashes: set[str] = set()

    def validate_candidate(candidate: object, fields: frozenset[str], is_rejected: bool) -> None:
        if not isinstance(candidate, dict) or set(candidate) != fields:
            raise ValueError
        batch_id = candidate.get("batchId")
        surface = candidate.get("surface")
        raw_name = candidate.get("rawImage")
        raw_hash = candidate.get("rawSha256")
        pair = (batch_id, surface)
        if (
            batch_id not in active_batch_ids
            or surface not in {"item", "overlay"}
            or not is_safe_png_basename(raw_name)
            or not SHA256_PATTERN.fullmatch(raw_hash or "")
            or raw_name in raw_names
            or raw_hash in raw_hashes
            or (not is_rejected and pair in accepted_pairs)
            or (is_rejected and (not isinstance(candidate.get("reason"), str) or not candidate["reason"].strip()))
        ):
            raise ValueError
        raw_names.add(raw_name)
        raw_hashes.add(raw_hash)
        if not is_rejected:
            accepted_pairs.add(pair)

    for candidate in accepted:
        validate_candidate(candidate, ACCEPTED_REVIEW_FIELDS, False)
    for candidate in rejected:
        validate_candidate(candidate, REJECTED_REVIEW_FIELDS, True)
    required_pairs = {(batch_id, surface) for batch_id in active_batch_ids for surface in ("item", "overlay")}
    if accepted_pairs != required_pairs:
        raise ValueError
    pin = manifest.get("pipeline", {}).get("provenance", {}).get("cohorts", {}).get(COHORT, {}).get("generationReviewSha256")
    review_hash = sha256_bytes(json.dumps(review, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    if pin != review_hash:
        raise ValueError


def read_provenance(path: Path, catalog_by_name: dict[str, dict], registry: dict[str, dict], catalog_sha256: str, rows_sha256: str, registry_sha256: str, manifest: dict) -> dict:
    if not path.is_file():
        return {"version": 1, "batches": []}
    try:
        provenance = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(provenance, dict) or set(provenance) not in (BASE_PROVENANCE_FIELDS, FINAL_PROVENANCE_FIELDS) or provenance.get("version") != 1:
            raise ValueError
        batches = provenance.get("batches")
        if not isinstance(batches, list):
            raise ValueError
        batch_ids = set()
        names = set()
        paths = set()
        source_names = set()
        source_hashes = set()
        for record in batches:
            validate_record(record, catalog_by_name, registry, catalog_sha256, rows_sha256)
            if record["batchId"] in batch_ids or names.intersection(record["identityNames"]):
                raise ValueError
            record_paths = {entry["runtimePath"] for key in ("itemExports", "overlayExports") for entry in record[key]}
            record_source_names = {record["itemSourceSheet"], record["overlaySourceSheet"]}
            record_source_hashes = {record["itemSourceSheetSha256"], record["overlaySourceSheetSha256"]}
            if paths.intersection(record_paths) or source_names.intersection(record_source_names) or source_hashes.intersection(record_source_hashes):
                raise ValueError
            batch_ids.add(record["batchId"])
            names.update(record["identityNames"])
            paths.update(record_paths)
            source_names.update(record_source_names)
            source_hashes.update(record_source_hashes)
        if set(provenance) == FINAL_PROVENANCE_FIELDS:
            if provenance.get("catalogSha256") != catalog_sha256 or provenance.get("catalogRowsSha256") != rows_sha256 or provenance.get("cohort") != COHORT or provenance.get("registrySha256") != registry_sha256:
                raise ValueError
            validate_generation_review(provenance.get("generationReview"), manifest, batch_ids)
        return provenance
    except (json.JSONDecodeError, OSError, TypeError, ValueError) as error:
        raise ValueError(f"Invalid signature provenance ledger: {path}") from error


def prepare_next_provenance(
    provenance: dict,
    record: dict,
    outputs: list,
    replace_existing: bool = False,
) -> tuple[bool, bool, bytes | None]:
    existing = next((entry for entry in provenance["batches"] if entry["batchId"] == record["batchId"]), None)
    if existing is not None:
        if existing != record and not replace_existing:
            raise ValueError(f"Conflicting signature batchId in provenance ledger: {record['batchId']}")
        if existing == record:
            for _identity, destination, _payload, export_hash in outputs:
                if not destination.is_file() or sha256_file(destination) != export_hash:
                    raise ValueError(f"Signature exact replay output does not match provenance: {destination}")
            return True, False, None

        other_records = [entry for entry in provenance["batches"] if entry["batchId"] != record["batchId"]]
        other_source_names = {
            entry[key]
            for entry in other_records
            for key in ("itemSourceSheet", "overlaySourceSheet")
        }
        other_source_hashes = {
            entry[key]
            for entry in other_records
            for key in ("itemSourceSheetSha256", "overlaySourceSheetSha256")
        }
        other_runtime_paths = {
            export["runtimePath"]
            for entry in other_records
            for key in ("itemExports", "overlayExports")
            for export in entry[key]
        }
        replacement_source_names = {record["itemSourceSheet"], record["overlaySourceSheet"]}
        replacement_source_hashes = {record["itemSourceSheetSha256"], record["overlaySourceSheetSha256"]}
        replacement_runtime_paths = {
            export["runtimePath"]
            for key in ("itemExports", "overlayExports")
            for export in record[key]
        }
        if (
            other_source_names.intersection(replacement_source_names)
            or other_source_hashes.intersection(replacement_source_hashes)
            or other_runtime_paths.intersection(replacement_runtime_paths)
        ):
            raise ValueError(f"Signature replacement collides with another batch: {record['batchId']}")
        next_batches = [
            record if entry["batchId"] == record["batchId"] else entry
            for entry in provenance["batches"]
        ]
        next_provenance = {**provenance, "batches": next_batches}
        return False, True, canonical_json_bytes(next_provenance, sort_keys=True)
    if "generationReview" in provenance:
        raise ValueError(f"Finalized signature provenance cannot append batch: {record['batchId']}")
    next_provenance = {**provenance, "batches": [*provenance["batches"], record]}
    return False, False, canonical_json_bytes(next_provenance, sort_keys=True)


def stage_and_publish(outputs: list, provenance_payload: bytes, provenance_path: Path) -> None:
    staged_outputs: list[tuple[Path, Path]] = []
    staged_provenance: Path | None = None
    try:
        for _identity, destination, payload, export_hash in outputs:
            stage = stage_bytes(destination, payload)
            if sha256_file(stage) != export_hash:
                raise OSError(f"Signature staged export hash mismatch: {destination}")
            staged_outputs.append((stage, destination))
        staged_provenance = stage_bytes(provenance_path, provenance_payload)
        publish_staged_batch(staged_outputs, staged_provenance, provenance_path)
    finally:
        for stage, _destination in staged_outputs:
            stage.unlink(missing_ok=True)
        if staged_provenance is not None:
            staged_provenance.unlink(missing_ok=True)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch", required=True, type=Path)
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--signature-registry", required=True, type=Path)
    parser.add_argument("--item-source-sheet", required=True, type=Path)
    parser.add_argument("--overlay-source-sheet", required=True, type=Path)
    parser.add_argument("--source-declaration", required=True, type=Path)
    parser.add_argument("--public-root", required=True, type=Path)
    parser.add_argument("--equipment-manifest", required=True, type=Path)
    parser.add_argument("--provenance", required=True, type=Path)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--replace-existing", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    manifest = read_json(args.equipment_manifest)
    manifest_entries, catalog_sha256, expected_rows_sha256 = validate_manifest(manifest)
    catalog_by_name, rows_sha256 = validate_catalog(read_catalog(args.catalog), expected_rows_sha256)
    registry_document = read_json(args.signature_registry)
    registry, _unused = validate_registry(registry_document)
    registry_sha256 = registry_hash(args.signature_registry)
    batch = read_json(args.batch)
    identities = validate_batch(batch, catalog_by_name, catalog_sha256, rows_sha256, manifest_entries, registry)
    validate_declaration(batch, read_json(args.source_declaration))

    item_source = require_file(args.item_source_sheet)
    overlay_source = require_file(args.overlay_source_sheet)
    if item_source.name != f"{batch['batchId']}-item.png" or overlay_source.name != f"{batch['batchId']}-overlay.png":
        raise ValueError(f"Signature source basenames must bind to batchId: {batch['batchId']}")
    provenance_path = args.provenance.expanduser().resolve()
    provenance = read_provenance(provenance_path, catalog_by_name, registry, catalog_sha256, rows_sha256, registry_sha256, manifest)
    item_outputs, overlay_outputs = build_outputs(item_source, overlay_source, identities, registry, args.public_root.expanduser().resolve())
    outputs = [*item_outputs, *overlay_outputs]
    record = build_record(batch, item_source, overlay_source, item_outputs, overlay_outputs)
    exact_replay, replaced, provenance_payload = prepare_next_provenance(
        provenance,
        record,
        outputs,
        args.replace_existing,
    )
    if exact_replay:
        print(f"replay no-op: {len(identities)} signature identities already match {batch['batchId']}")
        return
    if args.dry_run:
        print(f"dry run: validated {len(identities)} signature identities for {batch['batchId']}")
        return
    if provenance_payload is None:
        raise ValueError(f"Missing signature provenance payload: {batch['batchId']}")
    stage_and_publish(outputs, provenance_payload, provenance_path)
    action = "replaced" if replaced else "processed"
    print(f"{action} {len(identities)} signature identities for {batch['batchId']}")


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError, OSError, json.JSONDecodeError) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from error
