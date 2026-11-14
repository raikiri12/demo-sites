import json
import glob
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESEARCH_DIR = ROOT / "data" / "research"

def is_empty(value):
    if value is None:
        return True
    if isinstance(value, (list, dict, str)):
        return len(value) == 0
    return False

def recalc_missing(data):
    missing = []
    tracked = ["email", "services", "prices", "payment", "amenities", "review_points", "complaints", "review_summary"]
    for field in tracked:
        if field not in data or is_empty(data.get(field)):
            missing.append(field)
    if data.get("photos_count", 0) == 0:
        missing.append("photos")
    return sorted(set(missing))

def main():
    files = sorted(RESEARCH_DIR.glob("*.json"))
    rows = []
    issues = []
    for path in files:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        slug = path.stem
        if "reviews_raw" in data:
            issues.append(f"{slug}: reviews_raw still present")
        data["missing"] = recalc_missing(data)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
            f.write("\n")
        rp_count = len(data.get("review_points", []))
        has_complaints = "да" if len(data.get("complaints", [])) > 0 else "нет"
        rows.append((slug, rp_count, has_complaints))
    
    print("| slug | review_points | complaints |")
    print("|---|---|---|")
    for slug, rp_count, has_complaints in rows:
        print(f"| {slug} | {rp_count} | {has_complaints} |")
    
    if issues:
        print("\nISSUES:")
        for issue in issues:
            print(issue)
    else:
        print("\nAll files processed: no reviews_raw left.")

if __name__ == "__main__":
    main()
