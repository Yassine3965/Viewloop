# ViewLoop - Session State Synchronization Platform

Enterprise-grade session management system with pulse-based architecture for client-server state synchronization.

## 📋 Overview

ViewLoop is a technical infrastructure platform designed for session state management and activity synchronization. The system implements a server-authoritative model where the backend serves as the single source of truth for all session data.

## 🔧 Architecture

### Core Components

1. **Session Manager** - Handles session lifecycle and state transitions
2. **Pulse Engine** - Implements periodic validation between client and server
3. **Activity Monitor** - Tracks and synchronizes activity states
4. **State Repository** - Secure storage for session data

### Technical Stack

- **Frontend**: Next.js with React components
- **Backend**: Node.js with Firestore integration
- **Extension**: Chrome Extension for passive monitoring
- **Protocol**: REST API with digital signatures

## 📁 Project Structure

```
viewloop/
├── src/                    # Frontend Application
│   ├── app/               # Application Routes
│   └── components/        # UI Components
├── extension/             # Browser Extension
│   ├── background.js      # Session Management
│   └── content.js         # Activity Monitoring
├── server/               # Backend Services
│   └── server.js         # API Endpoints
└── public/               # Static Assets
```

## 🚀 Installation

### Prerequisites
- Node.js 18+
- Chrome Browser
- Firestore Database

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🔄 Session Lifecycle

### Standard Flow
1. Client initiates session request
2. Server validates and creates session record
3. Client sends periodic pulses (5-second intervals)
4. Server processes and validates pulses
5. Session completes with final state synchronization

### State Transitions
- **Initializing** → **Active** → **Completed** → **Finalized**
- **Expired** (after inactivity timeout)
- **Rejected** (duplicate sessions)

## 🔐 Security Model

### Server-Side Authority
- All validation occurs on the server
- Client operates as passive device
- Digital signatures for request authentication

### Data Integrity
- HMAC-based message authentication
- Rate limiting for API endpoints
- Session token validation

## 📊 Monitoring

### Activity Tracking
- Session duration monitoring
- State change logging
- Periodic validation events

### System Metrics
- Pulse frequency analysis
- Session stability metrics
- Connection reliability

## 🔧 Configuration

### Environment Variables
```
API_BASE_URL=https://api.viewloop.com
FIREBASE_CONFIG={your_firebase_config}
EXTENSION_SECRET={your_secret_key}
```

### Extension Setup
1. Navigate to `chrome://extensions/`
2. Enable Developer mode
3. Load unpacked extension from `extension/` directory

## 📖 Technical Documentation

### Session Management
- Single session per client policy
- Automatic expiration handling
- State transition validation

### Pulse Protocol
- 5-second interval validation
- Digital signature verification
- Server-side processing

### Data Storage
- Firestore document structure
- Session metadata schema
- Activity log format

## 🛠️ Development

### Building
```bash
npm run build
```

### Testing
```bash
npm test
```

### Deployment
```bash
npm run deploy
```

## 📞 Support

For technical inquiries:
1. Review system logs
2. Check API responses
3. Consult documentation

## 📄 License

Enterprise SaaS Platform - Technical Use Only
