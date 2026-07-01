export class Player {
  constructor() {
    this.audio = document.getElementById('audio-element');
    this.queue = [];
    this.originalQueue = [];
    this.userQueueInsertionIndex = -1;
    this.currentIndex = -1;
    this.isPlaying = false;
    this.isShuffle = false;
    this.repeatMode = 0; // 0: none, 1: all, 2: one
    this.onStateChange = null;
    this.onProgress = null;
    this.onTrackEnd = null;
    this.sleepTimer = null;
    
    // Web Audio API properties
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.visualizerData = null;
    this.canvasCtx = null;
    
    this._setupListeners();
    this._setupMediaSession();
  }

  _setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
    }
  }

  _setupListeners() {
    this.audio.addEventListener('play', () => { this.isPlaying = true; this._notifyStateChange(); });
    this.audio.addEventListener('pause', () => { this.isPlaying = false; this._notifyStateChange(); });
    this.audio.addEventListener('timeupdate', () => { if (this.onProgress) this.onProgress(this.audio.currentTime, this.audio.duration || 0); });
    this.audio.addEventListener('ended', () => {
      if (this.repeatMode === 2) {
        this.audio.currentTime = 0;
        this.audio.play();
      } else {
        if (this.onTrackEnd) this.onTrackEnd();
        this.next();
      }
    });
  }

  _notifyStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        isPlaying: this.isPlaying,
        currentTrack: this.getCurrentTrack(),
        isShuffle: this.isShuffle,
        repeatMode: this.repeatMode
      });
    }
  }



  async setQueue(tracks, startIndex = 0) {
    this.originalQueue = [...tracks];
    this.userQueueInsertionIndex = -1;
    if (this.isShuffle) {
      const first = tracks[startIndex];
      const rest = tracks.filter((_, i) => i !== startIndex).sort(() => Math.random() - 0.5);
      this.queue = [first, ...rest];
      this.currentIndex = 0;
    } else {
      this.queue = [...tracks];
      this.currentIndex = startIndex;
    }
    await this.loadCurrent();
    this.play();
  }

  async loadCurrent() {
    const track = this.getCurrentTrack();
    if (!track) return;
    
    // Offline support check
    if (window._app && window._app.downloads) {
      const localUrl = await window._app.downloads.getLocalAudioUrl(track.id);
      this.audio.src = localUrl ? localUrl : track.audioUrl;
    } else {
      this.audio.src = track.audioUrl;
    }

    this.audio.load();
    this._notifyStateChange();
    this._updateMediaSession(track);
  }

  _updateMediaSession(track) {
    if ('mediaSession' in navigator && track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || '',
        artwork: [{ src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
      });
    }
  }

  addToQueue(track) {
    const wasEmpty = this.queue.length === 0;
    if (wasEmpty) {
      this.queue.push(track);
      this.currentIndex = 0;
      this.loadCurrent();
      return;
    }
    
    if (this.userQueueInsertionIndex === -1 || this.userQueueInsertionIndex <= this.currentIndex) {
      this.userQueueInsertionIndex = this.currentIndex + 1;
    }
    
    this.queue.splice(this.userQueueInsertionIndex, 0, track);
    this.userQueueInsertionIndex++;
    this._notifyStateChange();
  }

  setSleepTimer(minutes) {
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
    if (minutes > 0) {
      this.sleepTimer = setTimeout(() => {
        this.pause();
        this.sleepTimer = null;
      }, minutes * 60 * 1000);
    }
  }

  _setupWebAudio() {
    if (this.audioContext) return;
    
    // Disable Web Audio API on mobile devices.
    // Routing audio through AudioContext causes the OS to suspend playback
    // when the app goes into the background on iOS/Android.
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    try {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      this.source = this.audioContext.createMediaElementSource(this.audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      
      this.visualizerData = new Uint8Array(this.analyser.frequencyBinCount);
      const canvas = document.getElementById('visualizer-canvas');
      if (canvas) {
        this.canvasCtx = canvas.getContext('2d');
        this._drawVisualizer(canvas);
      }
    } catch (e) {
      console.error("Web Audio API setup failed:", e);
    }
  }

  _drawVisualizer(canvas) {
    requestAnimationFrame(() => this._drawVisualizer(canvas));
    if (!this.canvasCtx || !this.isPlaying) return;
    
    // Handle resizing
    const width = canvas.width = canvas.clientWidth;
    const height = canvas.height = canvas.clientHeight;
    
    this.analyser.getByteFrequencyData(this.visualizerData);
    this.canvasCtx.clearRect(0, 0, width, height);
    
    const barWidth = (width / this.visualizerData.length) * 2.5;
    let barHeight;
    let x = 0;
    
    // Get primary color from CSS root
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7B2FBE';
    
    // Parse hex to RGB
    let r_base = 123, g_base = 47, b_base = 190;
    if (primaryColor.startsWith('#')) {
      const hex = primaryColor.replace('#', '');
      if (hex.length === 6) {
        r_base = parseInt(hex.substring(0, 2), 16);
        g_base = parseInt(hex.substring(2, 4), 16);
        b_base = parseInt(hex.substring(4, 6), 16);
      }
    }
    
    for (let i = 0; i < this.visualizerData.length; i++) {
      barHeight = this.visualizerData[i] * 2.5; // Scale height
      
      const r = Math.min(255, r_base + (barHeight / 4));
      const g = Math.min(255, g_base + (barHeight / 4));
      const b = Math.min(255, b_base + (barHeight / 4));
      
      this.canvasCtx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
      
      // Draw bars originating from the bottom
      this.canvasCtx.fillRect(x, height - barHeight / 2, barWidth, barHeight / 2);
      
      x += barWidth + 2;
    }
  }

  play() { 
    if (this.getCurrentTrack()) {
      if (!this.audioContext) {
        this._setupWebAudio();
      } else if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      this.audio.play().catch(e => console.error("Playback failed:", e)); 
    }
  }
  
  pause() { this.audio.pause(); }
  togglePlay() { this.isPlaying ? this.pause() : this.play(); }

  async next() {
    if (this.queue.length === 0) return;
    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
      await this.loadCurrent();
      this.play();
    } else if (this.repeatMode === 1) {
      this.currentIndex = 0;
      await this.loadCurrent();
      this.play();
    } else {
      this.pause();
      this.audio.currentTime = 0;
      this.currentIndex = 0;
      await this.loadCurrent();
    }
  }

  async prev() {
    if (this.queue.length === 0) return;
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      this.play();
      return;
    }
    if (this.currentIndex > 0) {
      this.currentIndex--;
      await this.loadCurrent();
      this.play();
    } else if (this.repeatMode === 1) {
      this.currentIndex = this.queue.length - 1;
      await this.loadCurrent();
      this.play();
    }
  }

  seek(time) { this.audio.currentTime = time; }
  setVolume(val) { this.audio.volume = val; }
  toggleShuffle() { 
    this.isShuffle = !this.isShuffle; 
    if (this.queue.length > 0) {
      if (this.isShuffle) {
        const played = this.queue.slice(0, this.currentIndex + 1);
        const unplayed = this.queue.slice(this.currentIndex + 1).sort(() => Math.random() - 0.5);
        this.queue = [...played, ...unplayed];
      } else {
        if (this.originalQueue && this.originalQueue.length > 0) {
          const currentTrack = this.queue[this.currentIndex];
          this.queue = [...this.originalQueue];
          this.currentIndex = this.queue.findIndex(t => t.id === currentTrack.id);
          if (this.currentIndex === -1) this.currentIndex = 0;
          this.userQueueInsertionIndex = -1;
        }
      }
    }
    this._notifyStateChange(); 
  }
  toggleRepeat() { this.repeatMode = (this.repeatMode + 1) % 3; this._notifyStateChange(); }
  getCurrentTrack() { return (this.currentIndex >= 0 && this.currentIndex < this.queue.length) ? this.queue[this.currentIndex] : null; }
}
