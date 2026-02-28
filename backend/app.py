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
        password="1234",
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
        
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)