import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Send } from 'lucide-react';

export default function VoiceRecorder({ onSendVoice, onCancel }) {
  const [recordingState, setRecordingState] = useState('recording'); // 'recording' | 'preview'
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const audioPreviewRef = useRef(null);
  const audioBlobRef = useRef(null);

  // Start recording on mount
  useEffect(() => {
    async function startRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        let mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/ogg;codecs=opus';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '';
        }

        const options = mimeType ? { mimeType } : undefined;
        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          audioBlobRef.current = blob;
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
          setRecordingState('preview');
        };

        recorder.start(100);
        timerRef.current = setInterval(() => {
          setDuration(d => d + 1);
        }, 1000);

      } catch (err) {
        console.error('Failed to capture audio for voice note:', err);
        alert('Could not access microphone for voice message.');
        if (onCancel) onCancel();
      }
    }

    startRecording();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  const handleStopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  const handlePlayPause = () => {
    if (!audioPreviewRef.current) return;
    if (isPlaying) {
      audioPreviewRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPreviewRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSend = () => {
    if (audioBlobRef.current && onSendVoice) {
      onSendVoice(audioBlobRef.current, duration);
    }
  };

  const formatSecs = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 16px',
      background: 'rgba(15, 23, 42, 0.95)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-medium)',
      width: '100%',
      animation: 'fadeIn 0.2s ease'
    }}>
      {recordingState === 'recording' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
            <span className="status-dot busy recording-pulse" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {formatSecs(duration)}
            </span>
          </div>

          {/* Animated wave bars */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px', height: '24px' }}>
            {[30, 80, 50, 100, 60, 90, 40, 70, 85, 45, 95, 65, 35, 75].map((h, i) => (
              <div
                key={i}
                className="wave-bar"
                style={{
                  height: `${h * 0.22}px`,
                  animationDelay: `${i * 0.08}s`
                }}
              />
            ))}
          </div>

          <button
            onClick={handleStopRecording}
            className="btn btn-primary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            title="Stop and preview voice message"
          >
            <Square size={14} />
            <span>Done</span>
          </button>
        </>
      ) : (
        <>
          <audio
            ref={audioPreviewRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            style={{ display: 'none' }}
          />

          <button
            onClick={handlePlayPause}
            className="btn btn-secondary btn-icon"
            style={{ width: '36px', height: '36px' }}
            title={isPlaying ? 'Pause' : 'Play preview'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <div style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Voice note ({formatSecs(duration)})
          </div>

          <button
            onClick={onCancel}
            className="btn btn-secondary btn-icon"
            style={{ width: '36px', height: '36px', color: '#ef4444' }}
            title="Discard voice message"
          >
            <Trash2 size={16} />
          </button>

          <button
            onClick={handleSend}
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            title="Send voice note"
          >
            <Send size={15} />
            <span>Send</span>
          </button>
        </>
      )}
    </div>
  );
}
