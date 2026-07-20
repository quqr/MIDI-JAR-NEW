import csv, re, sys

SRC = r"F:\Codes\MIDI-JAR-NEW\硬编码全面扫描分析报告.md"
OUT = r"F:\Codes\MIDI-JAR-NEW\硬编码全面扫描分析报告.csv"

HEADER_FIELDS = ["文件路径", "代码片段", "硬编码内容", "使用场景", "潜在问题", "优化建议"]
OUT_COLS = ["大类", "子类", "文件路径", "代码片段", "硬编码内容", "使用场景", "潜在问题", "优化建议"]

def split_row(line):
    # line starts and ends with '|'
    parts = line.split("|")
    # parts[0] == '' (before leading |), parts[-1] == '' (after trailing |)
    if len(parts) >= 3 and parts[0].strip() == "" and parts[-1].strip() == "":
        return [p.strip() for p in parts[1:-1]]
    # fallback
    return [p.strip() for p in line.strip().strip("|").split("|")]

def is_separator(fields):
    return all(re.fullmatch(r"-+", f) for f in fields) and len(fields) > 0

rows_out = []
cur_section = ""   # ## level
cur_sub = ""       # ### level
skipped_bullets = 0

with open(SRC, encoding="utf-8") as f:
    lines = f.readlines()

for raw in lines:
    line = raw.rstrip("\n")
    stripped = line.strip()
    if stripped.startswith("## "):
        cur_section = stripped[3:].strip()
        cur_sub = ""
        continue
    if stripped.startswith("### "):
        cur_sub = stripped[4:].strip()
        continue
    if not stripped.startswith("|"):
        continue
    fields = split_row(line)
    if not fields:
        continue
    # skip header row
    if fields[0] == "文件路径":
        continue
    if is_separator(fields):
        continue
    # must have expected column count (allow exactly 6)
    if len(fields) != 6:
        # try to keep but pad/truncate
        if len(fields) < 6:
            fields = fields + [""] * (6 - len(fields))
        else:
            fields = fields[:6]
    rows_out.append([cur_section, cur_sub] + fields)

with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(OUT_COLS)
    w.writerows(rows_out)

print(f"总行数: {len(rows_out)}")
print(f"输出文件: {OUT}")
