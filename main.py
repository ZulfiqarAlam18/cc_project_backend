from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import tensorflow as tf
import numpy as np
from PIL import Image
import io
from datetime import datetime
from typing import Dict, Optional
import json
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log') if os.environ.get('ENV') != 'production' else logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


# Create FastAPI app
app = FastAPI(title="Cropix Disease Detection", version="1.0.0")

# Add CORS for Flutter app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Flutter app URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for model
loaded_model = None
class_names = []
model_loaded = False
remedies_data = {}

# Model loading function
def load_trained_model():
    """Load your trained model files"""
    global loaded_model, class_names, model_loaded, remedies_data
    
    try:
        # Load trained model files - using relative paths
        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(base_dir, "models", "model.keras")
        encoder_path = os.path.join(base_dir, "models", "class_names.json")
        remedies_path = os.path.join(base_dir, "remedies.json")
        
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at: {model_path}")
        
        if not os.path.exists(encoder_path):
            raise FileNotFoundError(f"Class names file not found at: {encoder_path}")
        
        # Load the model
        loaded_model = tf.keras.models.load_model(model_path, compile=False)
        logger.info("✅ Model loaded successfully")
        logger.info(f"   Input shape: {loaded_model.input_shape}")
        
        # Load class names
        with open(encoder_path, "r") as f:
            class_names = json.load(f)
        logger.info(f"✅ Loaded {len(class_names)} class names")
        logger.info(f"   Classes: {class_names[:5]}..." if len(class_names) > 5 else f"   Classes: {class_names}")
        
        # Load remedies data
        if os.path.exists(remedies_path):
            with open(remedies_path, "r") as f:
                remedies_data = json.load(f)
            logger.info(f"✅ Loaded remedies for {len(remedies_data)} disease classes")
        else:
            logger.warning(f"⚠️  Remedies file not found at: {remedies_path}")
            remedies_data = {}
        
        model_loaded = True
        logger.info("🤖 Real-time ML model ready for predictions")
            
    except Exception as e:
        logger.error(f"❌ CRITICAL ERROR: Failed to load model: {e}")
        logger.error("⚠️  The API will not work without the trained model!")
        model_loaded = False
        raise RuntimeError(f"Failed to load required model files: {e}")

# Load model on startup
load_trained_model()

def preprocess_image(image_file) -> np.ndarray:
    try:
        # Read image
        image = Image.open(io.BytesIO(image_file))

        # Convert to RGB (3 channels)
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Resize to model input size (224x224)
        image = image.resize((224, 224))

        # Convert to numpy array
        image_array = np.array(image)
        logger.debug("Image shape before prediction:", image_array.shape)

        # Add batch dimension
        image_array = np.expand_dims(image_array, axis=0)

        # Apply EfficientNet preprocessing
        image_array = tf.keras.applications.efficientnet.preprocess_input(image_array)

        return image_array

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing image: {str(e)}")


def predict_with_model(image_array: np.ndarray) -> tuple:
    """
    Use your trained model to predict disease
    Returns: (predicted_disease, confidence)
    """
    if not model_loaded or loaded_model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please check server logs and ensure model files are present."
        )
    
    try:
        # Make prediction with the trained model
        probabilities = loaded_model.predict(image_array, verbose=0)
        
        predicted_class = int(np.argmax(probabilities, axis=1)[0])
        confidence = float(np.max(probabilities))
        
        predicted_disease = class_names[predicted_class]
        
        print(f"✅ Prediction: {predicted_disease} ({confidence*100:.2f}% confidence)")
        return predicted_disease, confidence
        
    except Exception as e:
        print(f"❌ Error in model prediction: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Cropix Disease Detection API",
        "status": "healthy" if model_loaded else "degraded",
        "model_loaded": model_loaded,
        "total_classes": len(class_names),
        "timestamp": datetime.now().isoformat()
    }

@app.post("/detect")
async def detect_disease(
    image: UploadFile = File(...),
    crop_type: str = Form(None)  # Optional parameter for compatibility
):
    """
    Disease detection endpoint - uses real trained model
    """
    
    valid_extensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
    
    print(f"📋 Received file: {image.filename}")
    print(f"📝 Content-Type: {image.content_type}")
    
    try:
        # Read image file
        image_content = await image.read()
        
        # Preprocess image for model
        processed_image = preprocess_image(image_content)
        
        # Get prediction from real trained model only
        predicted_disease, confidence = predict_with_model(processed_image)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing image: {str(e)}"
        )
    
    return {
        "success": True,
        "crop_type": crop_type if crop_type else "Unknown",
        "predicted_disease": predicted_disease,
        "confidence": confidence,
        "confidence_percentage": round(confidence * 100, 2),
        "is_healthy": "healthy" in predicted_disease.lower(),
        "message": f"Disease detection completed successfully",
        "timestamp": datetime.now().isoformat(),
        "description": get_disease_description(predicted_disease),
        "recommendations": get_recommendations(predicted_disease)
    }

def get_disease_description(disease: str) -> str:
    if disease in remedies_data:
        return remedies_data[disease].get("description", "No description available.")
    if "healthy" in disease.lower():
        return "Your plant appears to be healthy with no signs of disease."
    return f"Disease detected: {disease}. Please consult agricultural resources for more information."

def get_recommendations(disease: str) -> list:
    if disease in remedies_data:
        remedies = remedies_data[disease].get("remedies", [])
        if remedies:
            return remedies
    if "healthy" in disease.lower():
        return [
            "Your plant appears healthy!",
            "Continue regular care and monitoring",
            "Maintain proper watering and fertilization",
            "Keep monitoring for any changes",
            "Ensure adequate sunlight and nutrients"
        ]
    return [
        f"Disease detected: {disease}",
        "Consult with a local agricultural extension office for specific treatment",
        "Remove and destroy affected plant parts if necessary",
        "Improve air circulation around plants",
        "Monitor plant health regularly",
        "Consider consulting a plant pathologist for detailed diagnosis"
    ]

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "model_loaded": model_loaded,
        "service": "Cropix Disease Detection API"
    }

@app.get("/classes")
async def get_classes():
    if not model_loaded:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded"
        )
    return {
        "classes": class_names,
        "total": len(class_names)
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))  # ✅ important for Render
    logger.info(f"🚀 Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
