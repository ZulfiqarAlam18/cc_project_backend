# 🤖 How to Add Your Trained Model

## Step 1: Place Your Model Files

Put your trained model files in the `models/` directory:

```
simple_backend/
├── models/
│   ├── crop_disease_model.pkl    # ← Your main model file
│   ├── label_encoder.pkl         # ← Your label encoder (if you have one)
│   └── README.md
├── main.py
├── requirements.txt
└── README.md
```

## Step 2: Rename Your Files (if needed)

The backend expects these filenames:
- `PlantsDiseaseDetection_Model.keras` - Your main trained model
- `class_names.json` - labels mapping
<!-- - `label_encoder.pkl` - Your label encoder (optional) -->

**If your files have different names, either:**
1. Rename them to match, OR
2. Update the filenames in `main.py` lines 32-33:
   ```python
   model_path = "models/your_model_name.pkl"
   encoder_path = "models/your_encoder_name.pkl"
   ```

## Step 3: Update Image Preprocessing (Important!)

In `main.py`, update the `preprocess_image()` function to match how you trained your model:

```python
def preprocess_image(image_file) -> np.ndarray:
    # Change this size to match your training data
    image = image.resize((224, 224))  # ← Update this size
    
    # Add any other preprocessing you used during training:
    # - Normalization
    # - Reshape
    # - Color space conversion
```

## Step 4: Update Model Prediction (if needed)

In the `predict_with_model()` function, adjust based on your model type:

**For scikit-learn models (default):**
```python
prediction = loaded_model.predict([image_array])
```

**For deep learning models:**
```python
prediction = loaded_model.predict(np.expand_dims(image_array, axis=0))
```

## Step 5: Test Your Model

1. **Start the server:**
   ```bash
   cd /home/zulfi/Desktop/simple_backend
   uvicorn main:app --reload
   ```

2. **Check if model loaded:**
   Visit: http://localhost:8000
   Should show: `"model_loaded": true`

3. **Test prediction:**
   Use the docs at: http://localhost:8000/docs

## Common Model Types & How to Load:

### 1. Scikit-learn (.pkl, .joblib)
```python
import pickle
with open('model.pkl', 'rb') as f:
    model = pickle.load(f)
```
✅ **Already supported in the backend!**

### 2. TensorFlow/Keras (.h5)
Add to requirements.txt: `tensorflow==2.19.0`
```python
from tensorflow.keras.models import load_model
model = load_model('model.keras')
```

### 3. PyTorch (.pt, .pth)
Add to requirements.txt: `torch==2.0.1`
```python
import torch
model = torch.load('model.pt')
```

## Need Help?

If you run into issues:
1. Check the console output when starting the server
2. Look for error messages about model loading
3. Make sure your model files are in the right directory
4. Verify the image preprocessing matches your training data

The backend will automatically fall back to mock predictions if the model fails to load, so you can still test the API integration!