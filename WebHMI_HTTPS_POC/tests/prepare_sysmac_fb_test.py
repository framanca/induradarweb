#!/usr/bin/env python3
from __future__ import annotations
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("prepare_sysmac_fb", ROOT / "tools" / "prepare_sysmac_fb.py")
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)

class PrepareSysmacFBTest(unittest.TestCase):
    def test_six_function_blocks_split_correctly(self):
        expected = {"FB_WebSHA256", "FB_WebAES128", "FB_WebHMACSHA256",
                    "FB_WebTLS12PRF", "FB_WebAESGCM", "FB_WebTLS12Record"}
        self.assertEqual({Path(p).stem for p in module.SOURCES}, expected)
        for filename in module.SOURCES:
            name, declarations, body = module.split(
                (ROOT/"crypto"/filename).read_text(encoding="utf-8"))
            self.assertIn(name,expected)
            self.assertNotIn("FUNCTION_BLOCK ",body)
            self.assertNotIn("END_FUNCTION_BLOCK",body)
            self.assertIn("CASE State OF",body)
            self.assertTrue(declarations["VAR_INPUT"])
            self.assertTrue(declarations["VAR_OUTPUT"])
            self.assertTrue(declarations["VAR"])
            symbols = [v[0] for group in declarations.values() for v in group]
            self.assertEqual(len(symbols),len(set(symbols)))
    def test_output_folders_and_variable_tables(self):
        with tempfile.TemporaryDirectory() as folder:
            module.run(Path(folder))
            for filename in module.SOURCES:
                fb=Path(folder)/Path(filename).stem
                self.assertTrue((fb/"Body.st").is_file())
                for group in ("Inputs.tsv","Outputs.tsv","Internals.tsv"):
                    table=(fb/group).read_text(encoding="utf-8")
                    self.assertTrue(table.strip(),(fb/group))
                    self.assertTrue(all(len(line.split("\t"))==7
                        for line in table.splitlines() if line))
            self.assertIn("DO NOT implement", (Path(folder)/"README.txt").read_text())

if __name__ == "__main__":
    unittest.main()
