#!/usr/bin/env python3
"""Validate and atomically publish one family-only Art Bible source sheet."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path, PurePosixPath

from process_equipment_art_batch import (
    CELL_ORDER,
    build_outputs,
    canonical_json_bytes,
    compact_json_bytes,
    require_file,
    sha256_file,
    stage_and_publish_batch,
)


DEFINED_FAMILIES = (
    "armor-boots",
    "armor-cloak",
    "armor-coat",
    "armor-leather",
    "armor-plate",
    "armor-robe",
    "headgear-cap",
    "headgear-circlet",
    "headgear-helm",
    "headgear-hood",
    "headgear-mask",
    "headgear-straw-hat",
    "headgear-wizard-hat",
    "offhand-book",
    "offhand-shield",
    "weapon-bow",
    "weapon-dagger",
    "weapon-heavy",
    "weapon-lance",
    "weapon-staff",
    "weapon-sword",
    "weapon-whip",
)
SHA256 = frozenset("0123456789abcdef")
BATCH_FIELDS = frozenset({
    "version",
    "batchId",
    "catalogSha256",
    "definedFamiliesSha256",
    "grid",
    "familyKeys",
    "identities",
    "prompt",
})
IDENTITY_FIELDS = frozenset({"cell", "familyKey", "runtimePath", "prompt"})
PROVENANCE_FIELDS = frozenset({
    "version",
    "catalogSha256",
    "definedFamiliesSha256",
    "batches",
})
GENERATION_REVIEW_FIELDS = frozenset({"tool", "accepted", "rejected"})
ACCEPTED_REVIEW_FIELDS = frozenset({"batchId", "rawImage", "rawSha256"})
REJECTED_REVIEW_FIELDS = ACCEPTED_REVIEW_FIELDS | {"reason"}


def is_safe_png_basename(value: object) -> bool:
    return (
        isinstance(value, str)
        and bool(value)
        and value.endswith(".png")
        and value == PurePosixPath(value).name
        and "/" not in value
        and "\\" not in value
        and value not in {".", ".."}
    )
RECORD_FIELDS = frozenset({
    "batchId",
    "catalogSha256",
    "definedFamiliesSha256",
    "familyKeys",
    "sourceSheet",
    "sourceSheetSha256",
    "replayKey",
    "exports",
})
EXPORT_FIELDS = frozenset({"cell", "familyKey", "runtimePath", "exportSha256"})


def is_sha256(value: object) -> bool:
    return isinstance(value, str) and len(value) == 64 and set(value) <= SHA256


def hash_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def family_set_hash() -> str:
    return hash_bytes(compact_json_bytes(list(DEFINED_FAMILIES)))


def read_json(path: Path) -> dict:
    source = require_file(path)
    value = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object: {source}")
    return value


def family_runtime_path(family_key: str) -> str:
    return f"/assets/equipment-family/items/{family_key}.png"


def validate_manifest(manifest: dict) -> tuple[str, dict[str, dict]]:
    catalog_sha256 = manifest.get("catalogSha256")
    if not is_sha256(catalog_sha256):
        raise ValueError("Equipment manifest catalogSha256 is invalid")
    art = manifest.get("art")
    families = art.get("families") if isinstance(art, dict) else None
    if not isinstance(families, dict) or tuple(sorted(families)) != DEFINED_FAMILIES:
        raise ValueError("Equipment manifest must declare the exact 22 Art Bible families")
    if art.get("familyAssetRoot") != "/assets/equipment-family/items/":
        raise ValueError("Equipment manifest familyAssetRoot is invalid")
    for family_key, metadata in families.items():
        if not isinstance(metadata, dict) or metadata.get("runtimePath") != family_runtime_path(family_key):
            raise ValueError(f"Equipment family runtime path is invalid: {family_key}")
        if metadata.get("styleVersion") not in (1, 2):
            raise ValueError(f"Equipment family styleVersion is invalid: {family_key}")
    return catalog_sha256, families


def validate_batch(batch: dict, catalog_sha256: str) -> list[dict]:
    if set(batch) != BATCH_FIELDS or batch.get("version") != 1:
        raise ValueError("Family exemplar batch schema is invalid")
    batch_id = batch.get("batchId")
    if not isinstance(batch_id, str) or not batch_id.strip():
        raise ValueError("Family exemplar batch id is invalid")
    if batch.get("catalogSha256") != catalog_sha256:
        raise ValueError(f"Family exemplar batch catalog pin is invalid: {batch_id}")
    if batch.get("definedFamiliesSha256") != family_set_hash():
        raise ValueError(f"Family exemplar defined-family pin is invalid: {batch_id}")
    if batch.get("grid") != {"columns": 3, "rows": 2, "cellOrder": list(CELL_ORDER)}:
        raise ValueError(f"Family exemplar batch grid is invalid: {batch_id}")

    family_keys = batch.get("familyKeys")
    identities = batch.get("identities")
    if (
        not isinstance(family_keys, list)
        or not 1 <= len(family_keys) <= len(CELL_ORDER)
        or family_keys != sorted(family_keys)
        or len(set(family_keys)) != len(family_keys)
        or not isinstance(identities, list)
        or len(identities) != len(family_keys)
    ):
        raise ValueError(f"Family exemplar identity order is invalid: {batch_id}")

    for index, identity in enumerate(identities):
        if not isinstance(identity, dict) or set(identity) != IDENTITY_FIELDS:
            raise ValueError(f"Family exemplar identity schema is invalid: {batch_id}")
        family_key = identity.get("familyKey")
        if (
            identity.get("cell") != CELL_ORDER[index]
            or family_key != family_keys[index]
            or family_key not in DEFINED_FAMILIES
            or identity.get("runtimePath") != family_runtime_path(family_key)
            or not isinstance(identity.get("prompt"), str)
            or not identity["prompt"].strip()
        ):
            raise ValueError(f"Family exemplar identity is invalid: {family_key}")
    return identities


def validate_declaration(batch: dict, declaration: dict) -> None:
    if set(declaration) != {"batchId", "familyKeys"} or declaration != {
        "batchId": batch["batchId"],
        "familyKeys": batch["familyKeys"],
    }:
        raise ValueError(f"Declared families do not match batch manifest: {batch['batchId']}")


def replay_key(batch_id: str, source_sheet_sha256: str, family_keys: list[str]) -> str:
    return hash_bytes(compact_json_bytes({
        "batchId": batch_id,
        "sourceSheetSha256": source_sheet_sha256,
        "familyKeys": family_keys,
    }))


def validate_export(export: object, family_key: str, cell: str) -> str:
    if not isinstance(export, dict) or set(export) != EXPORT_FIELDS:
        raise ValueError
    runtime_path = export.get("runtimePath")
    if (
        export.get("cell") != cell
        or export.get("familyKey") != family_key
        or runtime_path != family_runtime_path(family_key)
        or ".." in PurePosixPath(runtime_path).parts
        or not is_sha256(export.get("exportSha256"))
    ):
        raise ValueError
    return runtime_path


def validate_record(record: object, catalog_sha256: str) -> tuple[str, set[str], set[str]]:
    if not isinstance(record, dict) or set(record) != RECORD_FIELDS:
        raise ValueError
    batch_id = record.get("batchId")
    family_keys = record.get("familyKeys")
    source_hash = record.get("sourceSheetSha256")
    source_sheet = record.get("sourceSheet")
    if (
        not isinstance(batch_id, str)
        or not batch_id.strip()
        or record.get("catalogSha256") != catalog_sha256
        or record.get("definedFamiliesSha256") != family_set_hash()
        or not isinstance(family_keys, list)
        or not 1 <= len(family_keys) <= len(CELL_ORDER)
        or family_keys != sorted(family_keys)
        or len(set(family_keys)) != len(family_keys)
        or any(family_key not in DEFINED_FAMILIES for family_key in family_keys)
        or not isinstance(source_sheet, str)
        or not source_sheet.strip()
        or source_sheet != PurePosixPath(source_sheet).name
        or "/" in source_sheet
        or "\\" in source_sheet
        or source_sheet in {".", ".."}
        or not is_sha256(source_hash)
        or record.get("replayKey") != replay_key(batch_id, source_hash, family_keys)
    ):
        raise ValueError
    exports = record.get("exports")
    if not isinstance(exports, list) or len(exports) != len(family_keys):
        raise ValueError
    runtime_paths = {
        validate_export(export, family_key, CELL_ORDER[index])
        for index, (family_key, export) in enumerate(zip(family_keys, exports, strict=True))
    }
    if len(runtime_paths) != len(family_keys):
        raise ValueError
    return batch_id, set(family_keys), runtime_paths


def validate_generation_review(review: object, manifest: dict, active_batch_ids: set[str]) -> None:
    if not isinstance(review, dict) or set(review) != GENERATION_REVIEW_FIELDS:
        raise ValueError
    if not isinstance(review.get("tool"), str) or not review["tool"].strip():
        raise ValueError
    accepted = review.get("accepted")
    rejected = review.get("rejected")
    if not isinstance(accepted, list) or not isinstance(rejected, list):
        raise ValueError

    raw_hashes: set[str] = set()
    raw_images: set[str] = set()
    accepted_batches: set[str] = set()
    for candidate, fields, rejected_candidate in (
        *((candidate, ACCEPTED_REVIEW_FIELDS, False) for candidate in accepted),
        *((candidate, REJECTED_REVIEW_FIELDS, True) for candidate in rejected),
    ):
        if not isinstance(candidate, dict) or set(candidate) != fields:
            raise ValueError
        batch_id = candidate.get("batchId")
        raw_image = candidate.get("rawImage")
        raw_hash = candidate.get("rawSha256")
        if (
            not isinstance(batch_id, str)
            or not batch_id.strip()
            or not is_safe_png_basename(raw_image)
            or not is_sha256(raw_hash)
            or raw_hash in raw_hashes
            or raw_image in raw_images
            or (not rejected_candidate and batch_id in accepted_batches)
            or batch_id not in active_batch_ids
            or (rejected_candidate and (
                not isinstance(candidate.get("reason"), str)
                or not candidate["reason"].strip()
            ))
        ):
            raise ValueError
        raw_hashes.add(raw_hash)
        raw_images.add(raw_image)
        if not rejected_candidate:
            accepted_batches.add(batch_id)

    if accepted_batches != active_batch_ids:
        raise ValueError

    pin = (
        manifest.get("pipeline", {})
        .get("provenance", {})
        .get("familyExemplars", {})
        .get("generationReviewSha256")
    )
    review_hash = hash_bytes(json.dumps(
        review,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8"))
    if not is_sha256(pin) or pin != review_hash:
        raise ValueError


def read_provenance(path: Path, catalog_sha256: str, manifest: dict) -> dict:
    if not path.is_file():
        return {
            "version": 1,
            "catalogSha256": catalog_sha256,
            "definedFamiliesSha256": family_set_hash(),
            "batches": [],
        }
    try:
        provenance = json.loads(path.read_text(encoding="utf-8"))
        if (
            not isinstance(provenance, dict)
            or set(provenance) not in (PROVENANCE_FIELDS, PROVENANCE_FIELDS | {"generationReview"})
            or provenance.get("version") != 1
            or provenance.get("catalogSha256") != catalog_sha256
            or provenance.get("definedFamiliesSha256") != family_set_hash()
            or not isinstance(provenance.get("batches"), list)
        ):
            raise ValueError
        batch_ids: set[str] = set()
        family_keys: set[str] = set()
        runtime_paths: set[str] = set()
        for record in provenance["batches"]:
            batch_id, record_families, record_paths = validate_record(record, catalog_sha256)
            if batch_id in batch_ids or family_keys & record_families or runtime_paths & record_paths:
                raise ValueError
            batch_ids.add(batch_id)
            family_keys.update(record_families)
            runtime_paths.update(record_paths)
        if "generationReview" in provenance:
            validate_generation_review(provenance["generationReview"], manifest, batch_ids)
        return provenance
    except (json.JSONDecodeError, OSError, TypeError, ValueError) as error:
        raise ValueError(f"Invalid family provenance ledger: {path}") from error


def build_record(batch: dict, source_sheet: Path, outputs: list[tuple]) -> dict:
    source_hash = sha256_file(source_sheet)
    return {
        "batchId": batch["batchId"],
        "catalogSha256": batch["catalogSha256"],
        "definedFamiliesSha256": batch["definedFamiliesSha256"],
        "familyKeys": batch["familyKeys"],
        "sourceSheet": source_sheet.name,
        "sourceSheetSha256": source_hash,
        "replayKey": replay_key(batch["batchId"], source_hash, batch["familyKeys"]),
        "exports": [
            {
                "cell": identity["cell"],
                "familyKey": identity["familyKey"],
                "runtimePath": identity["runtimePath"],
                "exportSha256": export_hash,
            }
            for identity, _destination, _payload, export_hash in outputs
        ],
    }


def prepare_provenance(provenance: dict, record: dict, outputs: list[tuple]) -> tuple[bool, bytes | None]:
    existing = next((entry for entry in provenance["batches"] if entry["batchId"] == record["batchId"]), None)
    if existing is not None:
        if existing["replayKey"] != record["replayKey"] or existing != record:
            raise ValueError(f"Conflicting batchId in family provenance ledger: {record['batchId']}")
        for _identity, destination, _payload, export_hash in outputs:
            if not destination.is_file() or sha256_file(destination) != export_hash:
                raise ValueError(f"Exact family replay output does not match provenance: {destination}")
        return True, None

    new_families = set(record["familyKeys"])
    new_paths = {entry["runtimePath"] for entry in record["exports"]}
    for prior in provenance["batches"]:
        if new_families & set(prior["familyKeys"]) or new_paths & {entry["runtimePath"] for entry in prior["exports"]}:
            raise ValueError(f"Family or runtime path is already declared by prior provenance: {record['batchId']}")
    next_provenance = {**provenance, "batches": [*provenance["batches"], record]}
    return False, canonical_json_bytes(next_provenance, sort_keys=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch", required=True, type=Path)
    parser.add_argument("--source-sheet", required=True, type=Path)
    parser.add_argument("--source-declaration", required=True, type=Path)
    parser.add_argument("--public-root", required=True, type=Path)
    parser.add_argument("--equipment-manifest", required=True, type=Path)
    parser.add_argument("--provenance", required=True, type=Path)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    manifest = read_json(args.equipment_manifest)
    catalog_sha256, _families = validate_manifest(manifest)
    batch = read_json(args.batch)
    identities = validate_batch(batch, catalog_sha256)
    validate_declaration(batch, read_json(args.source_declaration))
    provenance_path = args.provenance.expanduser().resolve()
    provenance = read_provenance(provenance_path, catalog_sha256, manifest)
    source_sheet = require_file(args.source_sheet)
    outputs = build_outputs(source_sheet, identities, args.public_root.expanduser().resolve())
    record = build_record(batch, source_sheet, outputs)
    exact_replay, provenance_payload = prepare_provenance(provenance, record, outputs)
    if exact_replay:
        print(f"replay no-op: {len(outputs)} family exemplars already match {batch['batchId']}")
        return
    if args.dry_run:
        print(f"dry run: validated {len(outputs)} family exemplars for {batch['batchId']}")
        return
    if provenance_payload is None:
        raise ValueError(f"Missing next family provenance payload: {batch['batchId']}")
    stage_and_publish_batch(outputs, provenance_payload, provenance_path)
    print(f"processed {len(outputs)} family exemplars for {batch['batchId']}")


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, ValueError, OSError, json.JSONDecodeError) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from error
