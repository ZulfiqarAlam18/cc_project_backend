# Quick Start Guide - Face Matching Integration

## ⚡ Quick Setup (5 minutes)

### Step 1: Install Python Dependencies
```bash
cd E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\face-matching-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Step 2: Start Both Services
**Option A - Easy Way (Double-click this file):**
```
E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\start-services.bat
```

**Option B - Manual:**
```bash
# Terminal 1 - Python Service
cd E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\face-matching-service
venv\Scripts\activate
python face_match_api.py

# Terminal 2 - Node.js Backend  
cd E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\locate-lost-backend
npm run dev
```

### Step 3: Test Integration
```bash
cd E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\locate-lost-backend
node test-face-matching.js
```

## 🎯 Main API Endpoints for Flutter

### 1. Find Matches for Parent Report
```
POST http://localhost:5000/api/face-match/parent/{reportId}/find-matches
Authorization: Bearer {token}
Body: { "minConfidence": 85 }

Response: {
  "success": true,
  "matchesFound": 2,
  "matches": [
    {
      "matchId": "uuid",
      "confidence": 92.5,
      "finderReportId": "uuid",
      "finderName": "John Doe",
      "finderPhone": "+1234567890"
    }
  ]
}
```

### 2. Find Matches for Finder Report
```
POST http://localhost:5000/api/face-match/finder/{reportId}/find-matches
Authorization: Bearer {token}
Body: { "minConfidence": 85 }

Response: Same structure as above
```

### 3. Compare Specific Reports
```
POST http://localhost:5000/api/face-match/compare-reports
Authorization: Bearer {token}
Body: {
  "parentReportId": "uuid",
  "finderReportId": "uuid",
  "minConfidence": 85
}

Response: {
  "success": true,
  "matched": true,
  "matchId": "uuid",
  "confidence": 89.3
}
```

## 📱 Flutter Integration Code

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class FaceMatchingService {
  final String baseUrl = 'http://your-server:5000/api/face-match';
  final String authToken;

  FaceMatchingService(this.authToken);

  // Find matches for parent report
  Future<Map<String, dynamic>> findMatchesForParent(String reportId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/parent/$reportId/find-matches'),
      headers: {
        'Authorization': 'Bearer $authToken',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'minConfidence': 85}),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to find matches');
  }

  // Find matches for finder report
  Future<Map<String, dynamic>> findMatchesForFinder(String reportId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/finder/$reportId/find-matches'),
      headers: {
        'Authorization': 'Bearer $authToken',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'minConfidence': 85}),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to find matches');
  }

  // Compare two specific reports
  Future<Map<String, dynamic>> compareReports(
    String parentReportId,
    String finderReportId,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/compare-reports'),
      headers: {
        'Authorization': 'Bearer $authToken',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'parentReportId': parentReportId,
        'finderReportId': finderReportId,
        'minConfidence': 85,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to compare reports');
  }

  // Check if face matching service is available
  Future<bool> checkServiceHealth() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/health'),
        headers: {'Authorization': 'Bearer $authToken'},
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }
}

// Usage Example
void main() async {
  final service = FaceMatchingService('your-auth-token');
  
  // Check if service is available
  bool isHealthy = await service.checkServiceHealth();
  print('Service healthy: $isHealthy');
  
  // Find matches for a parent report
  var result = await service.findMatchesForParent('report-id');
  print('Matches found: ${result['matchesFound']}');
  
  for (var match in result['matches']) {
    print('Match confidence: ${match['confidence']}%');
    print('Finder: ${match['finderName']}');
  }
}
```

## ⚙️ Configuration

Edit `locate-lost-backend/.env`:
```env
FACE_MATCH_SERVICE_URL=http://localhost:5001
MATCH_THRESHOLD=85
```

## 🔍 Workflow

1. **User uploads parent/finder report** → Images saved to backend
2. **User clicks "Find Matches"** → Flutter calls Node.js API
3. **Node.js retrieves images** → From database
4. **Node.js calls Python service** → Face comparison happens
5. **Python returns results** → Match confidence scores
6. **Node.js creates match records** → In PostgreSQL database
7. **Node.js sends notifications** → To both users
8. **Flutter displays results** → List of matches

## 📊 Match Confidence Levels

- **90-100%**: Very high confidence - Almost certainly a match
- **85-89%**: High confidence - Likely a match
- **75-84%**: Medium confidence - Possible match
- **Below 75%**: Low confidence - Unlikely match

Adjust `minConfidence` based on your requirements!

## ❓ Common Issues

**"Python service not accessible"**
- Start Python service first
- Check if port 5001 is available
- Verify virtual environment is activated

**"No matches found"**
- Lower confidence threshold (try 70-75)
- Ensure images have clear faces
- Check image quality and lighting

**"Service too slow"**
- Normal: 1-3 seconds per comparison
- Consider background jobs for bulk matching

## 📚 More Documentation

- Full setup: `FACE_MATCHING_SETUP.md`
- Integration summary: `INTEGRATION_SUMMARY.md`
- Python service: `face-matching-service/README.md`

## ✅ Checklist

- [ ] Python service installed and running (port 5001)
- [ ] Node.js backend running (port 5000)
- [ ] Test script passes all checks
- [ ] PostgreSQL database connected
- [ ] `.env` configured correctly
- [ ] Flutter app updated with API endpoints

## 🚀 You're Ready!

Both services are now integrated. Your Flutter app can find face matches by calling the Node.js backend, which handles everything automatically!
