# Model Files Directory

Place your trained model files here:

## Supported Model Formats:
- `.pkl` files (scikit-learn, pickle)
- `.h5` files (Keras/TensorFlow)
- `.pt` or `.pth` files (PyTorch)
- `.joblib` files (scikit-learn joblib)

## Example Model Files:
```
models/
├── crop_disease_model.pkl       # Main trained model
├── label_encoder.pkl            # Label encoder for classes
└── preprocessor.pkl             # Image preprocessor (optional)
```

## Model Loading:
The main.py file will automatically detect and load your model files when you restart the server.