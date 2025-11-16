# Face Matching Integration Setup Guide

This guide explains how to set up and use the face matching integration between your Node.js backend and the Python face matching service.

## Architecture

```
Flutter App → Node.js Backend (Port 5000) → Python Face Matching Service (Port 5001)
```

The Flutter app only communicates with the Node.js backend, which internally calls the Python face matching service.

## Setup Instructions

### 1. Install Python Face Matching Service

Navigate to the face matching service directory:
```bash
cd E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\face-matching-service
```

Create virtual environment:
```bash
python -m venv venv
```

Activate virtual environment:
```bash
# Windows
venv\Scripts\activate
```

Install dependencies:
```bash
pip install -r requirements.txt
```

### 2. Start Services

#### Start Python Face Matching Service (Terminal 1):
```bash
cd E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\face-matching-service
venv\Scripts\activate
python face_match_api.py
```

Service will run on: `http://localhost:5001`

#### Start Node.js Backend (Terminal 2):
```bash
cd E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\locate-lost-backend
npm run dev
```

Service will run on: `http://localhost:5000`

## API Endpoints

### 1. Check Face Matching Service Health
```
GET http://localhost:5000/api/face-match/health
```

### 2. Compare Two Images
```
POST http://localhost:5000/api/face-match/compare-images
Headers: Authorization: Bearer <token>
Body: {
  "image1Url": "http://example.com/image1.jpg",
  "image2Url": "http://example.com/image2.jpg",
  "tolerance": 0.6
}
```

### 3. Find Matches for Parent Report
```
POST http://localhost:5000/api/face-match/parent/:parentReportId/find-matches
Headers: Authorization: Bearer <token>
Body: {
  "minConfidence": 85
}
```

This endpoint will:
- Get all images from the parent report
- Compare them against all active finder reports
- Create match records in the database
- Send notifications to both parent and finder
- Return all matches found

### 4. Find Matches for Finder Report
```
POST http://localhost:5000/api/face-match/finder/:finderReportId/find-matches
Headers: Authorization: Bearer <token>
Body: {
  "minConfidence": 85
}
```

This endpoint will:
- Get all images from the finder report
- Compare them against all active parent reports
- Create match records in the database
- Send notifications
- Return all matches found

### 5. Compare Specific Reports
```
POST http://localhost:5000/api/face-match/compare-reports
Headers: Authorization: Bearer <token>
Body: {
  "parentReportId": "uuid",
  "finderReportId": "uuid",
  "minConfidence": 85
}
```

## How It Works

1. **Flutter App** submits a parent or finder report with images
2. Images are uploaded to the Node.js backend
3. When matching is requested, **Node.js backend**:
   - Retrieves image URLs from database
   - Sends image URLs to Python face matching service
   - Python service downloads and compares faces
   - Returns match confidence score
   - Node.js creates match records if confidence > threshold
   - Sends notifications to users

## Match Workflow

### Automatic Matching (When Report is Created)
The system can automatically trigger matching when a new report is submitted.

### Manual Matching (On Demand)
Users or admins can trigger matching manually:

1. **Parent creates report** → Call `/api/face-match/parent/:id/find-matches`
2. **Finder creates report** → Call `/api/face-match/finder/:id/find-matches`

## Configuration

Edit `.env` file in Node.js backend:

```env
# Face Matching Service
FACE_MATCH_SERVICE_URL=http://localhost:5001
MATCH_THRESHOLD=85
MAX_MATCHES_PER_CASE=10
```

- `FACE_MATCH_SERVICE_URL`: URL of Python service
- `MATCH_THRESHOLD`: Minimum confidence percentage for a match (0-100)
- `MAX_MATCHES_PER_CASE`: Maximum number of matches to store per report

## Troubleshooting

### Python Service Not Starting
- Ensure Python 3.7+ is installed
- Check if virtual environment is activated
- Verify all dependencies are installed: `pip list`
- Check if port 5001 is available

### Node.js Backend Can't Connect to Python Service
- Verify Python service is running: `curl http://localhost:5001/health`
- Check `FACE_MATCH_SERVICE_URL` in `.env`
- Check firewall settings

### No Matches Found
- Ensure images contain clear faces
- Check match threshold (lower = more matches)
- Verify images are accessible via their URLs
- Check logs for face detection errors

## Flutter Integration

In your Flutter app, only call the Node.js backend:

```dart
// Find matches for a parent report
final response = await http.post(
  Uri.parse('http://your-server:5000/api/face-match/parent/$reportId/find-matches'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'minConfidence': 85,
  }),
);

if (response.statusCode == 200) {
  final data = jsonDecode(response.body);
  print('Matches found: ${data['matchesFound']}');
  // Handle matches
}
```

## Production Deployment

1. Update `FACE_MATCH_SERVICE_URL` to Python service URL
2. Use production-grade server (Gunicorn for Python)
3. Set up reverse proxy (Nginx)
4. Enable HTTPS
5. Configure proper CORS settings
6. Set up monitoring and logging

## Performance Notes

- Face matching takes 1-5 seconds per image pair
- Comparing against 100 reports may take 1-2 minutes
- Consider implementing background job queue for large-scale matching
- Cache face encodings to improve performance
