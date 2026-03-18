# ================================================================
#  ecg_engine.py
#  Place this file in your backend/ folder (same folder as app.py)
#
#  This is the ML core extracted from your friend's predict_master.py.
#  Nothing about the model logic is changed — we just made it
#  importable so FastAPI can call it.
# ================================================================

import os
import numpy as np
from scipy.signal import butter, filtfilt
import tensorflow as tf
import warnings
warnings.filterwarnings("ignore")

# ── Same constants as predict_master.py ──────────────────────
SAMPLING_RATE = 360
WINDOW_SIZE   = SAMPLING_RATE * 10   # 3600 samples = 10 seconds

CLASS_NAMES = [
    "Normal", "Supraventricular", "Ventricular",
    "Conduction", "MI", "Hypertrophy", "Ischemia", "AF"
]

# Colours match the frontend CONDITION_COLORS in ecg_monitor.js
CLASS_COLORS = {
    "Normal":           "#1D9E75",
    "Supraventricular": "#378ADD",
    "Ventricular":      "#D85A30",
    "Conduction":       "#EF9F27",
    "MI":               "#dc2626",
    "Hypertrophy":      "#64748b",
    "Ischemia":         "#9333ea",
    "AF":               "#D4537E",
}

# How each condition maps to a frontend severity badge
SEVERITY_MAP = {
    "Normal":           "Normal",
    "Supraventricular": "Warning",
    "Ventricular":      "Critical",
    "Conduction":       "Warning",
    "MI":               "Critical",
    "Hypertrophy":      "Warning",
    "Ischemia":         "Warning",
    "AF":               "Critical",
}

# Path to the ecg_full_project/ folder
# Assumes project layout:
#   backend/
#     app.py
#     ecg_engine.py   ← this file
#   ecg_full_project/
#     resnet_v1.keras
#     inception_v1.keras
#     transformer_v1.keras
BASE_PATH = os.path.join(os.path.dirname(__file__), "..", "ecg_full_project")

_models = None  # module-level cache — loaded once on first call


# ── Model loader ──────────────────────────────────────────────
def load_models():
    """
    Load all three .keras models and cache them.
    Raises FileNotFoundError if any model file is missing.
    """
    global _models
    if _models is not None:
        return _models   # already loaded

    model_files = {
        "resnet":      "resnet_v1.keras",
        "inception":   "inception_v1.keras",
        "transformer": "transformer_v1.keras",
    }

    _models = {}
    for name, filename in model_files.items():
        path = os.path.join(BASE_PATH, filename)
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Model file not found: {path}\n"
                f"Make sure ecg_full_project/ is next to your backend/ folder."
            )
        print(f"  Loading {name} from {path} ...", flush=True)
        _models[name] = tf.keras.models.load_model(path)
        print(f"  ✅ {name} loaded")

    return _models


# ── Signal processing (copied verbatim from predict_master.py) ─
def bandpass_filter(signal, sr=SAMPLING_RATE, low=0.5, high=45.0, order=3):
    nyq  = 0.5 * sr
    b, a = butter(order, [low / nyq, high / nyq], btype="bandpass")
    return filtfilt(b, a, signal)


def normalize(signal):
    return (signal - np.mean(signal)) / (np.std(signal) + 1e-8)


def preprocess(segment):
    """Bandpass filter + z-score normalise — identical to predict_master.py."""
    return normalize(bandpass_filter(segment))


# ── Per-segment prediction (ensemble) ─────────────────────────
def predict_segment(segment, models):
    """
    Runs the 3-model ensemble on one 10-second segment.
    Weights: ResNet 40%, Inception 30%, Transformer 30%
    — same as predict_master.py.
    """
    inp = preprocess(segment).reshape(1, WINDOW_SIZE, 1).astype(np.float32)
    p1  = models["resnet"].predict(inp,      verbose=0)
    p2  = models["inception"].predict(inp,   verbose=0)
    p3  = models["transformer"].predict(inp, verbose=0)
    return (0.4 * p1 + 0.3 * p2 + 0.3 * p3)[0]   # shape: (8,)


# ── Full recording analysis ───────────────────────────────────
def run_full_analysis(samples_float, sample_rate=SAMPLING_RATE,
                      segment_duration=10):
    """
    Main entry point called by FastAPI.

    Parameters
    ----------
    samples_float     : list[float]  — normalised signal (-1..+1) from browser
    sample_rate       : int          — samples per second (default 360)
    segment_duration  : int          — seconds per window (default 10)

    Returns
    -------
    list[dict]  — one dict per segment, ready to JSON-serialize

    Each dict has:
      segment, start_s, end_s, condition, confidence (0-100),
      status ("Normal"|"Abnormal"), color, all_probs (dict class→pct)
    """
    models   = load_models()
    data     = np.array(samples_float, dtype=np.float64)
    seg_size = sample_rate * segment_duration
    results  = []

    n_segs = len(data) // seg_size
    for i in range(n_segs):
        chunk    = data[i * seg_size : (i + 1) * seg_size]
        probs    = predict_segment(chunk, models)   # shape (8,)
        pred_idx = int(np.argmax(probs))
        cond     = CLASS_NAMES[pred_idx]
        conf     = float(probs[pred_idx])

        results.append({
            "segment":    i + 1,
            "start_s":    round(i * segment_duration, 1),
            "end_s":      round((i + 1) * segment_duration, 1),
            "condition":  cond,
            "confidence": round(conf * 100, 1),
            "status":     "Normal" if cond == "Normal" else "Abnormal",
            "color":      CLASS_COLORS[cond],
            # all_probs lets the frontend draw the ensemble probability bar chart
            "all_probs":  {
                CLASS_NAMES[j]: round(float(probs[j]) * 100, 1)
                for j in range(len(CLASS_NAMES))
            },
        })

        print(f"  Segment {i+1}/{n_segs}: {cond} ({conf*100:.1f}%)", flush=True)

    return results
