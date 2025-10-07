from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import tensorflow as tf
import numpy as np
from PIL import Image
import io
from datetime import datetime
import json

# Create FastAPI app
app = FastAPI(title="Cropix Disease Detection", version="1.0.0")

# Add CORS (open for now; later restrict to your Flutter app domain)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Globals
loaded_model = None
class_names = []
model_loaded = False
remedies_data = {}

# ---- Model Loader ----
def load_trained_model():
    global loaded_model, class_names, model_loaded, remedies_data
    
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(base_dir, "models", "PlantsDiseaseDetection_Model (1).keras")
        encoder_path = os.path.join(base_dir, "models", "class_names.json")
        remedies_path = os.path.join(base_dir, "remedies.json")

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at: {model_path}")
        if not os.path.exists(encoder_path):
            raise FileNotFoundError(f"Class names file not found at: {encoder_path}")

        # Load model
        loaded_model = tf.keras.models.load_model(model_path, compile=False)
        print("✅ Model loaded successfully")

        # Load class names
        with open(encoder_path, "r") as f:
            class_names = json.load(f)
        print(f"✅ Loaded {len(class_names)} classes")

        # Load remedies
        if os.path.exists(remedies_path):
            with open(remedies_path, "r") as f:
                remedies_data = json.load(f)
        else:
            remedies_data = {}

        model_loaded = True

    except Exception as e:
        print(f"❌ ERROR loading model: {e}")
        model_loaded = False
        raise RuntimeError(f"Failed to load model: {e}")

# Load model at startup
load_trained_model()

# ---- Image Preprocessing ----
def preprocess_image(image_file) -> np.ndarray:
    try:
        image = Image.open(io.BytesIO(image_file))
        if image.mode != "RGB":
            image = image.convert("RGB")
        image = image.resize((224, 224))
        image_array = np.array(image)
        image_array = np.expand_dims(image_array, axis=0)
        image_array = tf.keras.applications.efficientnet.preprocess_input(image_array)
        return image_array
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing image: {str(e)}")

# ---- Prediction ----
def predict_with_model(image_array: np.ndarray) -> tuple:
    if not model_loaded or loaded_model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    probabilities = loaded_model.predict(image_array, verbose=0)
    predicted_class = int(np.argmax(probabilities, axis=1)[0])
    confidence = float(np.max(probabilities))
    predicted_disease = class_names[predicted_class]
    return predicted_disease, confidence

# ---- Routes ----
@app.get("/")
async def root():
    return {
        "message": "Cropix Disease Detection API",
        "status": "healthy" if model_loaded else "degraded",
        "model_loaded": model_loaded,
        "total_classes": len(class_names),
        "timestamp": datetime.now().isoformat()
    }

@app.post("/detect")
async def detect_disease(image: UploadFile = File(...), crop_type: str = Form(None)):
    valid_extensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
    if not (image.filename and any(image.filename.lower().endswith(ext) for ext in valid_extensions)):
        raise HTTPException(status_code=400, detail=f"Invalid file type: {image.filename}")

    image_content = await image.read()
    processed_image = preprocess_image(image_content)
    predicted_disease, confidence = predict_with_model(processed_image)

    return {
        "success": True,
        "crop_type": crop_type if crop_type else "Unknown",
        "predicted_disease": predicted_disease,
        "confidence": confidence,
        "confidence_percentage": round(confidence * 100, 2),
        "is_healthy": "healthy" in predicted_disease.lower(),
        "timestamp": datetime.now().isoformat(),
        "description": get_disease_description(predicted_disease),
        "recommendations": get_recommendations(predicted_disease),
    }

@app.get("/classes")
async def get_classes():
    if not model_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return {"classes": class_names, "total": len(class_names)}

# ---- Helpers ----
def get_disease_description(disease: str) -> str:
    if disease in remedies_data:
        return remedies_data[disease].get("description", "No description available.")
    if "healthy" in disease.lower():
        return "Your plant appears to be healthy."
    return f"Disease detected: {disease}."

def get_recommendations(disease: str) -> list:
    if disease in remedies_data:
        return remedies_data[disease].get("remedies", [])
    if "healthy" in disease.lower():
        return ["Your plant is healthy!", "Continue regular care."]
    return ["Consult local experts", "Remove affected leaves", "Ensure good air circulation"]

# ---- Entry Point ----
if __name__ == "__main__":
    import uvicorn
    # ✅ Works on AWS EC2 (binds to all IPs, port 8000)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
