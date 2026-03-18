"""
ECG Diagnostic System — Full Standalone Script
================================================
Usage:
    python ecg_diagnostic.py

Requirements:
    pip install numpy pandas scipy matplotlib tensorflow

Outputs:
    Four interactive plot windows shown one by one.
    Use the save icon (floppy disk) inside each window to save as PNG/PDF.
    Close each window to advance to the next.

    Page 1 — Signal Overview
    Page 2 — Prediction Timeline & Distribution
    Page 3 — Statistical Charts  (probability bar + confidence over time)
    Page 4 — Anomaly Log & Verdict
"""

import os
import sys
import numpy as np
import pandas as pd
import matplotlib
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.gridspec as gridspec
from matplotlib.lines import Line2D
from matplotlib.ticker import MaxNLocator
from scipy.signal import butter, filtfilt
import tensorflow as tf
import warnings
warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────
BASE_PATH     = "ecg_full_project"
SAMPLING_RATE = 360
WINDOW_SIZE   = SAMPLING_RATE * 10      # 3 600 samples = 10 seconds

CLASS_NAMES = [
    "Normal", "Supraventricular", "Ventricular",
    "Conduction", "MI", "Hypertrophy", "Ischemia", "AF"
]

CLASS_COLORS = {
    "Normal":           "#2ecc71",
    "Supraventricular": "#3498db",
    "Ventricular":      "#e74c3c",
    "Conduction":       "#f39c12",
    "MI":               "#e67e22",
    "Hypertrophy":      "#9b59b6",
    "Ischemia":         "#c0392b",
    "AF":               "#e91e8c",
}

STYLE = {
    "bg":      "#0d1117",
    "panel":   "#161b22",
    "border":  "#30363d",
    "text":    "#e6edf3",
    "subtext": "#8b949e",
    "accent":  "#58a6ff",
    "grid":    "#21262d",
    "signal":  "#58a6ff",
    "seg1":    "#3fb950",
    "seg2":    "#d29922",
}

# ─────────────────────────────────────────────
# STYLE HELPER
# ─────────────────────────────────────────────
def apply_dark_style():
    plt.rcParams.update({
        "figure.facecolor":  STYLE["bg"],
        "axes.facecolor":    STYLE["panel"],
        "axes.edgecolor":    STYLE["border"],
        "axes.labelcolor":   STYLE["text"],
        "axes.titlecolor":   STYLE["text"],
        "xtick.color":       STYLE["subtext"],
        "ytick.color":       STYLE["subtext"],
        "grid.color":        STYLE["grid"],
        "grid.linewidth":    0.5,
        "text.color":        STYLE["text"],
        "font.family":       "monospace",
        "font.size":         9,
        "axes.titlesize":    10,
        "axes.titleweight":  "bold",
        "figure.dpi":        150,
    })

# ─────────────────────────────────────────────
# MODEL LOADING
# ─────────────────────────────────────────────
def load_models():
    paths = {
        "resnet":      os.path.join(BASE_PATH, "resnet_v1.keras"),
        "inception":   os.path.join(BASE_PATH, "inception_v1.keras"),
        "transformer": os.path.join(BASE_PATH, "transformer_v1.keras"),
    }
    models = {}
    for name, path in paths.items():
        if not os.path.exists(path):
            print(f"[ERROR] Model not found: {path}")
            sys.exit(1)
        print(f"  Loading {name} ... ", end="", flush=True)
        models[name] = tf.keras.models.load_model(path)
        print("OK")
    return models

# ─────────────────────────────────────────────
# SIGNAL PROCESSING
# ─────────────────────────────────────────────
def bandpass_filter(signal, sr=SAMPLING_RATE, low=0.5, high=45.0, order=3):
    nyq = 0.5 * sr
    b, a = butter(order, [low / nyq, high / nyq], btype="bandpass")
    return filtfilt(b, a, signal)

def normalize(signal):
    return (signal - np.mean(signal)) / (np.std(signal) + 1e-8)

def preprocess(segment):
    return normalize(bandpass_filter(segment))

# ─────────────────────────────────────────────
# PREDICTION
# ─────────────────────────────────────────────
def predict_segment(segment, models):
    inp = preprocess(segment).reshape(1, WINDOW_SIZE, 1).astype(np.float32)
    p1  = models["resnet"].predict(inp, verbose=0)
    p2  = models["inception"].predict(inp, verbose=0)
    p3  = models["transformer"].predict(inp, verbose=0)
    return (0.4 * p1 + 0.3 * p2 + 0.3 * p3)[0]

# ─────────────────────────────────────────────
# DATA LOADING
# ─────────────────────────────────────────────
def load_signal(file_path):
    try:
        with open(file_path, "r", encoding="utf-8-sig") as f:
            raw = f.read()
        tokens = raw.replace(",", " ").replace("\t", " ").split()
        values = []
        for tok in tokens:
            try:
                values.append(float(tok))
            except ValueError:
                pass
        data = np.array(values, dtype=np.float64)
        data = data[np.isfinite(data)]
    except Exception as e:
        print(f"[ERROR] Could not read file: {e}")
        sys.exit(1)

    if len(data) == 0:
        print("[ERROR] No numeric values found in the file.")
        sys.exit(1)
    if len(data) < WINDOW_SIZE:
        print(f"[ERROR] Signal too short. Need >= {WINDOW_SIZE} samples. "
              f"Found {len(data)}.")
        sys.exit(1)

    print(f"  Loaded {len(data)} numeric samples from file.")
    return data

# ─────────────────────────────────────────────
# DOWNSAMPLE FOR PLOTTING
# ─────────────────────────────────────────────
def downsample(arr, n=2000):
    if len(arr) <= n:
        return np.array(arr), np.arange(len(arr))
    step = len(arr) / n
    idx  = (np.arange(n) * step).astype(int)
    return arr[idx], idx

# ─────────────────────────────────────────────
# SHARED HELPER — sorted probability arrays
# ─────────────────────────────────────────────
def sorted_class_probs(results):
    mean_probs = np.array([r["all_probs"] for r in results]).mean(axis=0)
    idx        = np.argsort(mean_probs)[::-1]
    names      = [CLASS_NAMES[i]       for i in idx]
    probs      = [float(mean_probs[i]) for i in idx]
    colors     = [CLASS_COLORS[n]      for n in names]
    return names, probs, colors


# ═══════════════════════════════════════════════════════════════
# PAGE 1 — SIGNAL OVERVIEW
# ═══════════════════════════════════════════════════════════════
def save_page1(data, num_segments):
    apply_dark_style()
    fig, axes = plt.subplots(3, 1, figsize=(16, 10), constrained_layout=True)
    fig.patch.set_facecolor(STYLE["bg"])

    total_sec = len(data) / SAMPLING_RATE
    time_full = np.linspace(0, total_sec, len(data))

    ax0      = axes[0]
    ds, ds_i = downsample(data, 3000)
    ax0.plot(time_full[ds_i], ds, color=STYLE["signal"], linewidth=0.6, alpha=0.9)
    ax0.set_title("Full ECG Recording", pad=6)
    ax0.set_xlabel("Time (s)")
    ax0.set_ylabel("Amplitude")
    ax0.grid(True, alpha=0.3)
    ax0.set_xlim(0, total_sec)
    ax0.text(0.99, 0.97,
             f"Duration: {total_sec:.1f}s  |  {num_segments} segments x 10s",
             transform=ax0.transAxes, ha="right", va="top",
             color=STYLE["subtext"], fontsize=8)

    seg_colors = [STYLE["seg1"], STYLE["seg2"]]
    chosen     = (np.random.choice(num_segments, size=2, replace=False)
                  if num_segments >= 2 else [0, 0])

    for plot_i, seg_idx in enumerate(chosen):
        ax    = axes[plot_i + 1]
        start = seg_idx * WINDOW_SIZE
        seg   = data[start : start + WINDOW_SIZE]
        t_seg = np.linspace(seg_idx * 10, (seg_idx + 1) * 10, len(seg))

        if num_segments == 1:
            half     = len(seg) // 2
            seg_show = seg[plot_i * half : (plot_i + 1) * half]
            t_show   = t_seg[plot_i * half : (plot_i + 1) * half]
            hs, he   = seg_idx * 10 + plot_i * 5, seg_idx * 10 + plot_i * 5 + 5
            label    = (f"10s Segment - first 5s  [{hs:.1f}s - {he:.1f}s]"
                        if plot_i == 0 else
                        f"10s Segment - last 5s   [{hs:.1f}s - {he:.1f}s]")
            ax.set_xlim(hs, he)
        else:
            seg_show = seg
            t_show   = t_seg
            label    = (f"Random 10s Segment #{plot_i+1}  "
                        f"[{seg_idx*10:.1f}s - {(seg_idx+1)*10:.1f}s]")
            ax.set_xlim(seg_idx * 10, (seg_idx + 1) * 10)

        ax.plot(t_show, seg_show, color=seg_colors[plot_i], linewidth=0.8)
        ax.set_title(label, pad=6)
        ax.set_xlabel("Time (s)")
        ax.set_ylabel("Amplitude")
        ax.grid(True, alpha=0.3)

        ax0.axvspan(seg_idx * 10, (seg_idx + 1) * 10,
                    alpha=0.18, color=seg_colors[plot_i],
                    label=f"Segment {plot_i + 1}")

    ax0.legend(loc="upper left", fontsize=8, framealpha=0.3)
    fig.suptitle("ECG DIAGNOSTIC SYSTEM  -  SIGNAL OVERVIEW",
                 fontsize=13, fontweight="bold", color=STYLE["accent"])
    fig.canvas.manager.set_window_title("Page 1 - Signal Overview")
    plt.show()


# ═══════════════════════════════════════════════════════════════
# PAGE 2 — PREDICTION TIMELINE + PIE
# ═══════════════════════════════════════════════════════════════
def save_page2(results):
    apply_dark_style()
    fig, (ax_tl, ax_pie) = plt.subplots(
        1, 2, figsize=(18, 8),
        gridspec_kw={"width_ratios": [2.5, 1]},
        constrained_layout=True,
    )
    fig.patch.set_facecolor(STYLE["bg"])

    for r in results:
        color = CLASS_COLORS[r["prediction"]]
        ax_tl.barh(y=0, width=10, left=r["start_t"], height=0.6,
                   color=color, alpha=0.85,
                   edgecolor=STYLE["bg"], linewidth=0.4)
        ax_tl.text(r["start_t"] + 5, 0,
                   f"{r['confidence']*100:.0f}%",
                   ha="center", va="center",
                   fontsize=6, color="white", fontweight="bold")

    ax_tl.set_yticks([])
    ax_tl.set_xlabel("Recording Time (seconds)")
    ax_tl.set_title("Prediction Timeline  -  each bar = 10s segment", pad=8)
    ax_tl.set_xlim(0, results[-1]["end_t"])
    ax_tl.set_ylim(-0.6, 0.6)

    seen = {}
    for r in results:
        if r["prediction"] not in seen:
            seen[r["prediction"]] = CLASS_COLORS[r["prediction"]]
    patches = [mpatches.Patch(color=c, label=l) for l, c in seen.items()]
    ax_tl.legend(handles=patches, loc="upper right",
                 ncol=2, fontsize=8, framealpha=0.3)

    for r in results:
        if r["prediction"] != "Normal":
            ax_tl.axvline(r["start_t"], color=CLASS_COLORS[r["prediction"]],
                          alpha=0.4, linewidth=0.8, linestyle="--")

    counts = {}
    for r in results:
        counts[r["prediction"]] = counts.get(r["prediction"], 0) + 1
    labels = list(counts.keys())
    vals   = list(counts.values())
    colors = [CLASS_COLORS[l] for l in labels]

    wedges, _, autotexts = ax_pie.pie(
        vals, labels=None, autopct="%1.1f%%", colors=colors,
        startangle=140,
        wedgeprops={"edgecolor": STYLE["bg"], "linewidth": 1.5},
        pctdistance=0.75,
    )
    for at in autotexts:
        at.set_fontsize(8)
        at.set_color("white")
        at.set_fontweight("bold")

    ax_pie.set_title("Overall Condition\nDistribution", pad=10)
    ax_pie.legend(
        wedges, [f"{l} ({v})" for l, v in zip(labels, vals)],
        loc="lower center", fontsize=8, framealpha=0.2, ncol=2,
    )

    fig.suptitle("ECG DIAGNOSTIC SYSTEM  -  PREDICTION TIMELINE & DISTRIBUTION",
                 fontsize=13, fontweight="bold", color=STYLE["accent"])
    fig.canvas.manager.set_window_title("Page 2 - Prediction Timeline & Distribution")
    plt.show()


# ═══════════════════════════════════════════════════════════════
# PAGE 3 — STATISTICAL CHARTS
#   Top  : Overall class probability (horizontal bar)
#   Bottom: Confidence over time (scatter + line)
# ═══════════════════════════════════════════════════════════════
def save_page3(results):
    apply_dark_style()

    fig, (ax_prob, ax_conf) = plt.subplots(
        2, 1, figsize=(16, 10),
        constrained_layout=True,
    )
    fig.patch.set_facecolor(STYLE["bg"])

    sorted_names, sorted_probs, sorted_colors = sorted_class_probs(results)

    # ── Probability bar chart ──────────────────────────────────
    bars = ax_prob.barh(
        sorted_names, sorted_probs,
        color=sorted_colors, alpha=0.85,
        edgecolor=STYLE["border"], linewidth=0.5,
    )
    for bar, prob in zip(bars, sorted_probs):
        ax_prob.text(
            prob + 0.008,
            bar.get_y() + bar.get_height() / 2,
            f"{prob*100:.1f}%",
            va="center", ha="left", fontsize=9, color=STYLE["text"],
        )

    ax_prob.set_xlim(0, 1.12)
    ax_prob.set_xlabel("Average Probability Across All Segments", labelpad=8)
    ax_prob.set_title("Overall Condition Probability  (Ensemble Average)", pad=10)
    ax_prob.grid(True, axis="x", alpha=0.3)
    ax_prob.invert_yaxis()
    # Highlight top-class y-tick label
    tick_labels = ax_prob.get_yticklabels()
    if tick_labels:
        tick_labels[0].set_color(CLASS_COLORS[sorted_names[0]])
        tick_labels[0].set_fontweight("bold")
    ax_prob.set_ylabel("")   # class names already serve as labels

    # ── Confidence over time ───────────────────────────────────
    times           = [r["start_t"]          for r in results]
    confs           = [r["confidence"] * 100 for r in results]
    seg_colors_list = [CLASS_COLORS[r["prediction"]] for r in results]

    ax_conf.plot(times, confs,
                 color=STYLE["subtext"], linewidth=0.9, alpha=0.5, zorder=1)
    ax_conf.scatter(times, confs,
                    c=seg_colors_list, s=60,
                    zorder=2, edgecolors=STYLE["bg"], linewidths=0.6)
    ax_conf.axhline(80, color=STYLE["accent"], linewidth=0.9,
                    linestyle="--", alpha=0.6)

    ax_conf.set_xlabel("Recording Time (s)", labelpad=8)
    ax_conf.set_ylabel("Confidence (%)", labelpad=8)
    ax_conf.set_title(
        "Segment Confidence Over Time  (dot color = predicted condition)", pad=10)
    ax_conf.set_ylim(0, 108)
    ax_conf.grid(True, alpha=0.3)

    seen2 = {}
    for r in results:
        if r["prediction"] not in seen2:
            seen2[r["prediction"]] = CLASS_COLORS[r["prediction"]]
    handles = [mpatches.Patch(color=c, label=l) for l, c in seen2.items()]
    handles.insert(0, Line2D([0], [0], color=STYLE["accent"],
                              linestyle="--", linewidth=0.9, label="80% threshold"))
    ax_conf.legend(handles=handles, loc="upper right",
                   fontsize=8, framealpha=0.25, ncol=2)

    fig.suptitle("ECG DIAGNOSTIC SYSTEM  -  STATISTICAL CHARTS",
                 fontsize=13, fontweight="bold", color=STYLE["accent"])
    fig.canvas.manager.set_window_title("Page 3 - Statistical Charts")
    plt.show()


# ═══════════════════════════════════════════════════════════════
# PAGE 4 — ANOMALY LOG TABLE + VERDICT BANNER
# ═══════════════════════════════════════════════════════════════
def save_page4(results):
    apply_dark_style()

    sorted_names, sorted_probs, _ = sorted_class_probs(results)
    top_cond   = sorted_names[0]
    top_prob   = sorted_probs[0]
    normal_n   = sum(1 for r in results if r["prediction"] == "Normal")
    abnormal_n = len(results) - normal_n
    normal_pct = normal_n / len(results) * 100

    col_labels = ["#", "Start (s)", "End (s)", "Prediction", "Confidence", "Status"]
    table_data = []
    for r in results:
        status = "Abnormal" if r["prediction"] != "Normal" else "Normal"
        table_data.append([
            f"#{r['seg'] + 1}",
            f"{r['start_t']:.1f}",
            f"{r['end_t']:.1f}",
            r["prediction"],
            f"{r['confidence']*100:.1f}%",
            status,
        ])

    n_show = min(len(table_data), 35)

    # ── Dynamic figure height ──────────────────────────────────
    row_h   = 0.30           # inches per data row
    hdr_h   = 0.42           # header row
    top_pad = 0.80           # suptitle area
    bot_pad = 1.00           # verdict banner + bottom margin
    fig_h   = max(7.0, top_pad + hdr_h + n_show * row_h + bot_pad)

    fig = plt.figure(figsize=(16, fig_h))
    fig.patch.set_facecolor(STYLE["bg"])

    verdict_frac = min(0.09, 0.9 / fig_h)
    gs = gridspec.GridSpec(
        2, 1, figure=fig,
        height_ratios=[1 - verdict_frac, verdict_frac],
        hspace=0.06,
        left=0.03, right=0.97,
        top=0.93,  bottom=0.03,
    )
    ax_tbl     = fig.add_subplot(gs[0])
    ax_verdict = fig.add_subplot(gs[1])

    # ── Table ─────────────────────────────────────────────────
    ax_tbl.axis("off")
    ax_tbl.set_facecolor(STYLE["bg"])

    # scale_y chosen so rows are comfortably readable at default window size
    scale_y = max(1.2, n_show * 0.058 + 0.18)

    tbl = ax_tbl.table(
        cellText=table_data[:n_show],
        colLabels=col_labels,
        loc="upper center",
        cellLoc="center",
    )
    tbl.auto_set_font_size(False)
    tbl.set_fontsize(9)
    tbl.scale(1.0, scale_y)

    # Column widths — give Prediction more room
    col_widths = [0.06, 0.10, 0.10, 0.22, 0.12, 0.14]
    for j, w in enumerate(col_widths):
        for i in range(n_show + 1):
            tbl[i, j].set_width(w)

    # Header row
    for j in range(len(col_labels)):
        cell = tbl[0, j]
        cell.set_facecolor("#1c2a3a")
        cell.set_text_props(color=STYLE["accent"], fontweight="bold")
        cell.set_edgecolor(STYLE["border"])

    # Data rows
    for i, r in enumerate(results[:n_show]):
        base_hex = CLASS_COLORS[r["prediction"]]
        row_bg   = base_hex + "28"   # ~16 % alpha hex
        is_abnormal = r["prediction"] != "Normal"
        for j in range(len(col_labels)):
            cell = tbl[i + 1, j]
            cell.set_facecolor(row_bg)
            cell.set_edgecolor(STYLE["border"])
            # Status column gets bold coloured text
            if j == 5:
                cell.set_text_props(
                    color="#e74c3c" if is_abnormal else "#2ecc71",
                    fontweight="bold",
                )
            else:
                cell.set_text_props(color=STYLE["text"])

    if len(table_data) > n_show:
        ax_tbl.text(0.5, 0.0,
                    f"  + {len(table_data) - n_show} more rows not shown  "
                    f"—  full log in ecg_results.csv  ",
                    transform=ax_tbl.transAxes, ha="center", va="bottom",
                    fontsize=8, color=STYLE["subtext"],
                    bbox=dict(boxstyle="round,pad=0.3",
                              facecolor=STYLE["panel"], alpha=0.7,
                              edgecolor=STYLE["border"]))

    # Table title (inside axes so it never clashes with suptitle)
    ax_tbl.set_title("Segment-by-Segment Anomaly Log",
                     loc="left", pad=10,
                     color=STYLE["text"], fontsize=11, fontweight="bold")

    # ── Verdict banner ─────────────────────────────────────────
    ax_verdict.axis("off")
    ax_verdict.set_facecolor(STYLE["bg"])

    verdict_text = (
        f"  OVERALL ASSESSMENT:  {top_cond.upper()}   |   "
        f"avg prob {top_prob*100:.1f}%   |   "
        f"Normal: {normal_pct:.0f}%  ({normal_n}/{len(results)})   |   "
        f"Abnormal: {100-normal_pct:.0f}%  ({abnormal_n}/{len(results)})  "
    )
    ax_verdict.text(
        0.5, 0.5, verdict_text,
        transform=ax_verdict.transAxes,
        ha="center", va="center",
        fontsize=10, fontweight="bold",
        color="#ffffff",
        bbox=dict(
            boxstyle="round,pad=0.6",
            facecolor=CLASS_COLORS[top_cond],
            alpha=0.92,
            edgecolor="none",
        ),
    )

    fig.suptitle("ECG DIAGNOSTIC SYSTEM  -  ANOMALY LOG & VERDICT",
                 fontsize=13, fontweight="bold", color=STYLE["accent"], y=0.975)
    fig.canvas.manager.set_window_title("Page 4 - Anomaly Log & Verdict")
    plt.show()


# ─────────────────────────────────────────────
# SAVE CSV
# ─────────────────────────────────────────────
def save_csv(results, out_dir):
    rows = []
    for r in results:
        row = {
            "segment":    r["seg"] + 1,
            "start_s":    round(r["start_t"], 2),
            "end_s":      round(r["end_t"], 2),
            "prediction": r["prediction"],
            "confidence": round(r["confidence"] * 100, 2),
        }
        for ci, cn in enumerate(CLASS_NAMES):
            row[f"prob_{cn}"] = round(float(r["all_probs"][ci]) * 100, 2)
        rows.append(row)
    df = pd.DataFrame(rows)
    out_path = os.path.join(out_dir, "ecg_results.csv")
    df.to_csv(out_path, index=False)
    print(f"  Saved: {out_path}")


# ─────────────────────────────────────────────
# TERMINAL SUMMARY
# ─────────────────────────────────────────────
def print_summary(results):
    print("\n" + "=" * 60)
    print("  DETAILED STATISTICAL OVERVIEW")
    print("=" * 60)

    all_probs = np.array([r["all_probs"] for r in results]).mean(axis=0)
    df_probs  = pd.DataFrame({
        "Condition":           CLASS_NAMES,
        "Avg Probability (%)": (all_probs * 100).round(1),
    }).sort_values("Avg Probability (%)", ascending=False)
    print(df_probs.to_string(index=False))

    print("\n" + "=" * 60)
    print("  SEGMENT LOG")
    print("=" * 60)
    for r in results:
        tag = "!" if r["prediction"] != "Normal" else " "
        print(f" {tag} [{r['start_t']:>7.1f}s - {r['end_t']:>7.1f}s]  "
              f"{r['prediction']:<20}  conf: {r['confidence']*100:>5.1f}%")

    normal_n = sum(1 for r in results if r["prediction"] == "Normal")
    print(f"\n  Total segments : {len(results)}")
    print(f"  Normal         : {normal_n}  ({normal_n/len(results)*100:.0f}%)")
    print(f"  Abnormal       : {len(results)-normal_n}  "
          f"({(len(results)-normal_n)/len(results)*100:.0f}%)")
    top_idx = int(np.argmax(all_probs))
    print(f"\n  >> Overall dominant condition: {CLASS_NAMES[top_idx].upper()} "
          f"({all_probs[top_idx]*100:.1f}%)")
    print("=" * 60 + "\n")


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════
def main():
    print("\n" + "=" * 60)
    print("  ECG DIAGNOSTIC SYSTEM")
    print("=" * 60)

    while True:
        file_path = (
            input("\n  Enter path to your ECG file (.csv or .txt):\n  > ")
            .strip().strip('"').strip("'")
        )
        if not file_path:
            print("  [!] No path entered. Please try again.")
            continue
        ext = os.path.splitext(file_path)[1].lower()
        if ext not in (".csv", ".txt"):
            print(f"  [!] Unsupported file type '{ext}'. Only .csv and .txt accepted.")
            continue
        if not os.path.exists(file_path):
            print(f"  [!] File not found: {file_path}")
            continue
        break

    print(f"\n  File : {file_path}\n")

    # Step 1 — Load signal
    print("Step 1/4  Loading signal ...")
    data         = load_signal(file_path)
    total_sec    = len(data) / SAMPLING_RATE
    num_segments = len(data) // WINDOW_SIZE
    used_samples = num_segments * WINDOW_SIZE

    print(f"  Total samples  : {len(data)}")
    print(f"  Total duration : {total_sec:.2f}s")
    print(f"  Usable         : {used_samples} samples  ({num_segments} x 10s segments)")
    tail = len(data) - used_samples
    if tail > 0:
        print(f"  Tail discarded : {tail} samples ({tail/SAMPLING_RATE:.2f}s)")

    data = data[:used_samples]

    # Step 2 — Load models
    print("\nStep 2/4  Loading models ...")
    models = load_models()

    # Step 3 — Predict
    print(f"\nStep 3/4  Predicting {num_segments} segments ...")
    results = []
    for i in range(num_segments):
        start    = i * WINDOW_SIZE
        segment  = data[start : start + WINDOW_SIZE]
        probs    = predict_segment(segment, models)
        pred_idx = int(np.argmax(probs))
        results.append({
            "seg":        i,
            "start_t":    i * 10.0,
            "end_t":      (i + 1) * 10.0,
            "prediction": CLASS_NAMES[pred_idx],
            "predIdx":    pred_idx,
            "confidence": float(probs[pred_idx]),
            "all_probs":  probs,
        })
        done = i + 1
        bar  = "#" * (done * 40 // num_segments)
        sys.stdout.write(f"\r  [{bar:<40}] {done}/{num_segments}")
        sys.stdout.flush()
    print()

    # Step 4 — Display (4 pages)
    print("\nStep 4/4  Displaying plots  (4 windows) ...")
    print("  Tip: floppy-disk icon in each window saves PNG/PDF.")
    print("  Close each window to advance.\n")

    save_page1(data, num_segments)   # Signal overview
    save_page2(results)              # Timeline + pie
    save_page3(results)              # Probability bar + confidence chart
    save_page4(results)              # Anomaly log table + verdict

    print_summary(results)
    print("Done.\n")


if __name__ == "__main__":
    main()