import React, { useState, useRef } from 'react';
import { 
  Play, Pause, FileText, Download, Edit2, Trash2, Reply 
} from 'lucide-react';

// Crisp Modern WhatsApp-style SVG Ticks
function DoubleTickIcon({ color = '#8696a0', size = 16 }) {
  return (
    <svg 
      viewBox="0 0 20 14" 
      width={size} 
      height={(size * 14) / 20} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      {/* First checkmark */}
      <path 
        d="M1 7.5L5 11.5L14.5 2" 
        stroke={color} 
        strokeWidth="2.2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      {/* Second checkmark overlapping */}
      <path 
        d="M6 7.5L10 11.5L19.5 2" 
        stroke={color} 
        strokeWidth="2.2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
}

function SingleTickIcon({ color = '#8696a0', size = 16 }) {
  return (
    <svg 
      viewBox="0 0 16 14" 
      width={(size * 16) / 20} 
      height={(size * 14) / 20} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path 
        d="M1.5 7.5L5.5 11.5L15 2" 
        stroke={color} 
        strokeWidth="2.2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
}

export default function MessageBubble({ 
  message, 
  isMine, 
  onReply, 
  onEdit, 
  onDelete 
}) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const audioRef = useRef(null);

  // Sync editContent whenever message.content updates
  React.useEffect(() => {
    setEditContent(message.content);
  }, [message.content]);

  const handlePlayVoice = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isMine ? 'flex-end' : 'flex-start',
      margin: '6px 0',
      maxWidth: '75%',
      alignSelf: isMine ? 'flex-end' : 'flex-start',
      position: 'relative'
    }}>
      {/* Sender name for remote user */}
      {!isMine && (
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px', marginLeft: '4px' }}>
          {message.senderDisplayName || message.senderName || 'Colleague'}
        </span>
      )}

      {/* Quoted Reply */}
      {message.replyTo && (
        <div style={{
          padding: '6px 10px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(0, 0, 0, 0.25)',
          borderLeft: '3px solid var(--accent-cyan)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          marginBottom: '4px',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          <strong style={{ color: 'var(--text-primary)' }}>{message.replyTo.senderName}:</strong> {message.replyTo.content}
        </div>
      )}

      {/* Main Bubble */}
      <div 
        className="glass-card"
        style={{
          padding: '10px 14px',
          borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isMine 
            ? 'var(--bubble-mine-bg)' 
            : 'var(--bubble-remote-bg)',
          border: isMine ? '1px solid var(--bubble-mine-border)' : '1px solid var(--border-subtle)',
          color: message.isDeleted ? 'var(--text-muted)' : (isMine ? 'var(--bubble-mine-text)' : 'var(--bubble-remote-text)'),
          fontStyle: message.isDeleted ? 'italic' : 'normal',
          boxShadow: 'var(--shadow-sm)',
          wordBreak: 'break-word',
          position: 'relative'
        }}
      >
        {/* Editing mode */}
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              type="text"
              className="input-field"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '6px 10px' }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <button
                onClick={() => setIsEditing(false)}
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="btn btn-primary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Voice Message Player */}
            {message.messageType === 'voice' && message.file && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '180px' }}>
                <audio
                  ref={audioRef}
                  src={message.file.url}
                  onEnded={() => setIsPlayingAudio(false)}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={handlePlayVoice}
                  className="btn btn-secondary btn-icon"
                  style={{ width: '34px', height: '34px' }}
                >
                  {isPlayingAudio ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Voice Message</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {message.file.duration ? `${Math.round(message.file.duration)}s` : 'Audio note'}
                  </div>
                </div>
              </div>
            )}

            {/* File Attachment */}
            {message.file && message.messageType !== 'voice' && (
              <div style={{ marginBottom: message.content ? '8px' : '0' }}>
                {message.file.category === 'image' ? (
                  <a href={message.file.url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                    <img
                      src={message.file.url}
                      alt={message.file.originalName}
                      style={{
                        maxWidth: '260px',
                        maxHeight: '200px',
                        borderRadius: 'var(--radius-md)',
                        objectFit: 'cover',
                        display: 'block'
                      }}
                    />
                  </a>
                ) : (
                  <a
                    href={message.file.url}
                    download={message.file.originalName}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <FileText size={20} color="var(--accent-cyan)" />
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {message.file.originalName}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {formatFileSize(message.file.size)}
                      </div>
                    </div>
                    <Download size={14} color="var(--text-muted)" style={{ marginLeft: 'auto' }} />
                  </a>
                )}
              </div>
            )}

            {/* Text Message Content */}
            {message.content && (
              <div style={{ fontSize: '0.88rem', lineHeight: '1.45' }}>
                {message.content}
              </div>
            )}
          </>
        )}

        {/* Footer info: Timestamp, edited mark, WhatsApp-style delivery receipts */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '4px',
          marginTop: '4px',
          fontSize: '0.65rem',
          color: 'var(--text-muted)'
        }}>
          {message.isEdited && <span>(edited)</span>}
          <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {isMine && (
            <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '3px' }} title={
              message.status === 'read' ? 'Read' : message.status === 'delivered' ? 'Delivered' : 'Sent'
            }>
              {message.status === 'read' ? (
                // Read: Double tick WhatsApp green
                <DoubleTickIcon color="#10b981" size={17} />
              ) : message.status === 'delivered' ? (
                // Delivered (user online): Double tick without color (gray)
                <DoubleTickIcon color="#94a3b8" size={17} />
              ) : (
                // Sent (user offline): Single tick without color (gray)
                <SingleTickIcon color="#94a3b8" size={17} />
              )}
            </span>
          )}
        </div>
      </div>

      {/* Hover Action Controls (Reply, Edit, Delete) */}
      {!message.isDeleted && !isEditing && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginTop: '2px',
          padding: '2px 4px'
        }}>
          {onReply && (
            <button
              onClick={() => onReply(message)}
              title="Reply"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
            >
              <Reply size={13} />
            </button>
          )}
          {isMine && onEdit && (
            <button
              onClick={() => setIsEditing(true)}
              title="Edit"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
            >
              <Edit2 size={13} />
            </button>
          )}
          {isMine && onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              title="Delete"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
