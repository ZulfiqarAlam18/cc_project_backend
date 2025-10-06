# Simple Cropix Backend

A minimal FastAPI backend for crop disease detection.

## Files
- `main.py` - Main FastAPI app with disease detection endpoint
- `requirements.txt` - Python dependencies
- `README.md` - This file

## Quick Start

1. Install dependencies:
```bash
pip install -r requirements.txt
```


2. Run the server:
```bash
uvicorn main:app --reload
```
# Create a virtual environment
python3 -m venv venv
--r
# Activate the environment
source venv/bin/activate
# Run following command to install correct versions 
pip install fastapi uvicorn tensorflow==2.19.0 keras==3.5.0 numpy==1.26.4 pillow



3. API will be available at: http://localhost:8000
4. Documentation at: http://localhost:8000/docs

## API Endpoints

- `POST /detect` - Upload image and crop type for disease detection
- `GET /` - Health check

## Supported Crops
Apple, Blueberry, Cherry, Corn, Grape, Orange, Peach, Pepper, Potato, Raspberry, Soybean, Squash, Strawberry, Tomato