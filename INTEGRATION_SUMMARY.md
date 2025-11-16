# Face Matching Integration - Summary

## What Was Created

### 1. Using Existing faceChecker1 Service
**Location:** `E:\latest\Ali_Raza_Backup\Work\Fyp\8th Semester\faceChecker1\`

**Main File:** `face_match_server.py`
- Flask API for face matching
- Uses `face_recognition` library
- Compares two uploaded images via `/face_match` endpoint
- Returns boolean match result

**Note:** We're using your existing faceChecker1 backend, not creating a new one!

### 2. Node.js Integration Layer
**Location:** `E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\locate-lost-backend\src\`

**Files Created:**
- `services/faceMatchingService.js` - Service to communicate with Python API
- `controllers/faceMatchController.js` - API controllers for face matching
- `routes/faceMatchRoutes.js` - API routes

**Files Modified:**
- `src/app.js` - Added face match routes
- `.env` - Added FACE_MATCH_SERVICE_URL configuration

### 3. Utility Scripts
**Location:** `E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\`

**Files:**
- `start-services.bat` - Windows batch script to start both services
- `locate-lost-backend/test-face-matching.js` - Test script to verify integration
- `locate-lost-backend/FACE_MATCHING_SETUP.md` - Complete setup guide

## API Endpoints Available

### For Flutter App to Call:

1. **Check Service Health**
   ```
   GET http://localhost:5000/api/face-match/health
   ```

2. **Find Matches for Parent Report**
   ```
   POST http://localhost:5000/api/face-match/parent/:parentReportId/find-matches
   Headers: Authorization: Bearer <token>
   Body: { "minConfidence": 85 }
   ```

3. **Find Matches for Finder Report**
   ```
   POST http://localhost:5000/api/face-match/finder/:finderReportId/find-matches
   Headers: Authorization: Bearer <token>
   Body: { "minConfidence": 85 }
   ```

4. **Compare Specific Reports**
   ```
   POST http://localhost:5000/api/face-match/compare-reports
   Headers: Authorization: Bearer <token>
   Body: {
     "parentReportId": "uuid",
     "finderReportId": "uuid",
     "minConfidence": 85
   }
   ```

5. **Compare Two Images Directly**
   ```
   POST http://localhost:5000/api/face-match/compare-images
   Headers: Authorization: Bearer <token>
   Body: {
     "image1Url": "http://example.com/image1.jpg",
     "image2Url": "http://example.com/image2.jpg"
   }
   ```

## How It Works

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────────┐
│             │         │                  │         │                     │
│  Flutter    │────────▶│   Node.js        │────────▶│   Python Face       │
│  App        │         │   Backend        │         │   Matching Service  │
│  (Port ???) │         │   (Port 5000)    │         │   (Port 5001)       │
│             │◀────────│                  │◀────────│                     │
└─────────────┘         └──────────────────┘         └─────────────────────┘
     User                    Main Backend              Face Recognition
   Interface               (PostgreSQL DB)              (face_recognition)
```

### Flow:
1. Flutter app sends request to Node.js backend (port 5000)
2. Node.js backend retrieves image URLs from PostgreSQL database
3. Node.js backend calls Python service (port 5001) with image URLs
4. Python service downloads images and performs face comparison
5. Python service returns match confidence scores
6. Node.js backend creates match records in database
7. Node.js backend sends notifications to users
8. Node.js backend returns results to Flutter app

## Quick Start

### Option 1: Using Batch Script (Recommended)
```bash
# Double-click or run:
E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\start-services.bat
```

### Option 2: Manual Start

**Terminal 1 - faceChecker1 Service:**
```bash
cd "E:\latest\Ali_Raza_Backup\Work\Fyp\8th Semester\faceChecker1"
.venv\Scripts\activate
python face_match_server.py
```

**Terminal 2 - Node.js Backend:**
```bash
cd E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\locate-lost-backend
npm run dev
```

### Test Integration:
```bash
cd E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\locate-lost-backend
node test-face-matching.js
```

## Database Changes

The integration uses existing database schema. When a match is found:

1. Creates/updates record in `matched_cases` table:
   - `parentCaseId` - ID of parent report
   - `finderCaseId` - ID of finder report
   - `matchConfidence` - Confidence percentage (0-100)
   - `status` - MATCHED
   - `notificationSent` - true/false

2. Creates notifications in `notifications` table for both users

3. No schema changes required!

## Configuration

Edit `.env` in Node.js backend:

```env
# Face Matching Service
FACE_MATCH_SERVICE_URL=http://localhost:5001
MATCH_THRESHOLD=85
MAX_MATCHES_PER_CASE=10
```

- **FACE_MATCH_SERVICE_URL**: Python service URL
- **MATCH_THRESHOLD**: Minimum confidence % (0-100) to consider a match
- **MAX_MATCHES_PER_CASE**: Maximum number of matches to return

## Flutter Integration Example

```dart
// In your Flutter app, call Node.js backend only

Future<void> findMatchesForReport(String reportId, bool isParent) async {
  final url = isParent
      ? 'http://your-server:5000/api/face-match/parent/$reportId/find-matches'
      : 'http://your-server:5000/api/face-match/finder/$reportId/find-matches';
  
  final response = await http.post(
    Uri.parse(url),
    headers: {
      'Authorization': 'Bearer ${authToken}',
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
    for (var match in data['matches']) {
      print('Match ID: ${match['matchId']}');
      print('Confidence: ${match['confidence']}%');
    }
  }
}
```

## Troubleshooting

### Python Service Won't Start
- Install Visual C++ Build Tools (for face_recognition on Windows)
- Or use: `pip install face-recognition-models`
- Check Python version (3.7+ required)

### No Matches Found
- Lower the `minConfidence` threshold (try 75 or 70)
- Ensure images have clear, front-facing faces
- Check image URLs are accessible
- Review Python service logs

### Connection Errors
- Verify both services are running
- Check firewall settings
- Ensure ports 5000 and 5001 are available

## Performance Considerations

- Each face comparison takes ~1-3 seconds
- Comparing 1 report against 100 reports: ~2-3 minutes
- Consider running matches in background
- Cache results to avoid redundant comparisons

## Next Steps

1. ✅ Services are set up
2. ✅ API endpoints are ready
3. ⏭️ Test with real data
4. ⏭️ Integrate into Flutter app
5. ⏭️ Add background job queue (optional)
6. ⏭️ Deploy to production

## Support

For issues or questions:
1. Check `FACE_MATCHING_SETUP.md` for detailed documentation
2. Run `node test-face-matching.js` to diagnose issues
3. Check service logs for error messages
