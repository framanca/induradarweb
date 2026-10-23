#!/usr/bin/env python3
"""Prepare IEC ST function-block definitions for manual Sysmac Studio POU creation.

The repository contains complete textual FUNCTION_BLOCK declarations.
Sysmac Studio's normal ST editor instead expects body and variable tables.
This script splits sources accordingly; it does NOT compile ST, sign certificates,
or make HTTPS function. Output is a development artifact, not PLC runtime code.
"""
from __future__ import annotations
import argparse
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    "FB_WebSHA256.st",
    "FB_WebAES128.st",
    "FB_WebHMACSHA256.st",
    "FB_WebTLS12PRF.st",
    "FB_WebAESGCM.st",
    "FB_WebTLS12Record.st",
]
GROUP = re.compile(r"^\s*(VAR_INPUT|VAR_OUTPUT|VAR)\s*$(.*?)^\s*END_VAR\s*$",
                   re.M | re.S)
DECL = re.compile(r"^([A-Za-z_]\w*)\s*:\s*(.+?)(?:\s*:=\s*(.+?))?$")

def split(text: str) -> tuple[str, dict[str, list[tuple[str, str, str]]], str]:
    found = re.search(r"^\s*FUNCTION_BLOCK\s+([A-Za-z_]\w*)\s*$", text, re.M)
    if not found:
        raise ValueError("Missing FUNCTION_BLOCK declaration")
    name = found.group(1)
    rest = text[found.end():]
    groups: dict[str, list[tuple[str, str, str]]] = {"VAR_INPUT":[],"VAR_OUTPUT":[],"VAR":[]}
    matches = list(GROUP.finditer(rest))
    if not matches or [m.group(1) for m in matches] != ["VAR_INPUT","VAR_OUTPUT","VAR"]:
        raise ValueError(name + ": expected VAR_INPUT, VAR_OUTPUT, VAR declarations")
    for match in matches:
        block = match.group(2)
        for part in block.split(";"):
            decl = re.sub(r"\(\*.*?\*\)", "", part, flags=re.S).strip()
            if not decl: continue
            line = DECL.fullmatch(decl)
            if not line:
                raise ValueError(name + ": unsupported declaration " + repr(decl))
            symbol, type_name, initial = line.groups()
            groups[match.group(1)].append((symbol, type_name.strip(), (initial or "").strip()))
    body = rest[matches[-1].end():]
    if not re.search(r"\bEND_FUNCTION_BLOCK\s*$", body):
        raise ValueError(name + ": missing END_FUNCTION_BLOCK")
    body = re.sub(r"\bEND_FUNCTION_BLOCK\s*$", "", body).strip() + "\n"
    if not body or "CASE State" not in body:
        raise ValueError(name + ": missing expected ST state machine")
    return name, groups, body

def run(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for filename in SOURCES:
        source = (ROOT / "crypto" / filename).read_text(encoding="utf-8")
        name, groups, body = split(source)
        target = out_dir / name
        target.mkdir(parents=True, exist_ok=True)
        (target / "Body.st").write_text(body, encoding="utf-8")
        for kind, rows in groups.items():
            filename = {"VAR_INPUT":"Inputs.tsv","VAR_OUTPUT":"Outputs.tsv","VAR":"Internals.tsv"}[kind]
            (target / filename).write_text("".join(
                "\t".join((symbol, typ, initial, "", "", "", "Generated for Sysmac POU")) + "\r\n"
                for symbol, typ, initial in rows), encoding="utf-8")
    (out_dir / "README.txt").write_text(
        "LAB ONLY — these POU files DO NOT implement the HTTPS handshake.\n"
        "In Sysmac Studio create six Function Blocks in this dependency order:\n"
        + ", ".join(Path(x).stem for x in SOURCES) + ".\n"
        "For each FB paste Body.st as Structured Text body; paste Inputs.tsv,\n"
        "Outputs.tsv and Internals.tsv into corresponding variable categories.\n"
        "Depending on Sysmac version, tabular paste may need column adjustment.\n"
        "Check actual compiler diagnostics before transferring anything.\n"
        "No firmware / Sysmac compilation or PLC-runtime test has occurred here.\n",
        encoding="utf-8")
    print("Prepared Sysmac FB folders:", out_dir)

def main() -> None:
    parser=argparse.ArgumentParser()
    parser.add_argument("--output", type=Path,
                        default=Path("WebHMI_HTTPS_POC/sysmac_ready"))
    args=parser.parse_args()
    run(args.output)

if __name__=="__main__":
    main()
