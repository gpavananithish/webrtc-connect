import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SignalingProvider, useSignaling } from './context/SignalingContext';
import AuthPage from './components/AuthPage';
import Sidebar from './components/Sidebar';
import IncomingCallModal from './components/IncomingCallModal';
import ActiveCallModal from './components/ActiveCallModal';
import ChatView from './components/ChatView';
import ContactsView from './components/ContactsView';
import CallHistoryView from './components/CallHistoryView';
import MeetingLobby from './components/MeetingLobby';
import MeetingRoom from './components/MeetingRoom';
import RecordingsView from './components/RecordingsView';
import SettingsView from './components/SettingsView';
import { useOneOnOneCall } from './hooks/useOneOnOneCall';
import { useMeshMeeting } from './hooks/useMeshMeeting';

function MainApplication() {
  const { user, isAuthenticated, loading } = useAuth();
  const { acceptIncomingCall } = useSignaling();

  const [activeTab, setActiveTab] = useState('chats');
  const [selectedChatUserId, setSelectedChatUserId] = useState(null);
  const [activeMeetingCode, setActiveMeetingCode] = useState(null);
  const [activeMeetingPassword, setActiveMeetingPassword] = useState(null);

  // One-on-one call hook
  const callHook = useOneOnOneCall();

  // Mesh meeting hook
  const meshMeeting = useMeshMeeting(activeMeetingCode, () => {
    setActiveMeetingCode(null);
    setActiveMeetingPassword(null);
  });

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100vw',
        height: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-sans)',
        fontSize: '1rem'
      }}>
        Initializing Connect WebRTC...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // Handle direct meeting link URL parameter (e.g., https://domain.com/?meeting=abc-defg-hij)
  React.useEffect(() => {
    if (isAuthenticated && user) {
      const urlParams = new URLSearchParams(window.location.search);
      const meetingParam = urlParams.get('meeting');
      if (meetingParam) {
        const cleanCode = meetingParam.trim().toLowerCase();
        // Clean URL to prevent re-triggering on reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        // Direct join
        setActiveMeetingCode(cleanCode);
        setActiveMeetingPassword(null);
        meshMeeting.joinMeeting(cleanCode, user, null);
      }
    }
  }, [isAuthenticated, user]);

  // Handle incoming call accept
  const handleAcceptIncomingCall = (callData) => {
    acceptIncomingCall();
    callHook.answerCall(callData);
  };

  // Launch group meeting
  const handleStartMeeting = (code, password) => {
    setActiveMeetingCode(code);
    setActiveMeetingPassword(password);
    meshMeeting.joinMeeting(code, user, password);
  };

  // Switch to chat with user
  const handleStartChatWithUser = (targetUserId) => {
    setSelectedChatUserId(targetUserId);
    setActiveTab('chats');
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="main-content">
        {/* Active Group Meeting Overlay */}
        {activeMeetingCode && meshMeeting.inMeeting ? (
          <MeetingRoom
            meshMeeting={meshMeeting}
            onLeave={() => {
              setActiveMeetingCode(null);
              setActiveMeetingPassword(null);
            }}
          />
        ) : (
          <>
            {activeTab === 'chats' && (
              <ChatView
                onStartCall={callHook.startCall}
                selectedUserId={selectedChatUserId}
              />
            )}
            {activeTab === 'contacts' && (
              <ContactsView
                onStartCall={callHook.startCall}
                onStartChat={handleStartChatWithUser}
              />
            )}
            {activeTab === 'calls' && (
              <CallHistoryView
                onStartCall={callHook.startCall}
              />
            )}
            {activeTab === 'meetings' && (
              <MeetingLobby
                onStartMeeting={handleStartMeeting}
              />
            )}
            {activeTab === 'recordings' && (
              <RecordingsView />
            )}
            {activeTab === 'settings' && (
              <SettingsView />
            )}
          </>
        )}
      </main>

      {/* Incoming Call Ringing Modal */}
      <IncomingCallModal onAcceptCall={handleAcceptIncomingCall} />

      {/* Active 1-on-1 Call Overlay */}
      <ActiveCallModal callHook={callHook} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SignalingProvider>
          <MainApplication />
        </SignalingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
