"""Extrai linhas de tabelas DOCX → JSON no stdout (usado pelo parser Node)."""
import json
import sys
import zipfile
from xml.etree import ElementTree as ET

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def cell_text(tc):
    parts = []
    for t in tc.findall(".//w:t", NS):
        if t.text:
            parts.append(t.text)
    return "".join(parts).strip()


def main():
    path = sys.argv[1]
    rows_out = []
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    line_no = 0
    for tbl in root.findall(".//w:tbl", NS):
        for tr in tbl.findall(".//w:tr", NS):
            line_no += 1
            cols = [cell_text(tc) for tc in tr.findall("w:tc", NS)]
            if not any(cols):
                continue
            rows_out.append({"lineNo": line_no, "cols": cols})
    print(json.dumps(rows_out, ensure_ascii=False))


if __name__ == "__main__":
    main()
