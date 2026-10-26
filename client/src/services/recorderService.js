// Meeting Recording Pipeline using HTML5 Canvas Compositing & Web Audio Stream Mixing

export class MeetingRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.audioContext = null;
    this.audioDestination = null;
    this.canvas = null;
    this.canvasCtx = null;
    this.animationFrameId = null;
    this.isRecording = false;
    this.startTime = null;
  }

  /**
   * Start recording meeting with composite canvas and mixed audio
   * @param {Array<HTMLVideoElement>} videoElements - video elements of participants or screen
   * @param {Array<MediaStream>} audioStreams - streams to mix into unified audio
   */
  startRecording(videoElements = [], audioStreams = []) {
    if (this.isRecording) return;
    this.recordedChunks = [];

    // Setup Canvas for video compositing
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1280;
    this.canvas.height = 720;
    this.canvasCtx = this.canvas.getContext('2d');

    // Setup Web Audio API to mix all participant audio tracks
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    this.audioDestination = this.audioContext.createMediaStreamDestination();

    // Connect all active audio streams to the mixer
    audioStreams.forEach(stream => {
      if (stream && stream.getAudioTracks().length > 0) {
        try {
          const source = this.audioContext.createMediaStreamSource(stream);
          source.connect(this.audioDestination);
        } catch (e) {
          console.warn('Could not connect audio stream to recorder mixer:', e);
        }
      }
    });

    // Drawing loop to composite video elements onto canvas
    const draw = () => {
      if (!this.isRecording) return;

      const ctx = this.canvasCtx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      // Dark background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      const activeVideos = videoElements.filter(v => v && v.readyState >= 2 && !v.paused);

      if (activeVideos.length === 0) {
        // Fallback placeholder screen
        ctx.fillStyle = '#1e293b';
        ctx.roundRect ? ctx.roundRect(40, 40, w - 80, h - 80, 16) : ctx.fillRect(40, 40, w - 80, h - 80);
        ctx.fill();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 32px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Connect WebRTC Meeting Recording', w / 2, h / 2 - 20);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '20px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Audio-only session or camera muted', w / 2, h / 2 + 30);
      } else if (activeVideos.length === 1) {
        // Single active video (e.g. screen share or single speaker)
        const v = activeVideos[0];
        ctx.drawImage(v, 0, 0, w, h);
      } else if (activeVideos.length === 2) {
        // Side by side 2 tiles
        const tileW = w / 2 - 10;
        const tileH = h - 20;
        ctx.drawImage(activeVideos[0], 5, 10, tileW, tileH);
        ctx.drawImage(activeVideos[1], w / 2 + 5, 10, tileW, tileH);
      } else {
        // 2x2 Grid for 3 or 4 tiles
        const tileW = w / 2 - 10;
        const tileH = h / 2 - 10;
        const coords = [
          [5, 5],
          [w / 2 + 5, 5],
          [5, h / 2 + 5],
          [w / 2 + 5, h / 2 + 5]
        ];
        activeVideos.slice(0, 4).forEach((v, idx) => {
          const [x, y] = coords[idx];
          ctx.drawImage(v, x, y, tileW, tileH);
        });
      }

      // Render timestamp badge watermark in bottom right
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.roundRect ? ctx.roundRect(w - 220, h - 50, 200, 36, 8) : ctx.fillRect(w - 220, h - 50, 200, 36);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '14px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`● REC  ${new Date().toLocaleTimeString()}`, w - 200, h - 26);

      this.animationFrameId = requestAnimationFrame(draw);
    };

    this.isRecording = true;
    this.startTime = Date.now();
    draw();

    // Capture stream from canvas at 30 fps
    const canvasStream = this.canvas.captureStream(30);

    // Combine canvas video track + mixed audio track
    const combinedTracks = [
      ...canvasStream.getVideoTracks(),
      ...this.audioDestination.stream.getAudioTracks()
    ];
    const combinedStream = new MediaStream(combinedTracks);

    // Select supported mimeType
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    try {
      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // 1-second chunks
      console.log('Meeting recording started with mimeType:', mimeType);
    } catch (err) {
      console.error('Failed to initialize MediaRecorder:', err);
      this.isRecording = false;
      throw err;
    }
  }

  /**
   * Stop recording and return combined Blob + duration
   */
  stopRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording) {
        resolve(null);
        return;
      }

      const durationSeconds = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
      this.isRecording = false;

      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder.mimeType || 'video/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });

        if (this.audioContext) {
          try { this.audioContext.close(); } catch (e) {}
          this.audioContext = null;
        }

        resolve({
          blob,
          duration: Math.round(durationSeconds),
          mimeType
        });
      };

      this.mediaRecorder.stop();
    });
  }
}
