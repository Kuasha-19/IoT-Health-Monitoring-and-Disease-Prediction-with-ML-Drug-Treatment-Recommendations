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


# ── 1. List available serial ports ───────────────────────────
@app.get("/api/ecg/ports")
async def list_serial_ports():
    """Return all available COM/serial ports so the frontend can let the user pick."""
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

active_ecg_connections: list[WebSocket] = []

@app.websocket("/ws/ecg/{port_name}")
async def ecg_websocket(websocket: WebSocket, port_name: str):
    """
    Streams raw ECG samples from Arduino to the browser in real-time.
    Message format sent to browser: {"t": <ms_since_start>, "v": <adc_value>}
    """
    await websocket.accept()
    active_ecg_connections.append(websocket)
    logger.info(f"ECG WebSocket opened — port: {port_name}")

    import asyncio
    import time

    ser = None
    t0 = time.time()

    try:
        # Decode port name — browser sends e.g. "COM3" or "ttyUSB0"
        actual_port = port_name.replace("__", "/")   # frontend encodes / as __
        ser = serial.Serial(actual_port, baudrate=9600, timeout=1)
        logger.info(f"Serial port {actual_port} opened at 9600 baud")

        while True:
            # Non-blocking read — run in thread to not block the event loop
            raw = await asyncio.get_event_loop().run_in_executor(
                None, ser.readline
            )
            if raw:
                try:
                    val = int(raw.decode("utf-8").strip())
                    elapsed_ms = round((time.time() - t0) * 1000)
                    await websocket.send_text(json.dumps({"t": elapsed_ms, "v": val}))
                except (ValueError, UnicodeDecodeError):
                    pass  # skip malformed lines

    except WebSocketDisconnect:
        logger.info("ECG WebSocket closed by client")
    except serial.SerialException as e:
        logger.error(f"Serial error: {e}")
        try:
            await websocket.send_text(json.dumps({"error": f"Serial port error: {str(e)}"}))
        except Exception:
            pass
    finally:
        if ser and ser.is_open:
            ser.close()
        if websocket in active_ecg_connections:
            active_ecg_connections.remove(websocket)


# ── 3. Analyze a completed ECG buffer (ML prediction) ────────
class EcgBufferInput(BaseModel):
    user_id: str
    samples: List[float]          # raw ADC values
    sample_rate: int = 360        # Hz — samples per second
    segment_duration: int = 10    # seconds per analysis window


@app.post("/api/ecg/analyze")
async def analyze_ecg(data: EcgBufferInput):
    """
    Receives a buffer of raw ECG samples, splits into 10s segments,
    runs the ML model (your teammate's ECG model — best_dl_model) on each,
    returns per-segment predictions + overall verdict.

    ⚠️  Replace the mock logic below with your actual ECG ML model call.
        Your teammate's model in /Main Model Train/ is a separate model
        from the health predictor. Load it the same way (pickle / keras).
    """
    import random

    CONDITIONS = ["Supraventricular", "Normal", "AF", "Ventricular", "Conduction",
                  "Ischemia", "Hypertrophy", "MI"]
    CONDITION_COLORS = {
        "Supraventricular": "#378ADD",
        "Normal": "#1D9E75",
        "AF": "#D4537E",
        "Ventricular": "#D85A30",
        "Conduction": "#EF9F27",
        "Ischemia": "#9333ea",
        "Hypertrophy": "#64748b",
        "MI": "#dc2626",
    }

    seg_size = data.sample_rate * data.segment_duration
    segments = []
    total_samples = len(data.samples)

    for i, start in enumerate(range(0, total_samples, seg_size)):
        chunk = data.samples[start: start + seg_size]
        if len(chunk) < seg_size // 2:
            break  # skip tiny trailing segment

        # ── TODO: Replace with real model inference ──────────────
        # Example with keras/tensorflow:
        #   import numpy as np
        #   X = np.array(chunk).reshape(1, -1)
        #   X = ecg_scaler.transform(X)
        #   proba = ecg_model.predict(X, verbose=0)[0]
        #   pred_idx = np.argmax(proba)
        #   condition = ecg_label_encoder.inverse_transform([pred_idx])[0]
        #   confidence = round(float(np.max(proba)) * 100, 1)
        # ─────────────────────────────────────────────────────────

        condition = random.choice(CONDITIONS)
        confidence = round(random.uniform(35, 65), 1)
        is_normal = condition == "Normal"

        segments.append({
            "segment": i + 1,
            "start_s": round(start / data.sample_rate, 1),
            "end_s": round(min(start + seg_size, total_samples) / data.sample_rate, 1),
            "condition": condition,
            "confidence": confidence,
            "status": "Normal" if is_normal else "Abnormal",
            "color": CONDITION_COLORS.get(condition, "#888"),
        })

    if not segments:
        raise HTTPException(status_code=400, detail="Insufficient ECG data for analysis.")

    # Overall verdict
    condition_counts: Dict[str, int] = {}
    for s in segments:
        condition_counts[s["condition"]] = condition_counts.get(s["condition"], 0) + 1

    primary_condition = max(condition_counts, key=condition_counts.get)
    total_segs = len(segments)
    normal_segs = sum(1 for s in segments if s["status"] == "Normal")
    abnormal_segs = total_segs - normal_segs
    avg_conf = round(sum(s["confidence"] for s in segments) / total_segs, 1)

    abnormal_pct = round(abnormal_segs / total_segs * 100, 1)
    overall_status = (
        "Critical" if abnormal_pct >= 80 else
        "Warning" if abnormal_pct >= 30 else
        "Normal"
    )

    # Condition probability (ensemble average)
    condition_proba = {c: round(condition_counts.get(c, 0) / total_segs * 100, 1)
                       for c in CONDITIONS}

    # Anomaly summary (non-normal conditions grouped)
    anomaly_summary = []
    for cond, cnt in sorted(condition_counts.items(), key=lambda x: -x[1]):
        if cond != "Normal":
            anomaly_summary.append({
                "name": cond,
                "count": cnt,
                "pct": round(cnt / total_segs * 100, 1),
                "severity": (
                    "Critical" if cond in ["Ventricular", "AF"] else
                    "Warning" if cond in ["Supraventricular", "Conduction"] else
                    "Info"
                ),
                "color": CONDITION_COLORS.get(cond, "#888"),
            })

    result = {
        "overall_status": overall_status,
        "primary_condition": primary_condition,
        "avg_confidence": avg_conf,
        "normal_pct": round(normal_segs / total_segs * 100, 1),
        "abnormal_pct": abnormal_pct,
        "total_segments": total_segs,
        "normal_segments": normal_segs,
        "abnormal_segments": abnormal_segs,
        "signal_quality": "Good" if avg_conf > 50 else "Fair",
        "model_version": "ECG-DL-v1.0",
        "duration_seconds": round(total_samples / data.sample_rate, 1),
        "segments": segments,
        "condition_proba": condition_proba,
        "anomaly_summary": anomaly_summary,
        "analysed_at": datetime.now().isoformat(),
    }

    # Save session to DB
    try:
        db = get_db()
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT id FROM users WHERE id_str = %s", (data.user_id,))
        u = cursor.fetchone()
        if u:
            cursor.execute("""
                INSERT INTO ecg_sessions
                (user_id, overall_status, primary_condition, avg_confidence,
                 normal_pct, abnormal_pct, total_segments, normal_segments,
                 abnormal_segments, signal_quality, model_version, duration_seconds,
                 segment_predictions, anomaly_summary)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                u['id'], overall_status, primary_condition, avg_conf,
                result['normal_pct'], result['abnormal_pct'],
                total_segs, normal_segs, abnormal_segs,
                result['signal_quality'], result['model_version'],
                result['duration_seconds'],
                json.dumps(segments),
                json.dumps(anomaly_summary),
            ))
            db.commit()
            result["session_id"] = cursor.lastrowid
        cursor.close()
        db.close()
    except Exception as e:
        logger.error(f"ECG session save failed: {e}")
        # Non-fatal — still return the analysis result

    return result


# ── 4. ECG session history ────────────────────────────────────
@app.get("/api/ecg/history/{user_id}")
async def get_ecg_history(user_id: str):
    """Returns past ECG sessions for a patient, most recent first."""
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT e.id, e.overall_status, e.primary_condition, e.avg_confidence,
                   e.normal_pct, e.abnormal_pct, e.total_segments, e.signal_quality,
                   e.model_version, e.duration_seconds, e.created_at, e.anomaly_summary
            FROM ecg_sessions e
            JOIN users u ON e.user_id = u.id
            WHERE u.id_str = %s
            ORDER BY e.created_at DESC
            LIMIT 50
        """, (user_id,))
        rows = cursor.fetchall()
        for r in rows:
            r['created_at'] = r['created_at'].isoformat() if r['created_at'] else None
            if isinstance(r['anomaly_summary'], str):
                r['anomaly_summary'] = json.loads(r['anomaly_summary'])
        return rows
    finally:
        cursor.close()
        db.close()

        
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)