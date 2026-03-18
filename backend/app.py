import pickle
import numpy as np
import pandas as pd
import mysql.connector
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, field_validator, model_validator, root_validator
from typing import Optional, List, Dict
from datetime import datetime
from pathlib import Path
import logging
import json
import serial
import serial.tools.list_ports
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
import asyncio
 

# Logging Configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Health Prediction System API - V4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------
# 1. Pydantic Models
# ------------------------------
class ContactMessage(BaseModel):
    full_name: str
    medical_id: Optional[str] = None
    email: Optional[EmailStr] = None 
    phone: Optional[str] = None
    subject: Optional[str] = None
    message: Optional[str] = None

    @model_validator(mode='after')
    def validate_communication_method(self) -> 'ContactMessage':
        if not self.email and not self.phone:
            raise ValueError('Institutional records require either an Email or Phone Number for communication.')
        return self

class UserSignup(BaseModel):
    user_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    password: str
    dept: Optional[str] = None
    blood_group: Optional[str] = None

    @root_validator(pre=True)
    def check_contact_info(cls, values):
        email = values.get('email')
        phone = values.get('phone')
        if not email and not phone:
            raise ValueError('Either email or phone must be provided')
        return values

class HealthInput(BaseModel):
    user_id: str
    temperature: float
    heart_rate: float
    bp_dia: float
    bp_sys: float
    humidity: float
    fever: int
    cough: int
    chest_pain: int
    shortness_breath: int
    fatigue: int
    headache: int

# ------------------------------
# 2. Model & Components Loading
# ------------------------------
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR.parent / "model" / "model_saved.pkl"

try:
    with open(MODEL_PATH, "rb") as f:
        package = pickle.load(f)
    model = package["model"]
    scaler = package["scaler"]
    label_encoder = package["label_encoder"]
    feature_names = package["feature_names"]
    numerical_cols = package["numerical_cols"]
    MODEL_LOADED = True
    logger.info("✅ Model Components Loaded Successfully")
except Exception as e:
    MODEL_LOADED = False
    logger.error(f"❌ Failed to load model: {e}")

# ------------------------------
# 3. Database Connection
# ------------------------------
def get_db():
    return mysql.connector.connect(
        host="localhost",
        user="root",
        password="mop1117668",
        database="healthbridge_db"
    )

# ------------------------------
# 4. Clinical Advice Logic (No Changes)
# ------------------------------
def get_clinical_advice(disease, score):
    advice = {"drugs": "Consult Doctor", "foods": "Balanced Diet", "routine": "Rest"}
    
    if disease == "Heart_Risk":
        if 60 <= score < 80:
            advice = {
                "drugs": "Aspirin (75mg) - 1 tab after lunch; Atorvastatin (10mg) - 1 tab at night",
                "foods": "Walnuts, Oats, Garlic, and Low-sodium meals",
                "routine": "Avoid heavy lifting, 15 min slow walk"
            }
        elif score >= 80:
            advice = {
                "drugs": "Nitroglycerin (emergency); Clopidogrel (75mg) - 1 tab daily",
                "foods": "Strict heart-healthy diet, Fatty fish, Zero added salt",
                "routine": "Immediate cardiology consultation. Complete bed rest"
            }
    elif disease == "Fever_Respiratory":
        if score < 80:
            advice = {
                "drugs": "Paracetamol (500mg) - 1 tab after meals (max 3/day)",
                "foods": "Warm soup, Citrus fruits, Ginger tea",
                "routine": "Steam inhalation twice daily"
            }
        else:
            advice = {
                "drugs": "Paracetamol (650mg) - every 6h; Azithromycin (500mg) - 1 tab daily (3 days)",
                "foods": "High-protein soft diet, ORS, Honey-lemon water",
                "routine": "Strict isolation. Monitor SpO2 levels"
            }
    elif disease == "Hypertension":
        if 60 <= score < 80:
            advice = {
                "drugs": "Amlodipine (5mg) - 1 tab morning before breakfast",
                "foods": "Bananas, Spinach, Skim milk. Avoid raw salt",
                "routine": "30 mins brisk walking. No nicotine"
            }
        else:
            advice = {
                "drugs": "Losartan (50mg) - 1 tab daily; Hydrochlorothiazide (12.5mg) morning",
                "foods": "Beetroot juice, Pomegranate. Zero added salt",
                "routine": "Stress management (Yoga). Regular BP monitoring"
            }
    elif disease == "Hypotension":
        advice = {
            "drugs": "ORS (1L throughout day); Vitamin B12 supplements",
            "foods": "Cheese, Olives, Salty snacks (moderate), and Coffee",
            "routine": "Elevate legs while resting. Avoid sudden movements"
        }
    return advice

# ------------------------------
# 5. API Endpoints
# ------------------------------

@app.post("/api/signup")
async def signup(user: UserSignup):
    db = get_db()
    cursor = db.cursor()
    try:
        sql = """INSERT INTO users 
         (id_str, name, email, phone, role, password_hash, dept, blood_group) 
         VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
        
        cursor.execute(sql, (
            user.user_id,
            user.name, 
            user.email,       
            user.phone,       
            user.role, 
            user.password,
            user.dept, 
            user.blood_group
        ))
        
        db.commit()
        return {"status": "success", "message": "Institutional account created successfully"}
    except Exception as e:
        db.rollback()
        if "Duplicate entry" in str(e):
            raise HTTPException(status_code=400, detail="Institutional ID already registered.")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()

@app.post("/api/login")
async def login(data: dict):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        sql = "SELECT * FROM users WHERE id_str=%s AND password_hash=%s"
        cursor.execute(sql, (data['user_id'], data['password']))
        user = cursor.fetchone()
        
        if user:
            return {
                "user_id": user['id_str'],
                "name": user['name'],
                "role": user['role']
            }
        
        raise HTTPException(status_code=401, detail="Invalid Institutional Credentials")
    finally:
        cursor.close()
        db.close()
        
@app.post("/api/predict")
async def predict(input_data: HealthInput):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        # ML Prediction Logic
        raw_features = [
            input_data.temperature, input_data.heart_rate, input_data.bp_sys, 
            input_data.bp_dia, input_data.humidity, input_data.fever, 
            input_data.cough, input_data.chest_pain, input_data.shortness_breath, 
            input_data.fatigue, input_data.headache
        ]
        
        df = pd.DataFrame([raw_features], columns=feature_names)
        df[numerical_cols] = scaler.transform(df[numerical_cols])
        proba = model.predict(df.values, verbose=0)
        disease = label_encoder.inverse_transform([np.argmax(proba)])[0]
        score = round(float(np.max(proba)) * 100, 2)
        advice = get_clinical_advice(disease, score)

        cursor.execute("SELECT id FROM users WHERE id_str = %s", (input_data.user_id,))
        u_record = cursor.fetchone()
        
        if u_record:
            sql = """INSERT INTO predictions (user_id, service_type, result_status, analysis_score, 
                     temperature, heart_rate, bp_sys, bp_dia, humidity, fever, cough, chest_pain, 
                     shortness_breath, fatigue, headache, suggested_drugs, suggested_foods, clinical_routine) 
                     VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
            
            cursor.execute(sql, (
                u_record['id'], "AI Checkup", disease, score, 
                input_data.temperature, input_data.heart_rate, input_data.bp_sys, input_data.bp_dia,
                input_data.humidity, input_data.fever, input_data.cough, input_data.chest_pain, 
                input_data.shortness_breath, input_data.fatigue, input_data.headache,
                advice['drugs'], advice['foods'], advice['routine']
            ))
            db.commit()

        return {"prediction": disease, "score": score, **advice}
    finally:
        cursor.close()
        db.close()

@app.get("/api/search-patient")
async def search_patient(q: str = ""):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    if q:
        cursor.execute("SELECT id_str, name, role FROM users WHERE (name LIKE %s OR id_str LIKE %s) AND role='patient'", (f"%{q}%", f"%{q}%"))
    else:
        cursor.execute("SELECT id_str, name, role FROM users WHERE role='patient'")
    return cursor.fetchall()

@app.get("/api/reports/{user_id}")
async def get_reports(user_id: str):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("""
        SELECT p.* FROM predictions p 
        JOIN users u ON p.user_id = u.id 
        WHERE u.id_str = %s 
        ORDER BY p.created_at DESC
    """, (user_id,))
    return cursor.fetchall()

@app.delete("/api/delete-patient/{patient_id}")
async def delete_patient(patient_id: str):
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM predictions WHERE user_id = (SELECT id FROM users WHERE id_str = %s)", (patient_id,))
        cursor.execute("DELETE FROM doctor_feedback WHERE patient_id_str = %s", (patient_id,))
        cursor.execute("DELETE FROM users WHERE id_str = %s", (patient_id,))
        db.commit()
        return {"status": "success", "message": "Patient records fully removed"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
     
@app.post("/api/send-feedback")
async def send_feedback(data: dict):
    db = get_db()
    cursor = db.cursor()
    try:
        sql = "INSERT INTO doctor_feedback (doctor_id_str, patient_id_str, message) VALUES (%s, %s, %s)"
        cursor.execute(sql, (data['doctor_id'], data['patient_id'], data['message']))
        db.commit()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Feedback Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.get("/api/get-feedback/{patient_id}")
async def get_feedback(patient_id: str):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT message, prescribed_at as created_at 
            FROM doctor_feedback 
            WHERE patient_id_str = %s 
            ORDER BY prescribed_at DESC LIMIT 1
        """, (patient_id,))
        result = cursor.fetchone()
        return result or {"message": "No clinical instructions deployed yet."}
    finally:
        cursor.close()
        db.close()
   
@app.post("/api/contact")
async def save_contact_message(contact: ContactMessage):
    db = get_db()
    cursor = db.cursor()
    try:
        sql = """INSERT INTO contact_messages 
                 (full_name, medical_id, email, phone, subject, message) 
                 VALUES (%s, %s, %s, %s, %s, %s)"""
        
        cursor.execute(sql, (contact.full_name, contact.medical_id, contact.email, contact.phone, contact.subject, contact.message))
        db.commit()
        return {"status": "success", "message": "Inquiry transmitted successfully."}
    except Exception as e:
        db.rollback()
        logger.error(f"Contact Submission Error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error. Transmission failed.")
    finally:
        cursor.close()
        db.close()

@app.get("/api/doctor-stats")
async def get_doctor_stats():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        # ১. মোট নিবন্ধিত পেশেন্ট (role='patient')
        cursor.execute("SELECT COUNT(*) as total_patients FROM users WHERE role = 'patient'")
        total_patients = cursor.fetchone()['total_patients']

        # ২. মোট চেকআপ সংখ্যা
        cursor.execute("SELECT COUNT(*) as total_checks FROM predictions")
        total_checks = cursor.fetchone()['total_checks']

        # ৩. কতজন পেশেন্টকে অন্তত একবার মেসেজ দেওয়া হয়েছে
        cursor.execute("SELECT COUNT(DISTINCT patient_id_str) as responded FROM doctor_feedback")
        responded = cursor.fetchone()['responded']

        # ৪. যারা কোনো মেসেজ পাননি = total_patients - responded
        pending = total_patients - responded

        return {
            "total_patients": total_patients,
            "total_checks": total_checks,
            "responded": responded,
            "pending": pending
        }
    finally:
        cursor.close()
        db.close()

@app.get("/api/doctor-patient-list")
async def get_doctor_patient_list():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id_str, name FROM users WHERE role = 'patient'")
        patients = cursor.fetchall()

        result = []
        for p in patients:
            # FIXED: prefix columns with p. to avoid ambiguous 'created_at'
            cursor.execute("""
                SELECT p.result_status, p.analysis_score, p.created_at
                FROM predictions p
                JOIN users u ON p.user_id = u.id
                WHERE u.id_str = %s
                ORDER BY p.created_at DESC
                LIMIT 1
            """, (p['id_str'],))
            latest = cursor.fetchone()
            if latest:
                result.append({
                    "id_str": p['id_str'],
                    "name": p['name'],
                    "latest_disease": latest['result_status'],
                    "latest_risk": latest['analysis_score'],
                    "latest_date": latest['created_at'].isoformat() if latest['created_at'] else None
                })
            else:
                result.append({
                    "id_str": p['id_str'],
                    "name": p['name'],
                    "latest_disease": "No checkup yet",
                    "latest_risk": None,
                    "latest_date": None
                })
        return result
    finally:
        cursor.close()
        db.close()
        
@app.get("/api/patient-stats/{user_id}")
async def get_patient_stats(user_id: str):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        sql = """
            SELECT result_status as disease, COUNT(*) as count 
            FROM predictions p 
            JOIN users u ON p.user_id = u.id 
            WHERE u.id_str = %s 
            GROUP BY result_status 
            ORDER BY count DESC
        """
        cursor.execute(sql, (user_id,))
        stats = cursor.fetchall()
        
        cursor.execute("SELECT COUNT(*) as total FROM predictions p JOIN users u ON p.user_id = u.id WHERE u.id_str = %s", (user_id,))
        total = cursor.fetchone()['total']
        
        return {"total_visits": total, "disease_distribution": stats}
    finally:
        cursor.close()
        db.close()

# ============================================================
#  ECG ROUTES — paste these into your app.py
#  Place BEFORE the `if __name__ == "__main__":` block
# ============================================================


# ── Pydantic model for ECG analysis save ─────────────────────
class EcgSession(BaseModel):
    user_id: str
    overall_status: str          # 'Normal' | 'Warning' | 'Critical'
    primary_condition: str       # e.g. 'Supraventricular'
    avg_confidence: float
    normal_pct: float
    abnormal_pct: float
    total_segments: int
    normal_segments: int
    abnormal_segments: int
    signal_quality: str
    model_version: str
    duration_seconds: float
    segment_predictions: str     # JSON string — list of segment dicts
    anomaly_summary: str         # JSON string — list of anomaly dicts

# -- Import our new engine module --
# Make sure ecg_engine.py is in the same folder as app.py
try:
    from ecg_engine import (
        run_full_analysis,
        load_models,
        CLASS_NAMES,
        CLASS_COLORS,
        SEVERITY_MAP,
        SAMPLING_RATE as ECG_SR,
    )
    # Pre-load models when the server starts so the first request is fast
    load_models()
    ECG_ML_AVAILABLE = True
    print("✅ ECG ML engine ready")
except Exception as _ecg_err:
    ECG_ML_AVAILABLE = False
    print(f"⚠️  ECG ML engine not loaded ({_ecg_err}). Falling back to mock.")
 

# ── 1. List serial ports ──────────────────────────────────────
@app.get("/api/ecg/ports")
async def list_serial_ports():
    """Returns available COM/serial ports for the frontend dropdown."""
    ports = serial.tools.list_ports.comports()
    return [{"port": p.device, "description": p.description} for p in ports]
 

# ── 2. WebSocket — live ECG stream from Arduino ───────────────
# The frontend connects to ws://127.0.0.1:8000/ws/ecg/{port_name}
# e.g. ws://127.0.0.1:8000/ws/ecg/COM3   or   /ws/ecg/ttyUSB0
#
# The Arduino sketch should Serial.println() one integer ADC value
# per line at 9600 baud, 360 samples/sec recommended.
#
# This endpoint reads those values and forwards them as JSON to
# every browser tab that is connected to the same WebSocket.

# active_ecg_connections: list[WebSocket] = []

# ── 2. WebSocket — live ECG stream from Arduino ───────────────
@app.websocket("/ws/ecg/{port_name}")
async def ecg_websocket(websocket: WebSocket, port_name: str):
    """
    Opens the Arduino serial port server-side and streams raw ADC
    values to the browser as JSON: {"t": <ms>, "v": <adc_int>}
 
    Arduino sketch (paste into Arduino IDE):
    ─────────────────────────────────────────
    void setup() { Serial.begin(9600); }
    void loop()  {
      int val = analogRead(A0);   // AD8232 output pin → A0
      Serial.println(val);
      delayMicroseconds(2778);    // ≈ 360 Hz
    }
    ─────────────────────────────────────────
    """
    await websocket.accept()
    actual_port = port_name.replace("__", "/")  # frontend encodes / as __
    ser = None
    t0  = __import__("time").time()
 
    try:
        ser = serial.Serial(actual_port, baudrate=9600, timeout=1)
        while True:
            raw = await asyncio.get_event_loop().run_in_executor(None, ser.readline)
            if raw:
                try:
                    val = int(raw.decode("utf-8").strip())
                    elapsed_ms = round((__import__("time").time() - t0) * 1000)
                    await websocket.send_text(json.dumps({"t": elapsed_ms, "v": val}))
                except (ValueError, UnicodeDecodeError):
                    pass
    except WebSocketDisconnect:
        pass
    except serial.SerialException as e:
        try:
            await websocket.send_text(json.dumps({"error": str(e)}))
        except Exception:
            pass
    finally:
        if ser and ser.is_open:
            ser.close()
 
# ── 3. Pydantic input model ───────────────────────────────────
class EcgBufferInput(BaseModel):
    user_id:          str
    samples:          List[float]   # normalised -1..+1 floats from browser
    sample_rate:      int = 360
    segment_duration: int = 10


# ── 4. /api/ecg/analyze — THE MAIN ENDPOINT ──────────────────
@app.post("/api/ecg/analyze")
async def analyze_ecg(data: EcgBufferInput):
    """
    Receives buffered ECG samples from the browser, runs your
    friend's 3-model ensemble (resnet + inception + transformer),
    and returns per-segment predictions + overall verdict.
 
    If the .keras model files are missing it falls back to a mock
    so the frontend keeps working during development.
    """
    if len(data.samples) < data.sample_rate * data.segment_duration:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least {data.segment_duration}s of data."
        )
 
    # ── Run ML (or mock fallback) ─────────────────────────────
    if ECG_ML_AVAILABLE:
        # Run in a thread so we don't block FastAPI's event loop
        segments = await asyncio.get_event_loop().run_in_executor(
            None,
            run_full_analysis,
            data.samples,
            data.sample_rate,
            data.segment_duration,
        )
    else:
        segments = _mock_segments(data.samples, data.sample_rate,
                                   data.segment_duration)
 
    # ── Build summary ─────────────────────────────────────────
    total     = len(segments)
    norm_segs = [s for s in segments if s["status"] == "Normal"]
    abnm_segs = [s for s in segments if s["status"] == "Abnormal"]
    norm_n    = len(norm_segs)
    abnm_n    = len(abnm_segs)
 
    # Condition counts → primary condition
    cond_counts: Dict[str, int] = {}
    for s in segments:
        cond_counts[s["condition"]] = cond_counts.get(s["condition"], 0) + 1
    primary = max(cond_counts, key=cond_counts.get)
 
    avg_conf = round(sum(s["confidence"] for s in segments) / total, 1)
    abnm_pct = round(abnm_n / total * 100, 1)
 
    overall_status = (
        "Critical" if abnm_pct >= 70 else
        "Warning"  if abnm_pct >= 20 else
        "Normal"
    )
 
    # Ensemble average probability across all segments (Page-3 style)
    if ECG_ML_AVAILABLE:
        # Average the per-class probabilities from each segment
        condition_proba = {c: 0.0 for c in CLASS_NAMES}
        for s in segments:
            for cname, pval in s.get("all_probs", {}).items():
                condition_proba[cname] = condition_proba.get(cname, 0) + pval
        condition_proba = {
            k: round(v / total, 1) for k, v in condition_proba.items()
        }
    else:
        condition_proba = {
            c: round(cond_counts.get(c, 0) / total * 100, 1)
            for c in CLASS_NAMES
        }
 
    # Anomaly summary (non-Normal conditions, sorted by count desc)
    anomaly_summary = [
        {
            "name":     cond,
            "count":    cnt,
            "pct":      round(cnt / total * 100, 1),
            "severity": SEVERITY_MAP.get(cond, "Warning") if ECG_ML_AVAILABLE
                        else ("Critical" if cond in ["Ventricular","AF","MI"]
                              else "Warning"),
            "color":    CLASS_COLORS.get(cond, "#888") if ECG_ML_AVAILABLE
                        else _FALLBACK_COLORS.get(cond, "#888"),
        }
        for cond, cnt in sorted(cond_counts.items(), key=lambda x: -x[1])
        if cond != "Normal"
    ]
 
    result = {
        "overall_status":    overall_status,
        "primary_condition": primary,
        "avg_confidence":    avg_conf,
        "normal_pct":        round(norm_n / total * 100, 1),
        "abnormal_pct":      abnm_pct,
        "total_segments":    total,
        "normal_segments":   norm_n,
        "abnormal_segments": abnm_n,
        "signal_quality":    "Good" if avg_conf > 55 else "Fair",
        "model_version":     "ECG-Ensemble-v1 (ResNet+Inception+Transformer)"
                             if ECG_ML_AVAILABLE else "MOCK",
        "duration_seconds":  round(len(data.samples) / data.sample_rate, 1),
        "segments":          segments,
        "condition_proba":   condition_proba,
        "anomaly_summary":   anomaly_summary,
        "analysed_at":       datetime.now().isoformat(),
        "ml_available":      ECG_ML_AVAILABLE,
    }
 
    # ── Save session to DB ─────────────────────────────────────
    try:
        db     = get_db()
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT id FROM users WHERE id_str = %s", (data.user_id,))
        u = cursor.fetchone()
        if u:
            cursor.execute("""
                INSERT INTO ecg_sessions
                (user_id, overall_status, primary_condition, avg_confidence,
                 normal_pct, abnormal_pct, total_segments, normal_segments,
                 abnormal_segments, signal_quality, model_version,
                 duration_seconds, segment_predictions, anomaly_summary)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                u["id"], overall_status, primary, avg_conf,
                result["normal_pct"], result["abnormal_pct"],
                total, norm_n, abnm_n,
                result["signal_quality"], result["model_version"],
                result["duration_seconds"],
                json.dumps(segments),
                json.dumps(anomaly_summary),
            ))
            db.commit()
            result["session_id"] = cursor.lastrowid
        cursor.close()
        db.close()
    except Exception as _db_err:
        logger.warning(f"ECG session DB save failed (non-fatal): {_db_err}")
 
    return result
 
# ── 5. ECG session history ────────────────────────────────────
@app.get("/api/ecg/history/{user_id}")
async def get_ecg_history(user_id: str):
    db     = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT e.id, e.overall_status, e.primary_condition, e.avg_confidence,
                   e.normal_pct, e.abnormal_pct, e.total_segments, e.signal_quality,
                   e.model_version, e.duration_seconds, e.created_at, e.anomaly_summary
            FROM   ecg_sessions e
            JOIN   users u ON e.user_id = u.id
            WHERE  u.id_str = %s
            ORDER  BY e.created_at DESC
            LIMIT  50
        """, (user_id,))
        rows = cursor.fetchall()
        for r in rows:
            r["created_at"] = r["created_at"].isoformat() if r["created_at"] else None
            if isinstance(r["anomaly_summary"], str):
                try:
                    r["anomaly_summary"] = json.loads(r["anomaly_summary"])
                except Exception:
                    r["anomaly_summary"] = []
        return rows
    finally:
        cursor.close()
        db.close()

# ── 6. Mock fallback (used when .keras files are missing) ─────
_FALLBACK_COLORS = {
    "Supraventricular": "#378ADD", "Normal": "#1D9E75",
    "AF": "#D4537E", "Ventricular": "#D85A30",
    "Conduction": "#EF9F27", "Ischemia": "#9333ea",
    "Hypertrophy": "#64748b", "MI": "#dc2626",
}
 
def _mock_segments(samples, sample_rate, segment_duration):
    import random
    CONDITIONS = list(_FALLBACK_COLORS.keys())
    seg_size   = sample_rate * segment_duration
    segments   = []
    for i in range(len(samples) // seg_size):
        cond = random.choice(CONDITIONS)
        conf = round(random.uniform(35, 65), 1)
        segments.append({
            "segment":    i + 1,
            "start_s":    round(i * segment_duration, 1),
            "end_s":      round((i + 1) * segment_duration, 1),
            "condition":  cond,
            "confidence": conf,
            "status":     "Normal" if cond == "Normal" else "Abnormal",
            "color":      _FALLBACK_COLORS[cond],
            "all_probs":  {c: round(random.uniform(0,15),1) for c in CONDITIONS},
        })
    return segments
 
@app.get("/api/ecg/history/doctor/{patient_id}")
async def get_ecg_history_for_doctor(patient_id: str):
    """
    Same as the patient ECG history but also includes
    segment_predictions so the doctor's anomaly log table
    can be populated.
    """
    db     = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT e.id, e.overall_status, e.primary_condition, e.avg_confidence,
                   e.normal_pct, e.abnormal_pct, e.total_segments, e.signal_quality,
                   e.model_version, e.duration_seconds, e.created_at,
                   e.anomaly_summary, e.segment_predictions
            FROM   ecg_sessions e
            JOIN   users u ON e.user_id = u.id
            WHERE  u.id_str = %s
            ORDER  BY e.created_at DESC
            LIMIT  50
        """, (patient_id,))
        rows = cursor.fetchall()

        for r in rows:
            # Serialize datetime
            r["created_at"] = r["created_at"].isoformat() if r["created_at"] else None

            # Parse anomaly_summary JSON string → list
            if isinstance(r["anomaly_summary"], str):
                try:    r["anomaly_summary"] = json.loads(r["anomaly_summary"])
                except: r["anomaly_summary"] = []

            # Parse segment_predictions JSON string → list
            # Rename to "segments" so frontend matches existing shape
            raw_segs = r.pop("segment_predictions", None)
            if isinstance(raw_segs, str):
                try:    r["segments"] = json.loads(raw_segs)
                except: r["segments"] = []
            elif isinstance(raw_segs, list):
                r["segments"] = raw_segs
            else:
                r["segments"] = []

        return rows
    finally:
        cursor.close()
        db.close()

        
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)