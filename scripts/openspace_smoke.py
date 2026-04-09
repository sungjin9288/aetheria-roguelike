#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
SKILL_DIR = REPO_ROOT / ".agents" / "skills"
OPENSPACE_ROOT = Path("/Users/sungjin/dev/personal/agent-infra/OpenSpace")
OPENSPACE_PYTHON = OPENSPACE_ROOT / ".venv" / "bin" / "python"
CODEX_CONFIG = Path.home() / ".codex" / "config.toml"
RESULT_SENTINEL = "__OPENSPACE_RESULT__"
EXPECTED_SKILLS = [
    "aetheria-openspace-bootstrap",
    "aetheria-openspace-ui",
    "aetheria-openspace-content",
    "aetheria-openspace-playtest",
    "delegate-task",
    "skill-discovery",
]

SEARCH_SNIPPET = """
import asyncio
import os
from openspace.mcp_server import search_skills

print("__OPENSPACE_RESULT__" + asyncio.run(
    search_skills(
        query=os.environ["OPENSPACE_SMOKE_QUERY"],
        source="local",
        limit=20,
        auto_import=False,
    )
))
"""

EXECUTE_SNIPPET = """
import asyncio
import os
from openspace.mcp_server import execute_task

print("__OPENSPACE_RESULT__" + asyncio.run(
    execute_task(
        task=(
            "Read the available local Aetheria Roguelike OpenSpace skills and answer with "
            "their names only. Do not modify files."
        ),
        workspace_dir=os.environ["OPENSPACE_SMOKE_WORKSPACE_DIR"],
        max_iterations=1,
        skill_dirs=[os.environ["OPENSPACE_SMOKE_SKILL_DIR"]],
        search_scope="local",
    )
))
"""


def _run_openspace(snippet: str, *, query: str | None = None, timeout_sec: int = 45) -> dict:
    env = os.environ.copy()
    env.update(
        {
            "OPENSPACE_HOST_SKILL_DIRS": str(SKILL_DIR),
            "OPENSPACE_WORKSPACE": str(OPENSPACE_ROOT),
            "OPENSPACE_BACKEND_SCOPE": "shell",
            "OPENSPACE_ENABLE_RECORDING": "false",
            "OPENSPACE_SMOKE_SKILL_DIR": str(SKILL_DIR),
            "OPENSPACE_SMOKE_WORKSPACE_DIR": str(REPO_ROOT),
        }
    )
    if query:
        env["OPENSPACE_SMOKE_QUERY"] = query

    try:
        completed = subprocess.run(
            [str(OPENSPACE_PYTHON), "-c", snippet],
            cwd=str(REPO_ROOT),
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout.decode("utf-8", errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or "")
        stderr = exc.stderr.decode("utf-8", errors="replace") if isinstance(exc.stderr, bytes) else (exc.stderr or "")
        combined = (stdout + "\n" + stderr).strip()
        return {
            "status": "timeout",
            "returncode": None,
            "result": None,
            "raw_output": combined,
        }

    combined = "\n".join(part for part in [completed.stdout, completed.stderr] if part).strip()
    payload = None
    if RESULT_SENTINEL in combined:
        raw = combined.split(RESULT_SENTINEL, 1)[1].strip()
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"raw": raw}

    return {
        "status": "completed",
        "returncode": completed.returncode,
        "result": payload,
        "raw_output": combined,
    }


def _classify_execute(run: dict) -> dict:
    raw_output = run.get("raw_output", "")
    payload = run.get("result") or {}

    if "No cookie auth credentials found" in raw_output:
        return {
            "status": "blocked_missing_host_llm_credentials",
            "message": "execute_task reached OpenSpace runtime init, but LLM auth was missing in the current shell context (OpenRouter 401: No cookie auth credentials found).",
            "taskResult": payload,
        }

    if "AuthenticationError" in raw_output:
        return {
            "status": "blocked_authentication_error",
            "message": "execute_task reached the OpenSpace runtime but failed on model authentication.",
            "taskResult": payload,
        }

    if run["status"] == "timeout":
        return {
            "status": "timeout",
            "message": "execute_task did not finish within the smoke timeout.",
        }

    if payload.get("status") == "ok":
        return {
            "status": "ok",
            "message": "execute_task completed from the current shell context.",
            "taskResult": payload,
        }

    return {
        "status": "error",
        "message": "execute_task did not complete successfully.",
        "taskResult": payload,
    }


def main() -> int:
    if not OPENSPACE_PYTHON.exists():
        raise SystemExit(f"Missing OpenSpace python at {OPENSPACE_PYTHON}")

    config_text = CODEX_CONFIG.read_text(encoding="utf-8") if CODEX_CONFIG.exists() else ""
    skill_files = sorted(path.parent.name for path in SKILL_DIR.glob("*/SKILL.md"))
    missing_skill_dirs = [name for name in EXPECTED_SKILLS if name not in skill_files]

    search_run = _run_openspace(
        SEARCH_SNIPPET,
        query="aetheria roguelike mobile capacitor combat relic prestige quest openspace",
        timeout_sec=30,
    )
    if search_run["status"] != "completed" or not isinstance(search_run.get("result"), dict):
        raise SystemExit("OpenSpace local search smoke did not produce a parseable result.")

    search_result = search_run["result"]
    discovered_names = [item.get("name", "") for item in search_result.get("results", [])]
    missing_discovered = [name for name in EXPECTED_SKILLS if name not in discovered_names]

    execute_run = _run_openspace(EXECUTE_SNIPPET, timeout_sec=30)
    execute_summary = _classify_execute(execute_run)

    report = {
        "ok": not missing_skill_dirs and not missing_discovered,
        "repo": str(REPO_ROOT),
        "skillDir": str(SKILL_DIR),
        "openspaceWorkspace": str(OPENSPACE_ROOT),
        "openspacePython": str(OPENSPACE_PYTHON),
        "expectedSkills": EXPECTED_SKILLS,
        "repoSkillDirsPresent": skill_files,
        "missingSkillDirs": missing_skill_dirs,
        "localSearch": {
            "count": search_result.get("count"),
            "discoveredNames": discovered_names,
            "missingExpectedSkills": missing_discovered,
        },
        "mcpConfig": {
            "path": str(CODEX_CONFIG),
            "hasOpenSpaceServer": "[mcp_servers.openspace]" in config_text,
            "mentionsRepoSkillDir": str(SKILL_DIR) in config_text,
            "mentionsWorkspace": str(OPENSPACE_ROOT) in config_text,
        },
        "executeTask": execute_summary,
    }

    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
