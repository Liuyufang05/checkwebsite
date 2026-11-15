"""Print Markdown tables of the latest results (used to fill README.md).

Usage: python ml/report_table.py > results.md
"""

from __future__ import annotations

import json

from config import REPORTS_DIR

ORDER = ("url", "content", "uci")
NAMES = {"url": "Live URL model", "content": "Live page-content model", "uci": "UCI benchmark (comparison only)"}


def fmt(v, d=4):
    return "n/a" if v is None else f"{v:.{d}f}"


def main() -> None:
    res = json.loads((REPORTS_DIR / "results.json").read_text())
    print(f"Model version `{res['model_version']}`\n")
    for key in ORDER:
        fs = res["feature_sets"].get(key)
        if not fs:
            continue
        print(f"#### {NAMES[key]} - {fs['n_train']:,} train / {fs['n_test']:,} test rows, {len(fs['features'])} features, {fs['split']} split\n")
        print("| Model | CV F1 (5-fold) | Accuracy | Precision | Recall | F1 | ROC-AUC | PR-AUC | Train (s) | Inference / 1k rows |")
        print("|---|---|---|---|---|---|---|---|---|---|")
        for m in sorted(fs["models"], key=lambda m: -m["test"]["f1"]):
            t = m["test"]
            name = f"**{m['name']}** (deployed)" if m["name"] == fs["best"] else m["name"]
            inf = m["inference_ms_per_1k"]
            inf_s = f"{inf:.2f} ms" if inf >= 1 else f"{inf * 1000:.0f} µs"
            print(f"| {name} | {fmt(m['cv']['f1']['mean'])} ± {fmt(m['cv']['f1']['std'], 3)} | {fmt(t['accuracy'])} | {fmt(t['precision'])} | "
                  f"{fmt(t['recall'])} | {fmt(t['f1'])} | {fmt(t['roc_auc'])} | {fmt(t['pr_auc'])} | {m['train_time_s']:.1f} | {inf_s} |")
        print()


if __name__ == "__main__":
    main()
