# LocateLost Backend

A comprehensive backend system for the LocateLost missing children application. This system enables parents to report missing children and Good Samaritans to report found children, with AI-powered image matching to connect cases.

## Features

### Core Functionality
- **User Management**: Registration, authentication, and profile management
- **Missing Child Reports**: Parents can submit detailed reports with images
- **Found Child Reports**: Finders can report children they've found
- **AI Image Matching**: Advanced facial recognition and image similarity matching
- **Real-time Notifications**: Push, email, and SMS notifications
- **Admin Dashboard**: Comprehensive analytics and case management
- **Location Services**: Geolocation-based case matching and mapping

### Technical Features
- **Prisma ORM**: Type-safe database operations with PostgreSQL
- **JWT Authentication**: Secure user authentication with refresh tokens
- **AWS S3 Integration**: Cloud storage for images
- **Redis Caching**: Performance optimization and session management
- **Bull Queue**: Background job processing for image analysis
- **Firebase Push Notifications**: Real-time mobile notifications
- **Twilio SMS**: SMS alert capabilities
- **Face Recognition**: AI-powered facial analysis using face-api.js

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis
- **File Storage**: AWS S3
- **Queue System**: Bull (Redis-based)
- **Authentication**: JWT
- **Image Processing**: TensorFlow.js, face-api.js
- **Notifications**: Firebase Cloud Messaging, Twilio, Nodemailer
- **Validation**: Joi
- **Security**: bcrypt, helmet, cors

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL
- Redis
- AWS Account (for S3)
- Firebase Project (for push notifications)
- Twilio Account (for SMS)

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd locatelost-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**
```bash
cp .env.example .env
```

4. **Configure environment variables**
Edit `.env` file with your configuration:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/locatelost"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""

# AWS S3
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET_NAME="your-bucket-name"

# Firebase
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# Twilio
TWILIO_ACCOUNT_SID="your-twilio-sid"
TWILIO_AUTH_TOKEN="your-twilio-token"
TWILIO_PHONE_NUMBER="your-twilio-phone"

# Email
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASSWORD="your-app-password"
EMAIL_FROM="LocateLost <noreply@locatelost.app>"

# App
PORT=3000
NODE_ENV="development"
APP_NAME="LocateLost"
APP_URL="https://locatelost.app"
```

5. **Database Setup**
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# (Optional) Seed database
npx prisma db seed
```

6. **Start the application**
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `POST /api/users/profile/image` - Upload profile image
- `PUT /api/users/password` - Change password
- `DELETE /api/users/account` - Delete account

### Parent Reports (Missing Children)
- `POST /api/parent-reports` - Create missing child report
- `GET /api/parent-reports` - Get all reports (with filtering)
- `GET /api/parent-reports/my` - Get user's reports
- `GET /api/parent-reports/:id` - Get specific report
- `PUT /api/parent-reports/:id` - Update report
- `DELETE /api/parent-reports/:id` - Delete report

### Finder Reports (Found Children)
- `POST /api/finder-reports` - Create found child report
- `GET /api/finder-reports` - Get all finder reports
- `GET /api/finder-reports/my` - Get user's finder reports
- `GET /api/finder-reports/:id` - Get specific report
- `PUT /api/finder-reports/:id` - Update report
- `DELETE /api/finder-reports/:id` - Delete report

### Matches
- `GET /api/matches` - Get all matches (Admin)
- `GET /api/matches/my` - Get user's matches
- `GET /api/matches/:id` - Get match details
- `PUT /api/matches/:id/status` - Update match status (Admin)

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `PUT /api/notifications/preferences` - Update preferences

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/activity` - Get recent activity
- `GET /api/dashboard/analytics` - Get analytics (Admin)

## Database Schema

The application uses Prisma ORM with the following main entities:

- **User**: User accounts with role-based access
- **ParentReport**: Missing children reports
- **FinderReport**: Found children reports
- **CaseImage**: Images associated with reports
- **MatchedCase**: AI-generated matches between reports
- **Notification**: User notifications
- **RefreshToken**: JWT refresh tokens

## Image Processing Pipeline

1. **Upload**: Images uploaded to AWS S3
2. **Queue**: Background job queued for processing
3. **Analysis**: Face detection and embedding generation
4. **Matching**: Similarity comparison with existing cases
5. **Notification**: Alerts sent for potential matches

## Security Features

- **JWT Authentication**: Stateless authentication with refresh tokens
- **Role-based Access**: Admin, Parent, and Finder roles
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Joi schema validation
- **SQL Injection Protection**: Prisma ORM parameterized queries
- **XSS Protection**: Helmet middleware
- **CORS Configuration**: Controlled cross-origin requests

## Background Jobs

The system uses Bull queues for background processing:

- **Image Processing**: Face detection and embedding generation
- **Match Finding**: Similarity comparison and match creation
- **Notifications**: Sending push, email, and SMS notifications
- **Cleanup**: Removing old data and cache entries

## Monitoring and Logging

- **Request Logging**: Morgan HTTP request logger
- **Error Handling**: Centralized error handling middleware
- **Queue Monitoring**: Bull dashboard for job monitoring
- **Health Checks**: System health endpoints

## Deployment

### Docker Deployment
```bash
# Build image
docker build -t locatelost-backend .

# Run with docker-compose
docker-compose up -d
```

### Manual Deployment
1. Set up PostgreSQL and Redis
2. Configure environment variables
3. Run database migrations
4. Start the application with PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

## Development

### Project Structure
```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middleware/      # Express middleware
├── models/          # Database models (Prisma)
├── routes/          # API routes
├── services/        # Business logic services
├── jobs/            # Background job processors
└── utils/           # Utility functions
```

### Code Style
- Use ESLint and Prettier for code formatting
- Follow RESTful API conventions
- Implement proper error handling
- Write comprehensive tests

### Testing
```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | Yes |
| `REDIS_HOST` | Redis host | Yes |
| `REDIS_PORT` | Redis port | No |
| `AWS_ACCESS_KEY_ID` | AWS access key | Yes |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Yes |
| `AWS_S3_BUCKET_NAME` | S3 bucket name | Yes |
| `FIREBASE_PROJECT_ID` | Firebase project ID | No |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase service account JSON | No |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | No |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | No |
| `EMAIL_HOST` | SMTP host | No |
| `EMAIL_USER` | SMTP username | No |
| `EMAIL_PASSWORD` | SMTP password | No |

## Support

For support and questions, please contact the development team or create an issue in the repository.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
