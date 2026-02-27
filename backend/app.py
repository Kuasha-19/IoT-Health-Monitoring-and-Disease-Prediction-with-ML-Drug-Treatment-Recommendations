import pickle
import numpy as np
import pandas as pd
import mysql.connector
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
class ContactInquiry(BaseModel):
    full_name: str
    medical_id: Optional[str] = None
    email: str
    phone: str
    subject: str
    message: str

class UserSignup(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    password: str

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
# 4. Clinical Advice Logic (Drugs & Foods)
# ------------------------------
def get_clinical_advice(disease, score):
    advice = {"drugs": "Consult Doctor", "foods": "Balanced Diet", "routine": "Rest"}
    
    # Heart Risk Logic
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
    
    # Fever Respiratory Logic
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

    # Hypertension Logic
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

    # Hypotension Logic
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
        sql = """INSERT INTO users (id, id_str, name, email, role, password_hash) 
                 VALUES (%s, %s, %s, %s, %s, %s)"""
        
        cursor.execute(sql, (
            user.user_id,   # id (Primary Key)
            user.user_id,   # id_str (Unique Key)
            user.name, 
            user.email, 
            user.role, 
            user.password
        ))
        
        db.commit()
        return {"status": "success", "message": "Account created successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Signup Error: {e}")
        raise HTTPException(status_code=400, detail="User ID or Email already exists")
    finally:
        cursor.close()
        db.close()

@app.post("/api/login")
async def login(data: dict):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM users WHERE id_str=%s AND password_hash=%s", (data['user_id'], data['password']))
        user = cursor.fetchone()
        if user: return user
        raise HTTPException(status_code=404, detail="Invalid Credentials")
    finally:
        cursor.close()
        db.close()

@app.post("/api/predict")
async def predict(input_data: HealthInput):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
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
                     suggested_drugs, suggested_foods, clinical_routine) 
                     VALUES (%s, %s, %s, %s, %s, %s, %s)"""
            cursor.execute(sql, (u_record['id'], "AI Checkup", disease, score, 
                                 advice['drugs'], advice['foods'], advice['routine']))
            db.commit()

        return {"prediction": disease, "score": score, **advice}
    finally:
        cursor.close()
        db.close()

@app.get("/api/search-patient")
async def search_patient(q: str):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id_str, name, role FROM users WHERE (name LIKE %s OR id_str LIKE %s) AND role='patient'", (f"%{q}%", f"%{q}%"))
    return cursor.fetchall()

@app.get("/api/reports/{user_id}")
async def get_reports(user_id: str):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("""SELECT p.* FROM predictions p JOIN users u ON p.user_id = u.id 
                      WHERE u.id_str = %s ORDER BY p.created_at DESC""", (user_id,))
    return cursor.fetchall()

@app.delete("/api/delete-patient/{patient_id}")
async def delete_patient(patient_id: str):
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM predictions WHERE user_id = (SELECT id FROM users WHERE id_str = %s)", (patient_id,))
        cursor.execute("DELETE FROM doctor_feedback WHERE patient_id = %s", (patient_id,))
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
    cursor.execute("SELECT * FROM doctor_feedback WHERE patient_id_str = %s ORDER BY prescribed_at DESC", (patient_id,))
    return cursor.fetchall()
   
@app.post("/api/contact")
async def handle_contact(data: ContactInquiry):
    db = None
    try:
        db = get_db()
        cursor = db.cursor()
        sql = """INSERT INTO contact_messages (full_name, medical_id, email, phone, subject, message) 
                 VALUES (%s, %s, %s, %s, %s, %s)"""
        values = (data.full_name, data.medical_id, data.email, data.phone, data.subject, data.message)
        cursor.execute(sql, values)
        db.commit()
        return {"status": "success", "message": "Inquiry saved successfully"}
    except Exception as e:
        logger.error(f"Contact Form Error: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")
    finally:
        if db:
            cursor.close()
            db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)