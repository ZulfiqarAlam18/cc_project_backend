# Flutter Developer Guide - Face Matching Integration

## 📋 Table of Contents
1. [Overview](#overview)
2. [Backend Setup](#backend-setup)
3. [Flutter Implementation](#flutter-implementation)
4. [Testing](#testing)
5. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

### What is Face Matching?
The face matching system compares photos from parent reports (missing children) with finder reports (found children) to automatically identify potential matches.

### Architecture
```
┌──────────────┐
│ Flutter App  │
│   (Mobile)   │
└──────┬───────┘
       │ HTTP Requests
       ↓
┌──────────────────┐
│  Node.js Backend │ ← Your main backend
│   Port: 5000     │
└──────┬───────────┘
       │ Internal Calls
       ↓
┌──────────────────────┐
│ Python Face Service  │ ← Face recognition engine
│     Port: 5001       │
└──────────────────────┘
```

**Important:** Your Flutter app ONLY talks to Node.js backend (port 5000). You never directly call the Python service.

---

## 🚀 Backend Setup

### Step 1: Start PostgreSQL Database
Make sure PostgreSQL is running on your machine (port 5432).

### Step 2: Start Python Face Matching Service (faceChecker1)

#### 2a. First Time Setup
```bash
# Navigate to faceChecker1 directory
cd "E:\latest\Ali_Raza_Backup\Work\Fyp\8th Semester\faceChecker1"

# Create Python virtual environment (if not already exists)
python -m venv .venv

# Activate virtual environment (Windows)
.venv\Scripts\activate

# Install dependencies
pip install flask
pip install face-recognition
pip install flask-cors
```

**Note:** Installing `face_recognition` may take 5-10 minutes. It requires:
- Python 3.7 or higher
- CMake (may need to install separately)
- Visual C++ Build Tools (may need to install from Visual Studio)

If you get errors, try:
```bash
pip install cmake
pip install dlib
pip install face-recognition
```

#### 2b. Start the faceChecker1 Service
```bash
# Make sure you're in faceChecker1 directory
cd "E:\latest\Ali_Raza_Backup\Work\Fyp\8th Semester\faceChecker1"

# Activate virtual environment
.venv\Scripts\activate

# Start the service
python face_match_server.py
```

You should see:
```
Starting Face Matching Service on port 5001
 * Running on http://0.0.0.0:5001
```

✅ **Keep this terminal window open!** The Python service must run continuously.

### Step 3: Start Node.js Backend

Open a NEW terminal:

```bash
# Navigate to backend directory
cd E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\locate-lost-backend

# Install dependencies (first time only)
npm install

# Start the backend
npm run dev
```

You should see:
```
✓ Database connected
✓ All services initialized successfully
LocateLost Backend server running on port 5000
```

✅ **Keep this terminal window open too!**

### Step 4: Verify Everything is Running

Open a THIRD terminal and test:

```bash
cd E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\locate-lost-backend
node test-face-matching.js
```

You should see green checkmarks ✓ for all tests.

---

## 📱 Flutter Implementation

### Step 1: Add HTTP Package

In your Flutter project's `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.1.0  # Add this line
```

Run:
```bash
flutter pub get
```

### Step 2: Create Face Matching Service Class

Create a new file: `lib/services/face_matching_service.dart`

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class FaceMatchingService {
  // IMPORTANT: Change this to your server's IP address
  // If testing on real device, use your computer's IP
  // If using emulator, use 10.0.2.2
  static const String baseUrl = 'http://localhost:5000/api/face-match';
  
  final String authToken;

  FaceMatchingService(this.authToken);

  /// Check if face matching service is available
  Future<bool> checkServiceHealth() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/health'),
        headers: {'Authorization': 'Bearer $authToken'},
      ).timeout(Duration(seconds: 5));
      
      return response.statusCode == 200;
    } catch (e) {
      print('Health check failed: $e');
      return false;
    }
  }

  /// Find matches for a parent report (missing child)
  Future<MatchResult> findMatchesForParent(String reportId, {int minConfidence = 85}) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/parent/$reportId/find-matches'),
        headers: {
          'Authorization': 'Bearer $authToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'minConfidence': minConfidence}),
      ).timeout(Duration(seconds: 120)); // 2 minutes timeout

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return MatchResult.fromJson(data);
      } else {
        throw Exception('Failed to find matches: ${response.body}');
      }
    } catch (e) {
      print('Error finding matches: $e');
      rethrow;
    }
  }

  /// Find matches for a finder report (found child)
  Future<MatchResult> findMatchesForFinder(String reportId, {int minConfidence = 85}) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/finder/$reportId/find-matches'),
        headers: {
          'Authorization': 'Bearer $authToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'minConfidence': minConfidence}),
      ).timeout(Duration(seconds: 120));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return MatchResult.fromJson(data);
      } else {
        throw Exception('Failed to find matches: ${response.body}');
      }
    } catch (e) {
      print('Error finding matches: $e');
      rethrow;
    }
  }

  /// Compare two specific reports
  Future<ComparisonResult> compareReports({
    required String parentReportId,
    required String finderReportId,
    int minConfidence = 85,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/compare-reports'),
        headers: {
          'Authorization': 'Bearer $authToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'parentReportId': parentReportId,
          'finderReportId': finderReportId,
          'minConfidence': minConfidence,
        }),
      ).timeout(Duration(seconds: 60));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return ComparisonResult.fromJson(data);
      } else {
        throw Exception('Failed to compare reports: ${response.body}');
      }
    } catch (e) {
      print('Error comparing reports: $e');
      rethrow;
    }
  }
}

/// Result model for match finding
class MatchResult {
  final bool success;
  final String message;
  final int matchesFound;
  final List<Match> matches;

  MatchResult({
    required this.success,
    required this.message,
    required this.matchesFound,
    required this.matches,
  });

  factory MatchResult.fromJson(Map<String, dynamic> json) {
    return MatchResult(
      success: json['success'] ?? false,
      message: json['message'] ?? '',
      matchesFound: json['matchesFound'] ?? 0,
      matches: (json['matches'] as List?)
              ?.map((m) => Match.fromJson(m))
              .toList() ??
          [],
    );
  }
}

/// Individual match model
class Match {
  final String matchId;
  final double confidence;
  final String? finderReportId;
  final String? parentReportId;
  final String? finderName;
  final String? parentName;
  final String? finderPhone;
  final String? childName;
  final String? parentImageUrl;
  final String? finderImageUrl;
  final String status;

  Match({
    required this.matchId,
    required this.confidence,
    this.finderReportId,
    this.parentReportId,
    this.finderName,
    this.parentName,
    this.finderPhone,
    this.childName,
    this.parentImageUrl,
    this.finderImageUrl,
    required this.status,
  });

  factory Match.fromJson(Map<String, dynamic> json) {
    return Match(
      matchId: json['matchId'] ?? '',
      confidence: (json['confidence'] ?? 0).toDouble(),
      finderReportId: json['finderReportId'],
      parentReportId: json['parentReportId'],
      finderName: json['finderName'],
      parentName: json['parentName'],
      finderPhone: json['finderPhone'],
      childName: json['childName'],
      parentImageUrl: json['parentImageUrl'],
      finderImageUrl: json['finderImageUrl'],
      status: json['status'] ?? 'PENDING',
    );
  }
}

/// Result model for direct comparison
class ComparisonResult {
  final bool success;
  final bool matched;
  final String? matchId;
  final double confidence;
  final String? parentImageUrl;
  final String? finderImageUrl;
  final String message;

  ComparisonResult({
    required this.success,
    required this.matched,
    this.matchId,
    required this.confidence,
    this.parentImageUrl,
    this.finderImageUrl,
    required this.message,
  });

  factory ComparisonResult.fromJson(Map<String, dynamic> json) {
    return ComparisonResult(
      success: json['success'] ?? false,
      matched: json['matched'] ?? false,
      matchId: json['matchId'],
      confidence: (json['confidence'] ?? 0).toDouble(),
      parentImageUrl: json['parentImageUrl'],
      finderImageUrl: json['finderImageUrl'],
      message: json['message'] ?? '',
    );
  }
}
```

### Step 3: Create UI to Trigger Face Matching

Create a widget to find matches. Example: `lib/screens/find_matches_screen.dart`

```dart
import 'package:flutter/material.dart';
import '../services/face_matching_service.dart';

class FindMatchesScreen extends StatefulWidget {
  final String reportId;
  final bool isParentReport; // true for parent, false for finder
  final String authToken;

  const FindMatchesScreen({
    Key? key,
    required this.reportId,
    required this.isParentReport,
    required this.authToken,
  }) : super(key: key);

  @override
  State<FindMatchesScreen> createState() => _FindMatchesScreenState();
}

class _FindMatchesScreenState extends State<FindMatchesScreen> {
  bool _isLoading = false;
  MatchResult? _matchResult;
  String? _error;

  Future<void> _findMatches() async {
    setState(() {
      _isLoading = true;
      _error = null;
      _matchResult = null;
    });

    try {
      final service = FaceMatchingService(widget.authToken);
      
      // Check if service is available first
      final isHealthy = await service.checkServiceHealth();
      if (!isHealthy) {
        throw Exception('Face matching service is not available');
      }

      // Find matches based on report type
      final result = widget.isParentReport
          ? await service.findMatchesForParent(widget.reportId)
          : await service.findMatchesForFinder(widget.reportId);

      setState(() {
        _matchResult = result;
        _isLoading = false;
      });

      // Show success message
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Found ${result.matchesFound} potential matches!'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Find Matches'),
      ),
      body: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Find Matches Button
            ElevatedButton.icon(
              onPressed: _isLoading ? null : _findMatches,
              icon: _isLoading
                  ? SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : Icon(Icons.search),
              label: Text(_isLoading ? 'Searching...' : 'Find Matches'),
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.all(16),
                textStyle: TextStyle(fontSize: 18),
              ),
            ),
            
            SizedBox(height: 16),

            // Info text
            if (_isLoading)
              Padding(
                padding: EdgeInsets.all(8.0),
                child: Text(
                  'This may take 1-2 minutes depending on the number of reports...',
                  style: TextStyle(color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
              ),

            // Error message
            if (_error != null)
              Card(
                color: Colors.red[50],
                child: Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Text(
                    _error!,
                    style: TextStyle(color: Colors.red),
                  ),
                ),
              ),

            // Results
            if (_matchResult != null && !_isLoading)
              Expanded(
                child: _matchResult!.matchesFound == 0
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.search_off, size: 64, color: Colors.grey),
                            SizedBox(height: 16),
                            Text(
                              'No matches found',
                              style: TextStyle(fontSize: 18, color: Colors.grey),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        itemCount: _matchResult!.matches.length,
                        itemBuilder: (context, index) {
                          final match = _matchResult!.matches[index];
                          return _buildMatchCard(match);
                        },
                      ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildMatchCard(Match match) {
    // Confidence color based on score
    Color confidenceColor;
    if (match.confidence >= 90) {
      confidenceColor = Colors.green;
    } else if (match.confidence >= 80) {
      confidenceColor = Colors.orange;
    } else {
      confidenceColor = Colors.red;
    }

    return Card(
      margin: EdgeInsets.only(bottom: 16),
      elevation: 4,
      child: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Confidence badge
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Match ID: ${match.matchId.substring(0, 8)}...',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: confidenceColor,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${match.confidence.toStringAsFixed(1)}% Match',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            
            SizedBox(height: 12),
            
            // Contact information
            if (widget.isParentReport) ...[
              // Showing finder info to parent
              if (match.finderName != null)
                _buildInfoRow('Finder', match.finderName!),
              if (match.finderPhone != null)
                _buildInfoRow('Phone', match.finderPhone!),
            ] else ...[
              // Showing parent info to finder
              if (match.childName != null)
                _buildInfoRow('Child Name', match.childName!),
              if (match.parentName != null)
                _buildInfoRow('Parent', match.parentName!),
            ],
            
            SizedBox(height: 12),
            
            // View Details Button
            ElevatedButton(
              onPressed: () {
                // Navigate to match details screen
                // You'll implement this based on your app structure
                _showMatchDetails(match);
              },
              child: Text('View Details'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: EdgeInsets.only(bottom: 8.0),
      child: Row(
        children: [
          Text(
            '$label: ',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          Text(value),
        ],
      ),
    );
  }

  void _showMatchDetails(Match match) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Match Details'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Confidence: ${match.confidence.toStringAsFixed(2)}%'),
              SizedBox(height: 8),
              Text('Status: ${match.status}'),
              SizedBox(height: 16),
              // You can add images here if needed
              if (match.parentImageUrl != null) ...[
                Text('Parent Image:', style: TextStyle(fontWeight: FontWeight.bold)),
                SizedBox(height: 8),
                Image.network(match.parentImageUrl!, height: 150),
              ],
              SizedBox(height: 16),
              if (match.finderImageUrl != null) ...[
                Text('Finder Image:', style: TextStyle(fontWeight: FontWeight.bold)),
                SizedBox(height: 8),
                Image.network(match.finderImageUrl!, height: 150),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Close'),
          ),
        ],
      ),
    );
  }
}
```

### Step 4: Navigate to Find Matches Screen

Add a button in your report details screen:

```dart
// In your parent report or finder report details screen
ElevatedButton.icon(
  onPressed: () {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => FindMatchesScreen(
          reportId: report.id,
          isParentReport: true, // or false for finder report
          authToken: yourAuthToken,
        ),
      ),
    );
  },
  icon: Icon(Icons.face),
  label: Text('Find Matches'),
),
```

---

## 🧪 Testing

### Test Flow:

1. **Create a Parent Report** with clear face photos
2. **Create a Finder Report** with photos of the same person
3. **Click "Find Matches"** on either report
4. **Wait 1-2 minutes** for processing
5. **View Results** - Should show high confidence match (90%+)

### Testing Tips:

- Use clear, front-facing photos
- Ensure good lighting
- Avoid sunglasses or face coverings
- Test with different confidence thresholds (75%, 85%, 90%)

---

## 🔧 Troubleshooting

### Issue: "Face matching service is not available"

**Solution:**
1. Check Python service is running (Terminal 1)
2. Test: Open browser → `http://localhost:5001/health`
3. Should see: `{"status": "healthy", "service": "face-matching-api"}`

### Issue: "Connection refused" or "Network error"

**Solution:**
1. If testing on real device, change `baseUrl` in Flutter:
   ```dart
   // Find your computer's IP address
   // Windows: ipconfig
   // Use that IP instead of localhost
   static const String baseUrl = 'http://192.168.1.100:5000/api/face-match';
   ```

2. If using Android emulator:
   ```dart
   static const String baseUrl = 'http://10.0.2.2:5000/api/face-match';
   ```

3. If using iOS simulator:
   ```dart
   static const String baseUrl = 'http://localhost:5000/api/face-match';
   ```

### Issue: "No matches found" but images look similar

**Solution:**
1. Lower the confidence threshold:
   ```dart
   await service.findMatchesForParent(reportId, minConfidence: 75);
   ```

2. Check image quality - needs clear faces
3. Check backend logs for errors

### Issue: Request timeout

**Solution:**
1. Increase timeout duration:
   ```dart
   .timeout(Duration(seconds: 180)); // 3 minutes
   ```

2. Check if backend is busy processing other requests

### Issue: Python service crashes

**Solution:**
1. Check error logs in Python terminal
2. Restart service:
   ```bash
   venv\Scripts\activate
   python face_match_api.py
   ```

---

## 📝 Important Notes

### For Production:
1. Change hardcoded URLs to environment variables
2. Add proper error handling
3. Implement retry logic
4. Add loading indicators
5. Cache results to avoid redundant API calls
6. Consider background processing for slow connections

### Security:
- Always use HTTPS in production
- Never commit auth tokens to Git
- Validate user permissions before allowing match requests
- Implement rate limiting

### Performance:
- Each comparison takes 1-3 seconds
- Comparing against 100 reports ≈ 2-3 minutes
- Consider showing progress indicator
- Implement pagination for results

---

## 🎓 Learning Resources

### Understanding the Code:
- The Flutter app calls REST APIs (like calling a website)
- `async/await` handles waiting for responses
- `try/catch` handles errors
- JSON is used to send/receive data

### If You Get Stuck:
1. Check terminal logs (both Python and Node.js)
2. Use `print()` statements to debug
3. Test APIs using Postman first
4. Read error messages carefully

---

## ✅ Checklist for Your First Implementation

- [ ] Python service running (Terminal 1)
- [ ] Node.js backend running (Terminal 2)
- [ ] `test-face-matching.js` passes all checks
- [ ] Created `face_matching_service.dart` file
- [ ] Created `find_matches_screen.dart` file
- [ ] Updated `baseUrl` for your testing environment
- [ ] Added navigation to Find Matches screen
- [ ] Tested with sample reports
- [ ] Successfully found at least one match

---

## 🚀 Ready to Start!

1. Start both backend services
2. Create the service file
3. Create the UI screen
4. Test with real data
5. Iterate and improve!

If you have questions, check the logs first, then review this guide. Good luck! 🎉
