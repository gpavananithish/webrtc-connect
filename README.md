# Connect — Standalone WebRTC Real-Time Communication Platform

A fully functional real-time communication web application built with **React**, **Node.js**, **native WebRTC APIs**, **WebSocket signaling**, and **SQLite**. No third-party SDKs (no Twilio, Agora, LiveKit, etc.).

---

## Quick Start (3 commands)

```bash
# 1. Install all dependencies
npm install && npm --prefix server install && npm --prefix client install

# 2. Run both server + client together
npm run dev

# 3. Open in your browser
#    → http://localhost:5173
```

That's it! The app seeds 4 demo team accounts automatically on first run.

---

## Demo Accounts (Pre-seeded)

| Name            | Email                  | Password      |
|-----------------|------------------------|---------------|
| Nithish         | nithish@connect.local  | password123   |
| Surya           | surya@connect.local    | password123   |
| Ajay            | ajay@connect.local     | password123   |
| Vamsi           | vamsi@connect.local    | password123   |

You can also **register your own account** from the Sign Up tab.

---

## How to Test Real Calls (P2P Audio/Video)

Since WebRTC calls need **two separate users**, follow this workflow:

1. Open **Browser Tab 1** → `http://localhost:5173` → click **Nithish** (1-click demo login)
2. Open **Incognito/Private Window** → `http://localhost:5173` → click **Surya**
3. Now Nithish and Surya are both online — you can call, chat, share screens, and meet!

---

## Application Workflow & Features

### 🔐 Step 1: Login / Register
- Open the app and either **sign in** with a demo account or **create a new account**
- JWT-based authentication; sessions persist across page refreshes

### 💬 Step 2: Chat (Persistent Messaging)
- **Chats** tab shows your conversation list
- Click any conversation or go to **Contacts** → click **Chat** on a user card
- Features: real-time delivery, typing indicators, read receipts, reply to messages, edit/delete your own messages, emoji
- **File Sharing**: click the 📎 paperclip icon to upload documents, images, PDFs (up to 50MB)
- **Voice Messages**: click the 🎤 mic icon → record → preview → send (stored on server, playable anytime)

### 📞 Step 3: Audio Calls
- From **Contacts** or **Chats**, click the **Audio Call** button on any user
- The other user gets an **incoming call notification** with ringtone
- They can **Accept** or **Decline**
- During call: mute/unmute mic, share screen, see call duration and network quality
- Call history is logged under the **Calls** tab

### 📹 Step 4: Video Calls
- Same flow as audio but click **Video Call**
- Shows full-screen remote video + floating local preview (picture-in-picture)
- Toggle camera on/off, mute mic, share screen during the call
- Network quality indicator (good/fair/poor) based on RTCPeerConnection stats

### 🖥️ Step 5: Screen Sharing
- During any active call or meeting, click the **Screen Share** button
- Choose entire screen, a window, or a browser tab
- Remote participant sees your screen; when you stop sharing, camera restores automatically

### 👥 Step 6: Group Video Meetings (Mesh P2P)
- Go to **Meetings** tab
- **Create Meeting**: set a title, optional password, participant limit (2–6)
- A unique meeting code is generated (e.g., `abc-defg-hij`)
- **Share the code** with teammates; they enter it in "Join with Code"
- In the meeting room:
  - Dynamic video grid (adapts to 1–6 participants)
  - Mute/unmute audio and video per participant
  - Screen sharing
  - **Active speaker detection** (glowing border on loudest speaker)
  - **In-meeting chat** sidebar
  - **Participant list** sidebar
  - Copy meeting code button for quick sharing

### 🎙️ Step 7: Meeting Recording
- During a meeting, click **Record Meeting**
- All participants see a red **● REC** banner
- The recorder captures:
  - All participant video tiles composited on an HTML Canvas
  - All audio streams mixed via Web Audio API
- Click **Stop Recording** → automatically uploads to server
- View and playback recordings in the **Recordings** tab

### 📼 Step 8: Recordings Library
- **Recordings** tab shows all saved meeting recordings
- Play back in-browser, download as `.webm`, or delete
- Each recording shows: meeting title, duration, file size, date, who recorded it

### ⚙️ Step 9: Settings & Diagnostics
- **Settings** tab lets you:
  - Edit your display name, title, and status message
  - Select specific microphone, camera, and speaker devices
  - **Test mic level** with a live volume meter
  - **Preview camera** output before joining a meeting
  - View configured **STUN/TURN** ICE servers

### 👤 Step 10: Status & Presence
- Click your profile in the sidebar bottom to change status:
  - 🟢 Available | 🔴 Busy | 🟡 Away | ⚫ Appear Offline
- All users see real-time online/offline status updates across the app

---

## Project Structure

```
Connect/
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/          # Login & Registration
│   │   │   ├── layout/        # Sidebar, IncomingCallModal
│   │   │   ├── chat/          # ChatView, MessageBubble, VoiceRecorder
│   │   │   ├── calls/         # ActiveCallModal, CallHistoryView
│   │   │   ├── meetings/      # MeetingLobby, MeetingRoom, ParticipantTile
│   │   │   ├── contacts/      # ContactsView (Employee Directory)
│   │   │   ├── recordings/    # RecordingsView
│   │   │   └── settings/      # SettingsView (Devices, Profile, ICE config)
│   │   ├── context/           # AuthContext, SignalingContext
│   │   ├── hooks/             # useOneOnOneCall, useMeshMeeting
│   │   ├── services/          # api.js, soundService.js, recorderService.js
│   │   └── styles/            # theme.css (design system)
│   └── vite.config.js         # Dev proxy to backend
│
├── server/                    # Node.js + Express backend
│   ├── src/
│   │   ├── db/database.js     # SQLite schema, migrations, seed data
│   │   ├── middleware/        # JWT auth, Multer file upload
│   │   ├── routes/            # auth, users, messages, calls, meetings, files, recordings, config
│   │   ├── signaling/         # WebSocket signaling server (SDP, ICE, rooms)
│   │   ├── config.js          # Environment variable configuration
│   │   └── server.js          # Express + HTTP + WS entry point
│   └── tests/api.test.js      # Automated API & signaling test suite
│
├── storage/                   # SQLite database, uploaded files, recordings
│   ├── uploads/
│   ├── recordings/
│   └── avatars/
│
├── .env.example               # Documented environment variables
└── package.json               # Root scripts (npm run dev)
```

---

## Environment Variables (server/.env)

| Variable                 | Default                            | Description                              |
|--------------------------|------------------------------------|------------------------------------------|
| `PORT`                   | `5000`                             | Backend server port                      |
| `JWT_SECRET`             | (auto-generated)                   | Secret key for JWT token signing         |
| `DATABASE_PATH`          | `../storage/database.sqlite`       | SQLite database file path                |
| `STORAGE_DIR`            | `../storage`                       | Root directory for all file storage      |
| `STUN_SERVER`            | `stun:stun.l.google.com:19302`     | STUN server for NAT traversal            |
| `TURN_SERVER`            | (empty)                            | Optional TURN server URL                 |
| `TURN_USERNAME`          | (empty)                            | TURN authentication username             |
| `TURN_CREDENTIAL`        | (empty)                            | TURN authentication password             |
| `MAX_MEETING_PARTICIPANTS` | `6`                              | Maximum participants in mesh meetings    |

---

## Running Tests

```bash
npm --prefix server test
```

Runs 16 automated tests covering:
- Health endpoint
- User registration & login
- JWT authentication
- User directory & search
- Conversation creation
- Message sending, editing, read receipts
- Meeting creation & password validation
- Call logging & history
- WebSocket signaling handshake

---

## Architecture Notes

- **Signaling**: Custom WebSocket server (`ws` library) handles SDP offer/answer exchange, ICE candidate relay, room management, presence, and typing indicators. Media never flows through the signaling server.

- **1-on-1 Calls**: Direct `RTCPeerConnection` between two browsers. Offer/answer/ICE exchanged via WebSocket signaling.

- **Group Meetings**: Full-mesh topology — each participant maintains a separate `RTCPeerConnection` to every other participant. Practical for 2–6 users. Bandwidth scales as O(n²).

- **Recording**: Uses HTML Canvas to composite all participant video tiles at 30fps + Web Audio API `MediaStreamDestination` to mix all audio tracks → fed into `MediaRecorder` → uploaded as `.webm` to server.

- **Chat**: Messages are persisted to SQLite via REST API. Real-time delivery uses WebSocket broadcast to online recipients. Messages survive logout/refresh.

---

## Known Limitations

1. **Mesh topology** is limited to ~4-6 participants before bandwidth/CPU become issues. An SFU would be needed for larger groups.
2. **Browser-side recording** stops if the tab is closed or crashes. Server-side recording would require an SFU or media server.
3. **TURN server** is needed for users behind symmetric NATs or strict corporate firewalls. Configure Coturn in `.env`.
4. **HTTPS** is required in production for `getUserMedia()` to work (browsers block camera/mic on plain HTTP except `localhost`).
5. **File uploads** are stored on the local filesystem. For production, swap to S3-compatible object storage.

---

## License

ISC — Free to use, modify, and deploy.
