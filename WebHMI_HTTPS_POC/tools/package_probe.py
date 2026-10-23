#!/usr/bin/env python3
"""Combine an existing WebHMI editor export with a fail-closed ST TLS transport probe.

DEVELOPMENT PACKAGER ONLY (runs on development PC). The PLC runs ST, no Python.
NOT AN HTTPS SERVER; intentionally does not make an HTTPS HMI available.
"""
from __future__ import annotations
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, is_zipfile

ROOT = Path(__file__).resolve().parents[1]
POC_ST = ROOT / "sysmac" / "WebHMI_TLS_Probe.st"
POC_VARS = ROOT / "sysmac" / "WebHMI_TLS_Probe_LocalVariables.tsv"

def package(source: Path, target: Path) -> None:
    if not source.is_file() or not is_zipfile(source):
        raise ValueError("Debe facilitarse el ZIP real exportado por HMI_NX_ST.")
    if source.resolve() == target.resolve():
        raise ValueError("La salida no puede sobreescribir el ZIP de origen.")
    seen = set()
    with ZipFile(source, "r") as current, ZipFile(target, "w", ZIP_DEFLATED) as out:
        for name in current.namelist():
            if name.endswith("/"):
                continue
            path = Path(name)
            if path.is_absolute() or ".." in path.parts:
                raise ValueError("Ruta ZIP no válida: " + name)
            data = current.read(name)
            # Original ST and locals go to a reference folder to prevent accidental
            # deployment of HTTP-only ST as the purported HTTPS application.
            if path.name in ("WebHMI_Server.st", "WebHMI_LocalVariables.tsv"):
                dest = "HTTP_REFERENCE_DO_NOT_IMPORT/" + path.name
            else:
                dest = name
            if dest in seen:
                raise ValueError("Archivo duplicado: " + dest)
            seen.add(dest)
            out.writestr(dest, data)
        out.write(POC_ST, "WebHMI_TLS_Probe.st")
        out.write(POC_VARS, "WebHMI_TLS_Probe_LocalVariables.tsv")
        out.writestr("README_HTTPS_POC.txt",
            "SOLO PRUEBA TLS FASE 0. NO ESTABLECE HTTPS NI SIRVE HMI.\n"
            "Importar WebHMI_TLS_Probe.st + WebHMI_TLS_Probe_LocalVariables.tsv\n"
            "como Program ST + Internals para pruebas aisladas.\n"
            "El proyecto editable y HTML original se conservan en el ZIP.\n"
            "NO importar el servidor HTTP de HTTP_REFERENCE_DO_NOT_IMPORT\n"
            "pretendiendo que sea HTTPS. No se modifica el proyecto original.\n")
    print("Paquete de laboratorio generado:", target)

def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("export_zip", type=Path, help="ZIP creado por HMI_NX_ST")
    p.add_argument("-o", "--output", type=Path, default=Path("WebHMI_HTTPS_Research_Export.zip"))
    args = p.parse_args()
    package(args.export_zip, args.output)

if __name__ == "__main__":
    main()
