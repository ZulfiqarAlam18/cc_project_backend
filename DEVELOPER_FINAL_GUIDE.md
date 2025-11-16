# 🚀 Complete Setup Guide - Face Matching Integration

**For:** Junior Developer  
**Project:** LocateLost - Face Matching Feature  
**Date:** November 16, 2025

---

## 📋 What You're Building

A face matching system that compares photos of missing children (parent reports) with found children (finder reports) to automatically find matches.

**Flow:**
```
Flutter App → Node.js Backend → faceChecker1 (Python) → Face Recognition
```

---

## 🎯 Step 1: Backend Setup

### 1.1 Start PostgreSQL Database
Make sure PostgreSQL is running on `localhost:5432`

### 1.2 Setup faceChecker1 (Python Face Matching Service)

```bash
# Navigate to faceChecker1 directory
cd "E:\latest\Ali_Raza_Backup\Work\Fyp\8th Semester\faceChecker1"

# Create virtual environment (first time only)
python -m venv .venv

# Activate virtual environment
.venv\Scripts\activate

# Install dependencies (first time only)
pip install flask
pip install face-recognition
pip install flask-cors

# Start the service
python face_match_server.py
```

**Expected Output:**
```
 * Running on http://0.0.0.0:5001
 * Running on http://127.0.0.1:5001
```

✅ **Keep this terminal open!** This service must run continuously.

### 1.3 Start Node.js Backend

Open a **NEW terminal**:

```bash
# Navigate to backend directory
cd "E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\locate-lost-backend"

# Install dependencies (first time only)
npm install

# Start the backend
npm run dev
```

**Expected Output:**
```
✅ Database connected
✅ All services initialized successfully
LocateLost Backend server running on port 5000
```

✅ **Keep this terminal open too!**

### 1.4 Verify Everything Works

Open a **THIRD terminal**:

```bash
cd "E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\locate-lost-backend"
node test-face-matching.js
```

**Expected:** Green checkmarks (✓) for all tests.

---

## 📱 Step 2: Flutter Implementation

### 2.1 Add HTTP Package

In `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.1.0
```

Run:
```bash
flutter pub get
```

### 2.2 Create Face Matching Service

Create file: `lib/services/face_matching_service.dart`

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class FaceMatchingService {
  // IMPORTANT: Update this URL based on your testing environment
  // - Emulator: http://10.0.2.2:5000/api/face-match
  // - Real device: http://YOUR_COMPUTER_IP:5000/api/face-match
  // - iOS Simulator: http://localhost:5000/api/face-match
  static const String baseUrl = 'http://10.0.2.2:5000/api/face-match';
  
  final String authToken;

  FaceMatchingService(this.authToken);

  /// Find matches for a parent report (missing child)
  Future<MatchResult> findMatchesForParent(
    String reportId, {
    int minConfidence = 85,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/parent/$reportId/find-matches'),
        headers: {
          'Authorization': 'Bearer $authToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'minConfidence': minConfidence}),
      ).timeout(Duration(seconds: 120));

      if (response.statusCode == 200) {
        return MatchResult.fromJson(jsonDecode(response.body));
      }
      throw Exception('Failed to find matches: ${response.body}');
    } catch (e) {
      print('Error finding matches: $e');
      rethrow;
    }
  }

  /// Find matches for a finder report (found child)
  Future<MatchResult> findMatchesForFinder(
    String reportId, {
    int minConfidence = 85,
  }) async {
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
        return MatchResult.fromJson(jsonDecode(response.body));
      }
      throw Exception('Failed to find matches: ${response.body}');
    } catch (e) {
      print('Error finding matches: $e');
      rethrow;
    }
  }
}

// Data Models
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

class Match {
  final String matchId;
  final double confidence;
  final String? finderReportId;
  final String? parentReportId;
  final String? finderName;
  final String? parentName;
  final String? finderPhone;
  final String? childName;

  Match({
    required this.matchId,
    required this.confidence,
    this.finderReportId,
    this.parentReportId,
    this.finderName,
    this.parentName,
    this.finderPhone,
    this.childName,
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
    );
  }
}
```

### 2.3 Create Find Matches Screen

Create file: `lib/screens/find_matches_screen.dart`

```dart
import 'package:flutter/material.dart';
import '../services/face_matching_service.dart';

class FindMatchesScreen extends StatefulWidget {
  final String reportId;
  final bool isParentReport;
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
    });

    try {
      final service = FaceMatchingService(widget.authToken);
      
      final result = widget.isParentReport
          ? await service.findMatchesForParent(widget.reportId)
          : await service.findMatchesForFinder(widget.reportId);

      setState(() {
        _matchResult = result;
        _isLoading = false;
      });

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
              ),
            ),
            
            SizedBox(height: 16),

            if (_isLoading)
              Text(
                'This may take 1-2 minutes...',
                style: TextStyle(color: Colors.grey),
                textAlign: TextAlign.center,
              ),

            if (_error != null)
              Card(
                color: Colors.red[50],
                child: Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Text(_error!, style: TextStyle(color: Colors.red)),
                ),
              ),

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
    Color confidenceColor = match.confidence >= 90
        ? Colors.green
        : match.confidence >= 80
            ? Colors.orange
            : Colors.red;

    return Card(
      margin: EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Match Found',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
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
            if (widget.isParentReport && match.finderName != null)
              Text('Finder: ${match.finderName}'),
            if (widget.isParentReport && match.finderPhone != null)
              Text('Phone: ${match.finderPhone}'),
            if (!widget.isParentReport && match.childName != null)
              Text('Child: ${match.childName}'),
            if (!widget.isParentReport && match.parentName != null)
              Text('Parent: ${match.parentName}'),
          ],
        ),
      ),
    );
  }
}
```

### 2.4 Add Navigation Button

In your report details screen, add:

```dart
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
)
```

---

## 🧪 Step 3: Testing

### 3.1 Test Flow

1. **Create a parent report** with clear face photos
2. **Create a finder report** with photos of the same person
3. **Click "Find Matches"** on either report
4. **Wait 1-2 minutes**
5. **View results** - Should show high confidence match

### 3.2 Tips for Better Results

✅ **Do:**
- Use clear, front-facing photos
- Ensure good lighting
- Avoid sunglasses or masks
- Use high-quality images

❌ **Don't:**
- Use blurry photos
- Use side profile shots
- Use photos with multiple faces
- Use very small images

### 3.3 Adjust Confidence Threshold

If not finding matches:
```dart
// Lower the threshold
await service.findMatchesForParent(reportId, minConfidence: 75);
```

---

## 🔧 Troubleshooting

### Issue 1: "Connection refused"

**Solution:**
```dart
// Change baseUrl based on device:

// Android Emulator:
static const String baseUrl = 'http://10.0.2.2:5000/api/face-match';

// iOS Simulator:
static const String baseUrl = 'http://localhost:5000/api/face-match';

// Real Device (find your computer's IP with 'ipconfig' on Windows):
static const String baseUrl = 'http://192.168.1.XXX:5000/api/face-match';
```

### Issue 2: faceChecker1 not starting

**Solution:**
```bash
# Make sure Python virtual environment exists
cd "E:\latest\Ali_Raza_Backup\Work\Fyp\8th Semester\faceChecker1"
python -m venv .venv

# Activate and install dependencies
.venv\Scripts\activate
pip install flask face-recognition flask-cors

# Start service
python face_match_server.py
```

### Issue 3: Node.js backend errors

**Solution:**
```bash
# Reinstall dependencies
cd "E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\locate-lost-backend"
rm -rf node_modules
npm install

# Regenerate Prisma client
npx prisma generate

# Start backend
npm run dev
```

### Issue 4: No matches found

**Solution:**
1. Lower confidence threshold to 70-75
2. Check if images have clear faces
3. Ensure images are accessible
4. Check backend logs for errors

---

## 📊 Understanding Match Confidence

- **90-100%** - Very high confidence (Almost certainly same person)
- **85-89%** - High confidence (Likely same person)
- **75-84%** - Medium confidence (Possibly same person)
- **Below 75%** - Low confidence (Unlikely same person)

Default threshold is **85%** for good balance.

---

## 🎓 How It Works

### Backend Flow:

1. **Flutter app** calls Node.js API with report ID
2. **Node.js** retrieves image URLs from database
3. **Node.js** downloads images to temporary files
4. **Node.js** sends files to faceChecker1 service
5. **faceChecker1** (Python) compares faces using face_recognition library
6. **faceChecker1** returns match result (true/false)
7. **Node.js** calculates confidence and creates match record
8. **Node.js** sends notifications to users
9. **Node.js** returns results to Flutter app

### Database:

When match is found:
- Creates record in `matched_cases` table
- Links parent report and finder report
- Stores confidence percentage
- Creates notifications for both users

---

## ✅ Pre-Launch Checklist

Before testing, ensure:

- [ ] PostgreSQL running (port 5432)
- [ ] faceChecker1 running (port 5001) - Terminal 1
- [ ] Node.js backend running (port 5000) - Terminal 2
- [ ] `test-face-matching.js` passes all tests
- [ ] Flutter app has correct baseUrl
- [ ] Auth token is valid
- [ ] Test reports created with clear images

---

## 🚀 Quick Start Commands

### Option 1: Manual Start (Recommended for learning)

**Terminal 1:**
```bash
cd "E:\latest\Ali_Raza_Backup\Work\Fyp\8th Semester\faceChecker1"
.venv\Scripts\activate
python face_match_server.py
```

**Terminal 2:**
```bash
cd "E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\locate-lost-backend"
npm run dev
```

**Terminal 3 (Test):**
```bash
cd "E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\locate-lost-backend"
node test-face-matching.js
```

### Option 2: Batch Script (Windows)

Double-click:
```
E:\latest\Ali_Raza_Backup\Work\Fyp\Backend\start-services.bat
```

---

## 📞 Need Help?

1. **Check terminal logs** - Both Python and Node.js
2. **Run test script** - `node test-face-matching.js`
3. **Review error messages** - They usually tell you what's wrong
4. **Check this guide again** - Step-by-step
5. **Ask senior developer** - With specific error messages

---

## 🎯 Success Criteria

You've successfully implemented face matching when:

✅ Both services start without errors  
✅ Test script passes all checks  
✅ Can create parent and finder reports  
✅ "Find Matches" button works  
✅ Matches appear with confidence scores  
✅ Notifications are sent to users  

---

## 📚 Additional Resources

- **Full Flutter Guide:** `FLUTTER_DEVELOPER_GUIDE.md`
- **Integration Details:** `INTEGRATION_SUMMARY.md`
- **Quick Reference:** `QUICK_START.md`
- **faceChecker1 Confirmation:** `USING_FACECHECKER1.md`

---

**Good luck! You've got this! 🎉**

*Remember: If you get stuck, check the logs first, then review this guide. Most issues are simple configuration problems.*
