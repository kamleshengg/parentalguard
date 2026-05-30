# 🛡️ ParentalGuard — Family Safety PWA System

## Overview
A full-stack, consent-based parental monitoring system built as a Progressive Web App (PWA). Designed for transparency, legal compliance, and real-time family safety.

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SYSTEM ARCHITECTURE                   │
├────────────────────┬────────────────────────────────────┤
│  PARENT DASHBOARD  │         CHILD DEVICE APP           │
│  (Browser / PWA)   │         (Android PWA)              │
│  Desktop + Mobile  │         Runs in browser            │
├────────────────────┴────────────────────────────────────┤
│                   Node.js + Express                      │
│              Socket.io (Real-time events)                │
├─────────────────────────────────────────────────────────┤
│            In-Memory DB (→ PostgreSQL/MongoDB)           │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack
| Layer | Technology |
|-------|-----------|
| Backend | Node.js 18 + Express 4 |
| Real-time | Socket.io 4 |
| Auth | JWT tokens + bcrypt |
| Encryption | AES-256 (via Node crypto) |
| Frontend | Vanilla HTML/CSS/JS (PWA) |
| Database | In-memory (upgrade to PostgreSQL) |
| Hosting | Any VPS/server with Node.js |

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Start the server
```bash
npm start
# or for development:
npm run dev
```

### 3. Access the apps
- **Parent Dashboard:** `http://your-server:3000`
- **Child Device App:** `http://your-server:3000/child/`

### 4. Demo Login
- Email: `parent@demo.com`
- Password: `demo1234`

---

## 📱 Child Device Setup (Android)

### Installing as PWA on Android:
1. Open Chrome on the child's Android device
2. Navigate to `http://your-server/child/`
3. Chrome will show "Add to Home Screen" banner
4. Tap "Install" — the app appears on the home screen
5. Enter the pairing code from the parent dashboard

### Note on "Hidden" Operation:
The PWA icon will appear on the home screen labeled "Family Safety". This is intentional — ethical monitoring requires the child to know they are being monitored (transparency requirement). The app icon is visible but can be named generically.

For full native Android features (background location, etc.), consider wrapping this PWA in a WebView app using:
- **Capacitor** (recommended): `npm install @capacitor/core @capacitor/cli`
- **Cordova**: Legacy but widely supported

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Parent login → JWT token |
| POST | `/api/auth/register` | Create parent account |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/overview` | Children + alert summary |
| GET | `/api/children` | List all children |
| POST | `/api/children/register` | Add new child (returns pairing code) |

### Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/location/:childId` | Location history |
| POST | `/api/location/update` | Child sends location |
| GET | `/api/apps/:childId` | App usage report |
| POST | `/api/apps/report` | Child reports app usage |
| GET | `/api/screentime/:childId` | Screen time data |
| GET | `/api/alerts` | All alerts |
| PUT | `/api/alerts/:id/read` | Mark alert read |

### Control
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/children/:id/settings` | Update monitoring settings |
| POST | `/api/children/:id/lock` | Remote lock/unlock device |
| GET | `/api/webfilter/check?url=` | Check if URL is blocked |
| POST | `/api/webfilter/domains` | Block/unblock domain |

### Device
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pair` | Pair child device (pairing code) |

---

## 🗄️ Database Schema (PostgreSQL Migration)

```sql
-- Users (Parents)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Children
CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  age INTEGER,
  device_name VARCHAR(255),
  device_id VARCHAR(255),
  pairing_code VARCHAR(10),
  consent_given BOOLEAN DEFAULT false,
  consent_date TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT false,
  battery_level INTEGER,
  last_seen TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id),
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  label VARCHAR(255),
  accuracy DECIMAL(8, 2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- App Usage
CREATE TABLE app_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id),
  app_name VARCHAR(255),
  category VARCHAR(100),
  minutes INTEGER,
  date DATE DEFAULT CURRENT_DATE,
  is_flagged BOOLEAN DEFAULT false
);

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id),
  type VARCHAR(50),
  severity VARCHAR(20),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Web Activity
CREATE TABLE web_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id),
  url VARCHAR(2048),
  title VARCHAR(500),
  was_blocked BOOLEAN DEFAULT false,
  visited_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blocked Domains
CREATE TABLE blocked_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES users(id),
  domain VARCHAR(255) NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| Authentication | JWT tokens (HS256) |
| Password Storage | bcrypt (12 rounds) |
| Transport | HTTPS/TLS (configure with nginx) |
| API Security | Helmet.js headers |
| Data Encryption | AES-256 for stored sensitive data |
| CORS | Configured per-domain |
| Rate Limiting | Add `express-rate-limit` for production |

---

## 📋 Legal Compliance

### GDPR (EU) / PDPA (UAE)
- ✅ Explicit consent collected and timestamped
- ✅ Child and parent both aware of monitoring
- ✅ Data export functionality (`/api/export`)
- ✅ Right to deletion supported
- ✅ Minimal data collection principle

### COPPA (US)
- ✅ Parental consent required before monitoring
- ✅ No third-party data sharing
- ✅ Secure data storage

### UAE Cybercrime Law (Federal Law No. 5/2012)
- ✅ Consent-based monitoring (not covert)
- ✅ Transparent disclosure to child
- ✅ Parent/guardian authorization

---

## 🌐 Production Deployment (Ubuntu VPS)

### 1. Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Install PM2 (process manager)
```bash
sudo npm install -g pm2
```

### 3. Deploy files
```bash
# Upload zip, unzip to /var/www/parentalguard
unzip parentalguard.zip -d /var/www/parentalguard
cd /var/www/parentalguard
npm install --production
```

### 4. Start with PM2
```bash
pm2 start backend/server.js --name parentalguard
pm2 startup
pm2 save
```

### 5. Nginx reverse proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 6. SSL with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 📱 Google Maps Integration

Replace the map placeholder in `parent-dashboard/index.html`:

```html
<!-- Replace .map-container div with: -->
<div id="map" style="height:380px;border-radius:12px"></div>
<script>
function initMap() {
  const map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 25.2048, lng: 55.2708 },
    zoom: 14,
    styles: darkMapStyle  // Use a dark theme array
  });
  // Add child marker with real coordinates from API
}
</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY&callback=initMap"></script>
```

---

## 🔧 Upgrade Path

| Feature | Current | Production Upgrade |
|---------|---------|-------------------|
| Database | In-memory | PostgreSQL + Prisma ORM |
| Auth | Simple JWT | Auth0 or Firebase Auth |
| Push Notifications | Socket.io | Firebase Cloud Messaging |
| Location Tracking | Browser Geolocation API | Native Android (Capacitor plugin) |
| App Monitoring | Manual reporting | Accessibility Service (Android native) |
| Gallery/Camera | Not implemented | Requires native Android app |
| WhatsApp Access | Not implemented | Requires device owner admin rights |

---

## ⚠️ Important Notes

1. **App Monitoring** — Full app usage tracking (beyond browser) requires a native Android app with `UsageStatsManager` permissions
2. **WhatsApp/Messages** — Accessing other apps' messages requires device admin rights or MDM (Mobile Device Management) — not possible in pure PWA
3. **Camera/Gallery Access** — Requires native app with explicit permissions
4. **Background GPS** — Mobile browsers limit background location; for persistent tracking use Capacitor + `@capacitor/geolocation`
5. **Always get legal advice** for your jurisdiction before deploying monitoring software

---

## 📞 Support & Customization

This is a foundation. Extend it by:
- Adding a React Native or Capacitor wrapper for native Android features
- Integrating a real database (PostgreSQL via Prisma)
- Adding email/SMS alerts via Twilio or SendGrid
- Implementing Google Maps for real map display
- Adding WhatsApp Web monitoring via browser extension

---

*Built with transparency, consent, and child safety as core principles.*
