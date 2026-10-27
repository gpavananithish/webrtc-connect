// Centralized REST API Service for Connect WebRTC
const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  getToken() {
    return localStorage.getItem('connect_auth_token');
  }

  setToken(token) {
    if (token) {
      localStorage.setItem('connect_auth_token', token);
    } else {
      localStorage.removeItem('connect_auth_token');
    }
  }

  // Resolve relative endpoint/file path against backend API_BASE
  getFullUrl(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const cleanBase = API_BASE.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    // If path already starts with api/ and cleanBase ends with /api
    if (cleanBase.endsWith('/api') && cleanPath.startsWith('api/')) {
      return `${cleanBase}/${cleanPath.slice(4)}`;
    }
    return `${cleanBase}/${cleanPath}`;
  }

  async request(endpoint, options = {}) {
    const headers = options.headers || {};
    const token = this.getToken();

    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers
    };

    const response = await fetch(`${API_BASE}${endpoint}`, config);

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMsg = (data && data.error) || response.statusText || 'Request failed';
      const error = new Error(errorMsg);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  // --- Auth ---
  login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  getMe() {
    return this.request('/auth/me');
  }

  updateProfile(profileData) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  }

  getDemoUsers() {
    return this.request('/auth/demo-users');
  }

  // --- Users Directory ---
  getUsers(query = '') {
    const q = query ? `?q=${encodeURIComponent(query)}` : '';
    return this.request(`/users${q}`);
  }

  getUser(id) {
    return this.request(`/users/${id}`);
  }

  // --- Conversations & Messages ---
  getConversations() {
    return this.request('/messages/conversations');
  }

  getOrCreateDirectConversation(targetUserId) {
    return this.request('/messages/conversations/direct', {
      method: 'POST',
      body: JSON.stringify({ targetUserId })
    });
  }

  getMessages(conversationId) {
    return this.request(`/messages/conversations/${conversationId}/messages`);
  }

  sendMessage(conversationId, { content, messageType = 'text', fileId = null, replyToId = null }) {
    return this.request(`/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, messageType, fileId, replyToId })
    });
  }

  markConversationAsRead(conversationId) {
    return this.request(`/messages/conversations/${conversationId}/read`, {
      method: 'POST'
    });
  }

  editMessage(messageId, content) {
    return this.request(`/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    });
  }

  deleteMessage(messageId) {
    return this.request(`/messages/${messageId}`, {
      method: 'DELETE'
    });
  }

  // --- Calls ---
  getCallHistory() {
    return this.request('/calls/history');
  }

  logCall(callData) {
    return this.request('/calls/log', {
      method: 'POST',
      body: JSON.stringify(callData)
    });
  }

  // --- Meetings ---
  createMeeting({ title, password, maxParticipants }) {
    return this.request('/meetings/create', {
      method: 'POST',
      body: JSON.stringify({ title, password, maxParticipants })
    });
  }

  validateMeeting(code, password) {
    return this.request('/meetings/validate', {
      method: 'POST',
      body: JSON.stringify({ code, password })
    });
  }

  getMeetingHistory() {
    return this.request('/meetings/history');
  }

  endMeeting(meetingId) {
    return this.request(`/meetings/${meetingId}/end`, {
      method: 'POST'
    });
  }

  // --- Files & Voice ---
  uploadFile(file, conversationId) {
    const formData = new FormData();
    formData.append('file', file);
    if (conversationId) formData.append('conversationId', conversationId);
    return this.request('/files/upload', {
      method: 'POST',
      body: formData
    });
  }

  uploadVoiceMessage(audioBlob, duration, conversationId) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice-note.webm');
    formData.append('duration', duration);
    if (conversationId) formData.append('conversationId', conversationId);
    return this.request('/files/voice', {
      method: 'POST',
      body: formData
    });
  }

  // --- Recordings ---
  uploadRecording(recordingBlob, { meetingId, meetingTitle, duration }) {
    const formData = new FormData();
    formData.append('recording', recordingBlob, 'meeting-recording.webm');
    if (meetingId) formData.append('meetingId', meetingId);
    if (meetingTitle) formData.append('meetingTitle', meetingTitle);
    formData.append('duration', duration);
    return this.request('/recordings/upload', {
      method: 'POST',
      body: formData
    });
  }

  getRecordings() {
    return this.request('/recordings');
  }

  deleteRecording(recordingId) {
    return this.request(`/recordings/${recordingId}`, {
      method: 'DELETE'
    });
  }

  // --- ICE / Config ---
  getIceServers() {
    return this.request('/config/ice-servers');
  }
}

export const api = new ApiService();
