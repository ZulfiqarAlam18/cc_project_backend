#!/bin/bash

# Backend startup script for Plant Disease Detection
echo "=========================================="
echo "Starting Plant Disease Detection Backend"
echo "=========================================="

# Check if we're in the backend directory
if [ ! -f "main.py" ]; then
    echo "❌ Error: main.py not found. Please run this script from the backend directory."
    echo "   Usage: cd backend && ./start_backend.sh"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Error: Virtual environment not found."
    echo "   Please create it first: python -m venv venv"
    exit 1
fi

# Activate virtual environment
echo "📦 Activating virtual environment..."
source venv/bin/activate

# Check if model files exist
if [ ! -f "models/PlantsDiseaseDetection_Model (1).keras" ]; then
    echo "⚠️  Warning: Model file not found at models/PlantsDiseaseDetection_Model (1).keras"
    echo "   The backend may not work properly without the trained model."
fi

if [ ! -f "models/class_names.json" ]; then
    echo "⚠️  Warning: Class names file not found at models/class_names.json"
fi

if [ ! -f "remedies.json" ]; then
    echo "⚠️  Warning: Remedies file not found at remedies.json"
fi

# Install dependencies if needed
echo "📦 Checking dependencies..."
pip install -q -r requirements.txt

# Get local IP address
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo "🌐 Backend will be accessible at: http://$LOCAL_IP:8000"
echo "   Make sure your mobile device is on the same WiFi network"

# Start the server
echo "🚀 Starting FastAPI server..."
echo "   Press Ctrl+C to stop the server"
echo ""
python main.py