# FaithTrack - Church Attendance Management System

A comprehensive church management system for tracking attendance, managing members, and monitoring spiritual growth.

## Features

- 👥 Member Management
- 📊 Attendance Tracking with QR Codes
- 📈 Dashboard Analytics
- 👨‍👩‍👧‍👦 Family Tree Management
- 🔔 Notifications System
- 📱 Mobile-Friendly Interface
- 🎂 Birthday Reminders
- 📊 Reports & Analytics

## Tech Stack

**Frontend:**
- React 18
- Vite
- CSS3

**Backend:**
- PHP 7.4+
- MySQL 5.7+
- PDO for database operations

## Local Development

### Prerequisites
- Node.js 16+
- PHP 7.4+
- MySQL 5.7+
- Composer

### Setup

1. **Clone the repository**
```cmd
git clone https://github.com/YOUR_USERNAME/faithtrack-system.git
cd faithtrack-system
```

2. **Install dependencies**
```cmd
npm install
cd faithtrack
npm install
```

3. **Setup database**
- Create a MySQL database
- Import `database_schema.sql`
- Configure `api/config/database.php`

4. **Run development server**
```cmd
cd faithtrack
npm run dev
```

5. **Start PHP server** (in another terminal)
```cmd
php -S localhost:80 -t .
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

Quick summary:
- Frontend: Deploy to Vercel (free)
- Backend: Deploy to InfinityFree or similar PHP hosting (free)
- Database: MySQL on hosting provider

## Project Structure

```
faithtrack-system/
├── api/                    # PHP Backend API
│   ├── admin/             # Admin endpoints
│   ├── members/           # Member endpoints
│   ├── attendance/        # Attendance tracking
│   ├── events/            # Event management
│   └── config/            # Database configuration
├── faithtrack/            # React Frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── api/          # API utilities
│   │   └── utils/        # Helper functions
│   └── dist/             # Build output
├── uploads/               # User uploads
│   └── profile_pictures/ # Member photos
└── database_schema.sql   # Database structure

```

## License

Private project for CLCC

## Contact

For questions or support, contact the development team.
