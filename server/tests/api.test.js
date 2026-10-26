const http = require('http');
const { WebSocket } = require('ws');
const { server } = require('../src/server');

const TEST_PORT = 5055;
let aliceToken;
let bobToken;
let aliceUser;
let bobUser;
let conversationId;
let meetingCode;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = options.headers || {};
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }
    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api${path}`,
      method: options.method || 'GET',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runTests() {
  console.log('\n=================================================');
  console.log(' Starting Automated API & Signaling Test Suite');
  console.log('=================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name} - ${details}`);
      failed++;
    }
  }

  // 1. Healthcheck
  try {
    const res = await request('/health');
    assert('Health endpoint returns status: online', res.status === 200 && res.data.status === 'online');
  } catch (e) {
    assert('Health endpoint', false, e.message);
  }

  // 2. Login demo users
  try {
    const loginAlice = await request('/auth/login', {
      method: 'POST',
      body: { email: 'nithish@connect.local', password: 'password123' }
    });
    assert('Nithish login succeeds with JWT', loginAlice.status === 200 && loginAlice.data.token);
    aliceToken = loginAlice.data.token;
    aliceUser = loginAlice.data.user;

    const loginBob = await request('/auth/login', {
      method: 'POST',
      body: { email: 'surya@connect.local', password: 'password123' }
    });
    assert('Surya login succeeds with JWT', loginBob.status === 200 && loginBob.data.token);
    bobToken = loginBob.data.token;
    bobUser = loginBob.data.user;
  } catch (e) {
    assert('User Login', false, e.message);
  }

  // 3. User Directory
  try {
    const dirRes = await request('/users', { token: aliceToken });
    assert('Directory list returns active team members', dirRes.status === 200 && Array.isArray(dirRes.data.users));
    assert('Directory excludes current requesting user', !dirRes.data.users.some(u => u.id === aliceUser.id));
  } catch (e) {
    assert('User Directory', false, e.message);
  }

  // 4. Conversation & Messages
  try {
    const convRes = await request('/messages/conversations/direct', {
      method: 'POST',
      token: aliceToken,
      body: { targetUserId: bobUser.id }
    });
    assert('Get or create direct conversation between Nithish and Surya', convRes.status === 200 || convRes.status === 201);
    conversationId = convRes.data.conversationId;

    // Send message from Nithish
    const msgRes = await request(`/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      token: aliceToken,
      body: { content: 'Automated test message from Nithish' }
    });
    assert('Nithish sends persistent message to Surya', msgRes.status === 201 && msgRes.data.message.content.includes('Nithish'));
    const messageId = msgRes.data.message.id;

    // Fetch messages
    const fetchMsgs = await request(`/messages/conversations/${conversationId}/messages`, {
      token: bobToken
    });
    assert('Surya receives persisted messages from DB', fetchMsgs.status === 200 && fetchMsgs.data.messages.length > 0);

    // Edit message
    const editRes = await request(`/messages/${messageId}`, {
      method: 'PUT',
      token: aliceToken,
      body: { content: 'Alice edited this message' }
    });
    assert('Alice edits own message', editRes.status === 200 && editRes.data.success);

    // Mark as read
    const readRes = await request(`/messages/conversations/${conversationId}/read`, {
      method: 'POST',
      token: bobToken
    });
    assert('Bob marks conversation as read', readRes.status === 200 && readRes.data.success);
  } catch (e) {
    assert('Messages API', false, e.message);
  }

  // 5. Meetings API
  try {
    const createMtg = await request('/meetings/create', {
      method: 'POST',
      token: aliceToken,
      body: { title: 'Sprint Architecture Sync', password: 'pass', maxParticipants: 6 }
    });
    assert('Meeting room created with unique code', createMtg.status === 201 && createMtg.data.meeting.code);
    meetingCode = createMtg.data.meeting.code;

    // Validate meeting with correct password
    const valGood = await request('/meetings/validate', {
      method: 'POST',
      token: bobToken,
      body: { code: meetingCode, password: 'pass' }
    });
    assert('Bob validates meeting with correct password', valGood.status === 200 && valGood.data.meeting.code === meetingCode);

    // Validate meeting with wrong password
    const valBad = await request('/meetings/validate', {
      method: 'POST',
      token: bobToken,
      body: { code: meetingCode, password: 'wrong' }
    });
    assert('Protected meeting rejects wrong password (401)', valBad.status === 401);
  } catch (e) {
    assert('Meetings API', false, e.message);
  }

  // 6. Call Logging API
  try {
    const callRes = await request('/calls/log', {
      method: 'POST',
      token: aliceToken,
      body: {
        calleeId: bobUser.id,
        callType: 'video',
        status: 'completed',
        durationSeconds: 120
      }
    });
    assert('Call session logged in database', callRes.status === 201 && callRes.data.success);

    const histRes = await request('/calls/history', { token: aliceToken });
    assert('Call history returned for Alice', histRes.status === 200 && histRes.data.calls.length > 0);
  } catch (e) {
    assert('Calls Logging', false, e.message);
  }

  // 7. WebSocket Signaling Handshake
  try {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/ws`);
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'auth', payload: { token: aliceToken } }));
      });
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'auth-success') {
          assert('WebSocket signaling authenticated Alice & dispatched online status', true);
          ws.close();
          resolve();
        }
      });
      ws.on('error', (err) => {
        assert('WebSocket signaling connection', false, err.message);
        reject(err);
      });
      setTimeout(() => reject(new Error('WebSocket auth timeout')), 3000);
    });
  } catch (e) {
    assert('WebSocket Handshake', false, e.message);
  }

  console.log('\n=================================================');
  console.log(` Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('=================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Start test server on TEST_PORT
server.listen(TEST_PORT, () => {
  runTests();
});
