# LocateLost Backend API Documentation

## Overview
LocateLost is a missing children tracking application that uses facial recognition to match lost children with found children. This documentation provides comprehensive details for integrating the backend API with Flutter applications.

## Base Information
- **Base URL**: `http://localhost:5000` (Development) or your deployed server URL  
- **API Version**: v1.0.0
- **Protocol**: REST API with JSON responses
- **WebSocket Support**: Yes (for real-time notifications and location sharing)

## Table of Contents
1. [Authentication](#authentication)
2. [User Management](#user-management)
3. [Parent Reports](#parent-reports)
4. [Finder Reports](#finder-reports)
5. [Matches](#matches)
6. [Notifications](#notifications)
7. [Dashboard](#dashboard)
8. [Data Models](#data-models)
9. [Error Handling](#error-handling)
10. [Flutter Integration Guide](#flutter-integration-guide)

---

## Authentication

### Base Route: `/api/auth`

#### 1. User Registration
**POST** `/api/auth/signup`
- **Description**: Register a new user account
- **Access**: Public
- **Content-Type**: `application/json`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "password": "securePassword123",
  "role": "PARENT" // PARENT, FINDER, ADMIN, POLICE
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+1234567890",
      "role": "PARENT",
      "isVerified": false,
      "createdAt": "2025-01-15T10:30:00.000Z"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

#### 2. User Login
**POST** `/api/auth/login`
- **Description**: Authenticate user and get tokens
- **Access**: Public
- **Content-Type**: `application/json`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+1234567890",
      "role": "PARENT",
      "isVerified": false,
      "profileImage": null
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

#### 3. User Logout
**POST** `/api/auth/logout`
- **Description**: Logout user and invalidate refresh token
- **Access**: Private (Bearer Token Required)
- **Headers**: `Authorization: Bearer {accessToken}`

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## User Management

### Base Route: `/api/users`

#### 1. Get User Profile
**GET** `/api/users/profile`
- **Description**: Get current user's profile information
- **Access**: Private
- **Headers**: `Authorization: Bearer {accessToken}`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+1234567890",
      "role": "PARENT",
      "profileImage": "http://localhost:5000/uploads/images/profile.jpg",
      "isVerified": false,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

#### 2. Update Profile
**PUT** `/api/users/profile`
- **Description**: Update user profile information
- **Access**: Private
- **Content-Type**: `application/json`

**Request Body:**
```json
{
  "name": "John Updated",
  "phone": "+0987654321"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Updated",
      "email": "john.doe@example.com",
      "phone": "+0987654321",
      "role": "PARENT",
      "profileImage": null,
      "isVerified": false,
      "updatedAt": "2025-01-15T11:30:00.000Z"
    }
  }
}
```

#### 3. Upload Profile Image
**POST** `/api/users/profile/image`
- **Description**: Upload or update profile image
- **Access**: Private
- **Content-Type**: `multipart/form-data`

**Form Data:**
- `profileImage`: Image file (JPEG, PNG, GIF - Max 5MB)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile image uploaded successfully",
  "data": {
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+1234567890",
      "role": "PARENT",
      "profileImage": "http://localhost:5000/uploads/images/profile_12345.jpg",
      "isVerified": false,
      "updatedAt": "2025-01-15T12:30:00.000Z"
    }
  }
}
```

#### 4. Change Password
**PUT** `/api/users/password`
- **Description**: Change user password
- **Access**: Private
- **Content-Type**: `application/json`

**Request Body:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

#### 5. Delete Account
**DELETE** `/api/users/account`
- **Description**: Delete/deactivate user account
- **Access**: Private
- **Content-Type**: `application/json`

**Request Body:**
```json
{
  "password": "currentPassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

---

## Parent Reports

### Base Route: `/api/reports/parent`

#### 1. Create Parent Report
**POST** `/api/reports/parent`
- **Description**: Create a new missing child report
- **Access**: Private
- **Content-Type**: `multipart/form-data`

**Form Data:**
- `childName`: string (required)
- `fatherName`: string (required)
- `placeLost`: string (optional)
- `gender`: string (required) - "MALE", "FEMALE", "OTHER"
- `lostTime`: string (required) - ISO date string
- `additionalDetails`: string (optional)
- `contactNumber`: string (required)
- `emergency`: string (required)
- `images`: file[] (required) - 1-5 image files

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Parent report created successfully",
  "data": {
    "report": {
      "id": "uuid",
      "childName": "Alice Doe",
      "fatherName": "John Doe",
      "placeLost": "Central Park",
      "gender": "FEMALE",
      "lostTime": "2025-01-15T14:30:00.000Z",
      "additionalDetails": "Was wearing blue dress",
      "contactNumber": "+1234567890",
      "emergency": "+1234567891",
      "status": "ACTIVE",
      "latitude": 0.0,
      "longitude": 0.0,
      "locationName": null,
      "createdAt": "2025-01-15T15:30:00.000Z",
      "images": [
        {
          "id": "uuid",
          "imageUrl": "http://localhost:5000/uploads/images/image_12345.jpg",
          "fileName": "child_photo.jpg",
          "fileSize": 245760,
          "mimeType": "image/jpeg"
        }
      ],
      "parent": {
        "id": "uuid",
        "name": "John Doe",
        "phone": "+1234567890",
        "email": "john.doe@example.com"
      }
    }
  }
}
```

#### 2. Get All Parent Reports
**GET** `/api/reports/parent`
- **Description**: Get all parent reports with filtering and pagination
- **Access**: Private
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 10)
  - `status`: string (ACTIVE, CLOSED, RESOLVED, CANCELLED)
  - `search`: string (search in childName, fatherName, etc.)
  - `sortBy`: string (default: "createdAt")
  - `sortOrder`: string (asc, desc - default: "desc")

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "id": "uuid",
        "childName": "Alice Doe",
        "fatherName": "John Doe",
        "gender": "FEMALE",
        "placeLost": "Central Park",
        "lostTime": "2025-01-15T14:30:00.000Z",
        "status": "ACTIVE",
        "createdAt": "2025-01-15T15:30:00.000Z",
        "images": [
          {
            "id": "uuid",
            "imageUrl": "http://localhost:5000/uploads/images/image_12345.jpg"
          }
        ],
        "parent": {
          "id": "uuid",
          "name": "John Doe",
          "phone": "+1234567890"
        },
        "_count": {
          "matchesAsParent": 2
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    }
  }
}
```

#### 3. Get Parent Report by ID
**GET** `/api/reports/parent/{reportId}`
- **Description**: Get specific parent report details
- **Access**: Private
- **Path Parameters**: `reportId` (UUID)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "report": {
      "id": "uuid",
      "childName": "Alice Doe",
      "fatherName": "John Doe",
      "placeLost": "Central Park",
      "gender": "FEMALE",
      "lostTime": "2025-01-15T14:30:00.000Z",
      "additionalDetails": "Was wearing blue dress",
      "contactNumber": "+1234567890",
      "emergency": "+1234567891",
      "status": "ACTIVE",
      "latitude": 0.0,
      "longitude": 0.0,
      "createdAt": "2025-01-15T15:30:00.000Z",
      "images": [
        {
          "id": "uuid",
          "imageUrl": "http://localhost:5000/uploads/images/image_12345.jpg",
          "fileName": "child_photo.jpg"
        }
      ],
      "parent": {
        "id": "uuid",
        "name": "John Doe",
        "phone": "+1234567890",
        "email": "john.doe@example.com"
      },
      "matchesAsParent": [
        {
          "id": "uuid",
          "matchConfidence": 0.85,
          "status": "PENDING",
          "createdAt": "2025-01-15T16:30:00.000Z",
          "finderCase": {
            "id": "uuid",
            "childName": "Unknown",
            "placeFound": "Downtown Mall",
            "foundTime": "2025-01-15T16:00:00.000Z"
          }
        }
      ]
    }
  }
}
```

#### 4. Get My Parent Reports
**GET** `/api/reports/parent/my`
- **Description**: Get current user's parent reports
- **Access**: Private
- **Query Parameters**: Same as "Get All Parent Reports"

---

## Finder Reports

### Base Route: `/api/reports/finder`

#### 1. Create Finder Report
**POST** `/api/reports/finder`
- **Description**: Create a new found child report
- **Access**: Private
- **Content-Type**: `multipart/form-data`

**Form Data:**
- `childName`: string (optional)
- `fatherName`: string (optional)
- `placeFound`: string (optional)
- `gender`: string (optional) - "MALE", "FEMALE", "OTHER"
- `foundTime`: string (optional) - ISO date string (defaults to current time)
- `additionalDetails`: string (optional)
- `contactNumber`: string (optional)
- `emergency`: string (optional)
- `images`: file[] (required) - 1-5 image files

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Finder report created successfully",
  "data": {
    "report": {
      "id": "uuid",
      "childName": null,
      "fatherName": null,
      "placeFound": "Downtown Mall",
      "gender": "FEMALE",
      "foundTime": "2025-01-15T16:00:00.000Z",
      "additionalDetails": "Child found crying",
      "contactNumber": "+0987654321",
      "emergency": null,
      "status": "ACTIVE",
      "latitude": 0.0,
      "longitude": 0.0,
      "createdAt": "2025-01-15T16:30:00.000Z",
      "images": [
        {
          "id": "uuid",
          "imageUrl": "http://localhost:5000/uploads/images/found_12345.jpg",
          "fileName": "found_child.jpg"
        }
      ],
      "finder": {
        "id": "uuid",
        "name": "Jane Smith",
        "phone": "+0987654321"
      }
    }
  }
}
```

#### 2. Get All Finder Reports
**GET** `/api/reports/finder`
- **Description**: Get all finder reports with filtering and pagination
- **Access**: Private
- **Query Parameters**: Same as parent reports

#### 3. Get Finder Report by ID
**GET** `/api/reports/finder/{reportId}`
- **Description**: Get specific finder report details
- **Access**: Private

#### 4. Get My Finder Reports
**GET** `/api/reports/finder/my`
- **Description**: Get current user's finder reports
- **Access**: Private

---

## Matches

### Base Route: `/api/matches`

#### 1. Get All Matches
**GET** `/api/matches`
- **Description**: Get all matched cases with filtering
- **Access**: Private
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 10)
  - `status`: string (PENDING, MATCHED, CLOSED, REJECTED)
  - `minSimilarity`: number (default: 0.7)
  - `sortBy`: string (default: "createdAt")
  - `sortOrder`: string (asc, desc - default: "desc")

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "id": "uuid",
        "matchConfidence": 0.85,
        "status": "PENDING",
        "notificationSent": true,
        "notes": null,
        "createdAt": "2025-01-15T16:30:00.000Z",
        "parentCase": {
          "id": "uuid",
          "childName": "Alice Doe",
          "gender": "FEMALE",
          "placeLost": "Central Park",
          "lostTime": "2025-01-15T14:30:00.000Z",
          "status": "ACTIVE",
          "parent": {
            "id": "uuid",
            "name": "John Doe",
            "phone": "+1234567890"
          },
          "images": [
            {
              "imageUrl": "http://localhost:5000/uploads/images/image_12345.jpg"
            }
          ]
        },
        "finderCase": {
          "id": "uuid",
          "childName": null,
          "gender": "FEMALE",
          "placeFound": "Downtown Mall",
          "foundTime": "2025-01-15T16:00:00.000Z",
          "status": "ACTIVE",
          "finder": {
            "id": "uuid",
            "name": "Jane Smith",
            "phone": "+0987654321"
          },
          "images": [
            {
              "imageUrl": "http://localhost:5000/uploads/images/found_12345.jpg"
            }
          ]
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 15,
      "pages": 2
    }
  }
}
```

#### 2. Get Match by ID
**GET** `/api/matches/{matchId}`
- **Description**: Get specific match details
- **Access**: Private
- **Path Parameters**: `matchId` (UUID)

#### 3. Update Match Status
**PUT** `/api/matches/{matchId}/status`
- **Description**: Update match status (Admin only)
- **Access**: Private (Admin)
- **Content-Type**: `application/json`

**Request Body:**
```json
{
  "status": "MATCHED", // PENDING, MATCHED, CLOSED, REJECTED
  "notes": "Verified by admin after contact confirmation"
}
```

---

## Notifications

### Base Route: `/api/notifications`

#### 1. Get User Notifications
**GET** `/api/notifications`
- **Description**: Get user's notifications with pagination
- **Access**: Private
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 20)
  - `unreadOnly`: boolean (default: false)
  - `type`: string (MATCH_FOUND, CASE_UPDATE, SYSTEM_ALERT, etc.)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "MATCH_FOUND",
        "title": "Potential Match Found",
        "message": "A potential match has been found for your missing child report",
        "data": {
          "matchId": "uuid",
          "reportId": "uuid"
        },
        "isRead": false,
        "createdAt": "2025-01-15T16:30:00.000Z",
        "readAt": null
      }
    ],
    "unreadCount": 3,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "pages": 1
    }
  }
}
```

#### 2. Mark Notification as Read
**PUT** `/api/notifications/{notificationId}/read`
- **Description**: Mark specific notification as read
- **Access**: Private

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

#### 3. Mark All Notifications as Read
**PUT** `/api/notifications/mark-all-read`
- **Description**: Mark all user notifications as read
- **Access**: Private

#### 4. Delete Notification
**DELETE** `/api/notifications/{notificationId}`
- **Description**: Delete specific notification
- **Access**: Private

---

## Dashboard

### Base Route: `/api/dashboard`

#### 1. Get Dashboard Statistics
**GET** `/api/dashboard/stats`
- **Description**: Get user-specific or admin dashboard statistics
- **Access**: Private

**Response (200 OK - User):**
```json
{
  "success": true,
  "data": {
    "stats": {
      "myReports": {
        "parentReports": 3,
        "finderReports": 1,
        "activeReports": 2,
        "resolvedReports": 1
      },
      "matches": {
        "totalMatches": 2,
        "pendingMatches": 1,
        "confirmedMatches": 1
      },
      "notifications": {
        "unreadCount": 3,
        "totalCount": 15
      }
    }
  }
}
```

**Response (200 OK - Admin):**
```json
{
  "success": true,
  "data": {
    "stats": {
      "overview": {
        "totalUsers": 150,
        "totalReports": 89,
        "totalMatches": 23,
        "activeReports": 45,
        "successRate": 25.84
      },
      "reports": {
        "parentReports": {
          "total": 67,
          "active": 32,
          "resolved": 17
        },
        "finderReports": {
          "total": 22,
          "active": 13
        }
      },
      "matches": {
        "total": 23,
        "confirmed": 17,
        "pending": 6
      },
      "recent": {
        "newUsers": 12,
        "newReports": 8
      }
    }
  }
}
```

---

## Data Models

### User
```json
{
  "id": "string (UUID)",
  "name": "string",
  "email": "string",
  "phone": "string",
  "role": "PARENT | FINDER | ADMIN | POLICE",
  "profileImage": "string (URL) | null",
  "isVerified": "boolean",
  "isActive": "boolean",
  "lastLogin": "string (ISO date) | null",
  "createdAt": "string (ISO date)",
  "updatedAt": "string (ISO date)"
}
```

### Parent Report
```json
{
  "id": "string (UUID)",
  "childName": "string",
  "fatherName": "string",
  "placeLost": "string | null",
  "gender": "MALE | FEMALE | OTHER",
  "lostTime": "string (ISO date)",
  "additionalDetails": "string | null",
  "contactNumber": "string",
  "emergency": "string",
  "status": "ACTIVE | CLOSED | RESOLVED | CANCELLED",
  "latitude": "number",
  "longitude": "number",
  "locationName": "string | null",
  "parentId": "string (UUID)",
  "createdAt": "string (ISO date)",
  "updatedAt": "string (ISO date)"
}
```

### Finder Report
```json
{
  "id": "string (UUID)",
  "childName": "string | null",
  "fatherName": "string | null",
  "placeFound": "string | null",
  "gender": "MALE | FEMALE | OTHER | null",
  "foundTime": "string (ISO date)",
  "additionalDetails": "string | null",
  "contactNumber": "string | null",
  "emergency": "string | null",
  "status": "ACTIVE | CLOSED | RESOLVED | CANCELLED",
  "latitude": "number",
  "longitude": "number",
  "locationName": "string | null",
  "finderId": "string (UUID)",
  "createdAt": "string (ISO date)",
  "updatedAt": "string (ISO date)"
}
```

### Case Image
```json
{
  "id": "string (UUID)",
  "imageUrl": "string",
  "thumbnailUrl": "string | null",
  "fileName": "string | null",
  "fileSize": "number | null",
  "mimeType": "string | null",
  "parentReportId": "string (UUID) | null",
  "finderReportId": "string (UUID) | null",
  "createdAt": "string (ISO date)"
}
```

### Matched Case
```json
{
  "id": "string (UUID)",
  "parentCaseId": "string (UUID)",
  "finderCaseId": "string (UUID)",
  "status": "PENDING | MATCHED | CLOSED | REJECTED",
  "matchConfidence": "number (0.0 - 1.0)",
  "notificationSent": "boolean",
  "verifiedBy": "string (UUID) | null",
  "verifiedAt": "string (ISO date) | null",
  "notes": "string | null",
  "createdAt": "string (ISO date)",
  "updatedAt": "string (ISO date)"
}
```

### Notification
```json
{
  "id": "string (UUID)",
  "userId": "string (UUID) | null",
  "type": "MATCH_FOUND | CASE_UPDATE | SYSTEM_ALERT | LOCATION_SHARE | ADMIN_ALERT | EMERGENCY_ALERT",
  "title": "string",
  "message": "string",
  "data": "object | null",
  "isRead": "boolean",
  "matchId": "string (UUID) | null",
  "createdAt": "string (ISO date)",
  "readAt": "string (ISO date) | null"
}
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Detailed error information"
  }
}
```

### Common HTTP Status Codes
- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Authentication required or failed
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource already exists
- **422 Unprocessable Entity**: Validation failed
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### Common Error Types
1. **Authentication Errors**
   - Invalid credentials
   - Token expired
   - Token missing

2. **Validation Errors**
   - Missing required fields
   - Invalid field format
   - File size/type restrictions

3. **Authorization Errors**
   - Insufficient permissions
   - Resource ownership verification

4. **Resource Errors**
   - Not found
   - Already exists
   - State conflicts

---

## Flutter Integration Guide

### 1. Setup HTTP Client

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class ApiClient {
  static const String baseUrl = 'http://localhost:5000';
  static String? _accessToken;
  
  static Map<String, String> get headers => {
    'Content-Type': 'application/json',
    if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
  };
  
  static void setToken(String token) {
    _accessToken = token;
  }
}
```

### 2. Authentication Service

```dart
class AuthService {
  static Future<Map<String, dynamic>> signup({
    required String name,
    required String email,
    required String phone,
    required String password,
    String role = 'PARENT',
  }) async {
    final response = await http.post(
      Uri.parse('${ApiClient.baseUrl}/api/auth/signup'),
      headers: ApiClient.headers,
      body: json.encode({
        'name': name,
        'email': email,
        'phone': phone,
        'password': password,
        'role': role,
      }),
    );
    
    if (response.statusCode == 201) {
      final data = json.decode(response.body);
      ApiClient.setToken(data['data']['accessToken']);
      return data;
    } else {
      throw Exception('Signup failed');
    }
  }
  
  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final response = await http.post(
      Uri.parse('${ApiClient.baseUrl}/api/auth/login'),
      headers: ApiClient.headers,
      body: json.encode({
        'email': email,
        'password': password,
      }),
    );
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      ApiClient.setToken(data['data']['accessToken']);
      return data;
    } else {
      throw Exception('Login failed');
    }
  }
}
```

### 3. File Upload Service

```dart
import 'package:http/http.dart' as http;
import 'dart:io';

class FileUploadService {
  static Future<Map<String, dynamic>> createParentReport({
    required String childName,
    required String fatherName,
    required String gender,
    required DateTime lostTime,
    required String contactNumber,
    required String emergency,
    required List<File> images,
    String? placeLost,
    String? additionalDetails,
  }) async {
    var request = http.MultipartRequest(
      'POST',
      Uri.parse('${ApiClient.baseUrl}/api/reports/parent'),
    );
    
    request.headers.addAll({
      'Authorization': 'Bearer ${ApiClient._accessToken}',
    });
    
    request.fields.addAll({
      'childName': childName,
      'fatherName': fatherName,
      'gender': gender,
      'lostTime': lostTime.toIso8601String(),
      'contactNumber': contactNumber,
      'emergency': emergency,
      if (placeLost != null) 'placeLost': placeLost,
      if (additionalDetails != null) 'additionalDetails': additionalDetails,
    });
    
    for (int i = 0; i < images.length; i++) {
      request.files.add(
        await http.MultipartFile.fromPath('images', images[i].path),
      );
    }
    
    final response = await request.send();
    final responseBody = await response.stream.bytesToString();
    
    if (response.statusCode == 201) {
      return json.decode(responseBody);
    } else {
      throw Exception('Failed to create parent report');
    }
  }
}
```

### 4. Data Models in Dart

```dart
class User {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String role;
  final String? profileImage;
  final bool isVerified;
  final DateTime createdAt;
  
  User({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    this.profileImage,
    required this.isVerified,
    required this.createdAt,
  });
  
  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      name: json['name'],
      email: json['email'],
      phone: json['phone'],
      role: json['role'],
      profileImage: json['profileImage'],
      isVerified: json['isVerified'],
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}

class ParentReport {
  final String id;
  final String childName;
  final String fatherName;
  final String? placeLost;
  final String gender;
  final DateTime lostTime;
  final String? additionalDetails;
  final String contactNumber;
  final String emergency;
  final String status;
  final List<CaseImage> images;
  final DateTime createdAt;
  
  ParentReport({
    required this.id,
    required this.childName,
    required this.fatherName,
    this.placeLost,
    required this.gender,
    required this.lostTime,
    this.additionalDetails,
    required this.contactNumber,
    required this.emergency,
    required this.status,
    required this.images,
    required this.createdAt,
  });
  
  factory ParentReport.fromJson(Map<String, dynamic> json) {
    return ParentReport(
      id: json['id'],
      childName: json['childName'],
      fatherName: json['fatherName'],
      placeLost: json['placeLost'],
      gender: json['gender'],
      lostTime: DateTime.parse(json['lostTime']),
      additionalDetails: json['additionalDetails'],
      contactNumber: json['contactNumber'],
      emergency: json['emergency'],
      status: json['status'],
      images: (json['images'] as List)
          .map((i) => CaseImage.fromJson(i))
          .toList(),
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}
```

### 5. Error Handling

```dart
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final String? errorCode;
  
  ApiException({
    required this.message,
    this.statusCode,
    this.errorCode,
  });
  
  @override
  String toString() => 'ApiException: $message';
}

class ApiResponse<T> {
  final bool success;
  final String message;
  final T? data;
  final ApiException? error;
  
  ApiResponse({
    required this.success,
    required this.message,
    this.data,
    this.error,
  });
  
  factory ApiResponse.fromResponse(http.Response response, T Function(dynamic) parser) {
    final body = json.decode(response.body);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return ApiResponse(
        success: true,
        message: body['message'] ?? 'Success',
        data: parser(body['data']),
      );
    } else {
      return ApiResponse(
        success: false,
        message: body['message'] ?? 'Unknown error',
        error: ApiException(
          message: body['message'] ?? 'Unknown error',
          statusCode: response.statusCode,
          errorCode: body['error']?['code'],
        ),
      );
    }
  }
}
```

### 6. State Management (Provider Example)

```dart
import 'package:flutter/foundation.dart';

class AuthProvider with ChangeNotifier {
  User? _user;
  String? _token;
  bool _isLoading = false;
  
  User? get user => _user;
  bool get isAuthenticated => _user != null && _token != null;
  bool get isLoading => _isLoading;
  
  Future<void> login(String email, String password) async {
    _isLoading = true;
    notifyListeners();
    
    try {
      final response = await AuthService.login(
        email: email,
        password: password,
      );
      
      _user = User.fromJson(response['data']['user']);
      _token = response['data']['accessToken'];
      
      // Store token securely
      await _storeToken(_token!);
      
    } catch (e) {
      throw e;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  Future<void> logout() async {
    try {
      await AuthService.logout();
    } catch (e) {
      // Handle logout error
    } finally {
      _user = null;
      _token = null;
      await _clearToken();
      notifyListeners();
    }
  }
  
  Future<void> _storeToken(String token) async {
    // Store token using secure storage
  }
  
  Future<void> _clearToken() async {
    // Clear stored token
  }
}
```

### 7. Network Configuration

For development, make sure to configure your Flutter app to allow HTTP connections:

**android/app/src/main/AndroidManifest.xml:**
```xml
<application
    android:usesCleartextTraffic="true"
    ...>
```

**ios/Runner/Info.plist:**
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

### 8. Real-time Features (WebSocket)

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

class SocketService {
  IO.Socket? _socket;
  
  void connect(String token) {
    _socket = IO.io('http://localhost:5000', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'extraHeaders': {'Authorization': 'Bearer $token'}
    });
    
    _socket!.connect();
    
    _socket!.on('notification', (data) {
      // Handle real-time notifications
      print('New notification: $data');
    });
    
    _socket!.on('match_found', (data) {
      // Handle match notifications
      print('Match found: $data');
    });
  }
  
  void disconnect() {
    _socket?.disconnect();
  }
}
```

---

## Health Check Endpoint

**GET** `/health`
- **Description**: Check if the server is running
- **Access**: Public

**Response (200 OK):**
```json
{
  "status": "OK",
  "message": "LocateLost Backend is running",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "environment": "development",
  "version": "1.0.0",
  "port": 5000,
  "endpoints": {
    "auth": "/api/auth",
    "users": "/api/users",
    "reports": "/api/reports",
    "matches": "/api/matches",
    "dashboard": "/api/dashboard",
    "notifications": "/api/notifications"
  }
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:
- **Window**: 15 minutes
- **Limit**: 100 requests per IP
- **Response**: 429 Too Many Requests

---

## Security Features

1. **JWT Authentication**: Access and refresh tokens
2. **Password Hashing**: Bcrypt with salt rounds
3. **CORS Protection**: Configured for Flutter applications
4. **Helmet**: Security headers
5. **Rate Limiting**: Request throttling
6. **Input Validation**: Request validation middleware
7. **File Upload Validation**: Size and type restrictions

---

## Environment Variables Required

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/locatelost"

# JWT
JWT_SECRET="your-jwt-secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-jwt-refresh-secret"
JWT_REFRESH_EXPIRES_IN="7d"

# Server
PORT=5000
NODE_ENV="development"
FRONTEND_URL="http://localhost:3000"

# Redis (optional for caching)
REDIS_URL="redis://localhost:6379"

# AWS S3 (if using cloud storage)
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_S3_BUCKET="your-bucket-name"
AWS_REGION="us-east-1"
```

---

This documentation provides comprehensive coverage of all API endpoints, request/response formats, data models, and Flutter integration examples. The backend uses PostgreSQL database with Prisma ORM, JWT authentication, and supports real-time features through WebSocket connections.