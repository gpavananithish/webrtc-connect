import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { 
  User, Mic, Video, Volume2, Globe, Shield, Check, RefreshCw 
} from 'lucide-react';

export default function SettingsView() {
  const { user, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [title, setTitle] = useState(user?.title || '');
  const [statusMessage, setStatusMessage] = useState(user?.statusMessage || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Hardware devices
  const [audioInputDevices, setAudioInputDevices] = useState([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);

  const [selectedMic, setSelectedMic] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [selectedCamera, setSelectedCamera] = useState('');

  const [devicePermissionGranted, setDevicePermissionGranted] = useState(false);
  const [devicePermissionError, setDevicePermissionError] = useState('');

  // Diagnostics test states
  const [isTestingCamera, setIsTestingCamera] = useState(false);
  const [micVolume, setMicVolume] = useState(0);

  const testVideoRef = useRef(null);
  const testStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Network / ICE Config
  const [iceConfig, setIceConfig] = useState(null);

  // Enumerate Devices (Hardware probe)
  const loadDevices = async (requestPermission = false) => {
    let tempStream = null;
    try {
      if (requestPermission) {
        // Explicitly request permissions when user clicks 'Refresh & Grant Permissions'
        try {
          tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          setDevicePermissionGranted(true);
          setDevicePermissionError('');
        } catch (mediaErr) {
          // If combined audio+video fails, try audio only
          try {
            tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setDevicePermissionGranted(true);
            setDevicePermissionError('');
          } catch (audioErr) {
            console.warn('Microphone permission request failed:', audioErr);
            setDevicePermissionError('Please allow camera & microphone permissions in your mobile/browser settings.');
          }
        }
      }

      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
      const videoInputs = devices.filter(d => d.kind === 'videoinput');

      setAudioInputDevices(audioInputs);
      setAudioOutputDevices(audioOutputs);
      setVideoDevices(videoInputs);

      // Restore saved device selections or default to first
      const savedMic = localStorage.getItem('connect_preferred_mic');
      const savedCam = localStorage.getItem('connect_preferred_cam');
      const savedSpeaker = localStorage.getItem('connect_preferred_speaker');

      if (savedMic && audioInputs.some(d => d.deviceId === savedMic)) {
        setSelectedMic(savedMic);
      } else if (audioInputs.length > 0 && !selectedMic) {
        setSelectedMic(audioInputs[0].deviceId);
      }

      if (savedCam && videoInputs.some(d => d.deviceId === savedCam)) {
        setSelectedCamera(savedCam);
      } else if (videoInputs.length > 0 && !selectedCamera) {
        setSelectedCamera(videoInputs[0].deviceId);
      }

      if (savedSpeaker && audioOutputs.some(d => d.deviceId === savedSpeaker)) {
        setSelectedSpeaker(savedSpeaker);
      } else if (audioOutputs.length > 0 && !selectedSpeaker) {
        setSelectedSpeaker(audioOutputs[0].deviceId);
      }

      if (tempStream) {
        tempStream.getTracks().forEach(t => t.stop());
      }
    } catch (err) {
      console.warn('Could not enumerate media devices:', err);
      setDevicePermissionError(`Device scan error: ${err.message}`);
    }
  };

  useEffect(() => {
    loadDevices(false);

    // Listen for device changes (e.g. plugging in headphones or bluetooth headsets)
    const handleDeviceChange = () => {
      loadDevices(false);
    };

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }

    api.getIceServers()
      .then(res => setIceConfig(res))
      .catch(() => {});

    return () => {
      if (navigator.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
      if (testStreamRef.current) {
        testStreamRef.current.getTracks().forEach(t => t.stop());
        testStreamRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch (e) {}
        audioContextRef.current = null;
      }
    };
  }, []);

  // Live Mic Level Test
  const startMicTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = (sum / dataArray.length) * 1.5;
        setMicVolume(Math.min(Math.round(avg), 100));
        animationFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn('Mic test error:', err);
    }
  };

  const stopMicTest = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    setMicVolume(0);
  };

  // Live Camera Test
  const toggleCameraTest = async () => {
    if (isTestingCamera) {
      stopCameraTest();
    } else {
      try {
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: selectedCamera ? { deviceId: { exact: selectedCamera } } : true
          });
        } catch (constraintErr) {
          // If exact deviceId fails, fallback to any available video input
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        testStreamRef.current = stream;
        setIsTestingCamera(true);
      } catch (err) {
        alert(`Camera error: ${err.message}`);
      }
    }
  };

  useEffect(() => {
    if (isTestingCamera && testStreamRef.current && testVideoRef.current) {
      testVideoRef.current.srcObject = testStreamRef.current;
      testVideoRef.current.play().catch(e => console.log('Preview play notice:', e));
    }
  }, [isTestingCamera]);

  const stopCameraTest = () => {
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach(t => t.stop());
      testStreamRef.current = null;
    }
    if (testVideoRef.current) {
      testVideoRef.current.srcObject = null;
    }
    setIsTestingCamera(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess(false);
    try {
      await updateProfile({ displayName, title, statusMessage });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 2500);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="responsive-page-pad" style={{ flex: 1, height: '100%', overflowY: 'auto', padding: '36px' }}>
      <div style={{ maxWidth: '840px', margin: '0 auto' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Settings & Hardware Diagnostics
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Configure your audio/video peripherals, test input levels, and inspect WebRTC network parameters.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Section 1: User Profile Settings */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} color="var(--accent-cyan)" />
              <span>User Profile</span>
            </h2>

            <form onSubmit={handleSaveProfile} className="responsive-grid-1col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Role / Job Title
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Status Message / Bio
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Working on WebRTC mesh optimization"
                  value={statusMessage}
                  onChange={(e) => setStatusMessage(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                {profileSuccess && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--status-online)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} /> Profile updated!
                  </span>
                )}
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="btn btn-primary"
                  style={{ padding: '8px 20px' }}
                >
                  {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Audio & Video Peripherals */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mic size={18} color="var(--accent-cyan)" />
                <span>Audio & Video Hardware</span>
              </h2>

              <button
                type="button"
                onClick={() => loadDevices(true)}
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                title="Scan hardware devices and request mobile permissions"
              >
                <RefreshCw size={14} />
                <span>Refresh & Grant Permissions</span>
              </button>
            </div>

            {devicePermissionError && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                color: '#ef4444',
                fontSize: '0.82rem',
                marginBottom: '16px'
              }}>
                {devicePermissionError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              {/* Mic Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Microphone Input
                </label>
                <select
                  className="input-field"
                  value={selectedMic}
                  onChange={(e) => {
                    setSelectedMic(e.target.value);
                    localStorage.setItem('connect_preferred_mic', e.target.value);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {audioInputDevices.length === 0 ? (
                    <option value="" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      No microphone found
                    </option>
                  ) : (
                    audioInputDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                        {d.label || `Microphone ${i + 1}`}
                      </option>
                    ))
                  )}
                </select>

                {/* Mic Volume Meter */}
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mic Volume Level</span>
                    <button
                      type="button"
                      onClick={audioContextRef.current ? stopMicTest : startMicTest}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      {audioContextRef.current ? 'Stop Test' : 'Test Mic Level'}
                    </button>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${micVolume}%`,
                      height: '100%',
                      background: micVolume > 80 ? '#ef4444' : 'var(--accent-gradient)',
                      transition: 'width 0.1s ease'
                    }} />
                  </div>
                </div>
              </div>

              {/* Speaker / Audio Output Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Audio Output / Speaker
                </label>
                <select
                  className="input-field"
                  value={selectedSpeaker}
                  onChange={(e) => {
                    setSelectedSpeaker(e.target.value);
                    localStorage.setItem('connect_preferred_speaker', e.target.value);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {audioOutputDevices.length === 0 ? (
                    <option value="" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      Default System / Headset Speaker
                    </option>
                  ) : (
                    audioOutputDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                        {d.label || `Speaker ${i + 1}`}
                      </option>
                    ))
                  )}
                </select>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  {audioOutputDevices.length > 0 
                    ? 'Select your headphones, Bluetooth device, or built-in speakers.'
                    : 'System default audio output is active.'}
                </div>
              </div>

              {/* Camera Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Camera Input (Front / Back / External)
                </label>
                <select
                  className="input-field"
                  value={selectedCamera}
                  onChange={(e) => {
                    setSelectedCamera(e.target.value);
                    localStorage.setItem('connect_preferred_cam', e.target.value);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {videoDevices.length === 0 ? (
                    <option value="" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      No camera found
                    </option>
                  ) : (
                    videoDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                        {d.label || `Camera ${i + 1}`}
                      </option>
                    ))
                  )}
                </select>

                <div style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={toggleCameraTest}
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '8px', fontSize: '0.8rem' }}
                  >
                    <Video size={14} />
                    <span>{isTestingCamera ? 'Stop Camera Test' : 'Preview Camera Output'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Camera Test Preview Frame */}
            {isTestingCamera && (
              <div style={{
                height: '240px',
                background: '#040711',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-medium)'
              }}>
                <video
                  ref={testVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)' }}
                />
              </div>
            )}
          </div>

          {/* Section 3: WebRTC Network & STUN/TURN Diagnostics */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={18} color="var(--accent-cyan)" />
              <span>WebRTC Network Configuration (STUN / TURN)</span>
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{
                padding: '12px 16px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.85rem'
              }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Configured ICE Servers:</div>
                {iceConfig?.iceServers?.map((srv, idx) => (
                  <div key={idx} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>
                    • {srv.urls.join(', ')} {srv.username ? `(Auth: ${srv.username})` : ''}
                  </div>
                )) || <div style={{ color: 'var(--text-muted)' }}>Loading ICE configuration...</div>}
              </div>

              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                All connections utilize native WebRTC <code style={{ color: 'var(--accent-cyan)' }}>RTCPeerConnection</code>. STUN is used for public reflexive IP discovery. TURN servers can be configured in <code style={{ color: 'var(--text-primary)' }}>server/.env</code> using Coturn for symmetric NAT traversal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
