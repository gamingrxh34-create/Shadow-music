import { Player } from './player.js';
import { db } from './indexeddb.js';
import { Search } from './search.js';
import { recentlyPlayed } from './recentlyPlayed.js';
import { Playlists } from './playlists.js';
import { Downloads } from './downloads.js';

class App {
  constructor() {
    this.player = new Player();
    this.allSongs = [];
    this.artistsData = {};
    this.init();
  }

  async init() {
    await db.init();
    this.bindNavigation();
    this.bindPlayerControls();
    
    await this.loadData();
    this.search = new Search(this);
    this.playlists = new Playlists(this);
    this.downloads = new Downloads(this);
    
    this.initTheme();
    this.setupKeyboardShortcuts();
    
    this.player.onTrackEnd = async () => {
      const track = this.player.getCurrentTrack();
      if(track) await recentlyPlayed.addRecord(track);
      this.renderRecentView();
    };

    this.renderHome();
    this.search.handleSearch('');
    this.renderLikedView();
    this.renderRecentView();
    this.renderDownloadsView();
    this.renderQueueView();
    
    this.switchView('home-view');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => console.log('SW registered', reg))
        .catch(err => console.error('SW failed', err));
    }
  }
  initTheme() {
    const savedTheme = localStorage.getItem('shadow_theme_name') || 'original';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Clean up old variable just in case
    document.documentElement.style.removeProperty('--accent');

    const updateActiveSwatch = (activeTheme) => {
      document.querySelectorAll('.theme-swatch').forEach(swatch => {
        if (swatch.getAttribute('data-theme') === activeTheme) {
          swatch.classList.add('active');
        } else {
          swatch.classList.remove('active');
        }
      });
    };

    updateActiveSwatch(savedTheme);

    document.querySelectorAll('.theme-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        const theme = e.target.getAttribute('data-theme');
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('shadow_theme_name', theme);
        updateActiveSwatch(theme);
      });
    });
  }

  async loadData() {
    try {
      const [resSongs, resArtists] = await Promise.all([
        fetch('data/songs.json'),
        fetch('data/artists.json').catch(() => null)
      ]);
      this.allSongs = await resSongs.json();
      this.artistsData = resArtists && resArtists.ok ? await resArtists.json() : {};
    } catch (e) {
      console.error("Failed to load data:", e);
      this.artistsData = {};
    }
  }

  bindNavigation() {
    document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-target');
        if (target) {
          this.switchView(target);
          document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
          document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.remove('active'));
          document.querySelectorAll(`[data-target="${target}"]`).forEach(n => n.classList.add('active'));
        }
      });
    });

    const infoBtn = document.getElementById('floating-info-btn');
    const infoModal = document.getElementById('dev-info-modal');
    const closeInfoBtn = document.getElementById('close-dev-info-btn');
    if (infoBtn && infoModal && closeInfoBtn) {
      infoBtn.addEventListener('click', () => infoModal.classList.add('active'));
      closeInfoBtn.addEventListener('click', () => infoModal.classList.remove('active'));
    }
  }

  switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(viewId);
    if (view) view.classList.add('active');
    
    const dlBtn = document.getElementById('download-playlist-btn');
    if (dlBtn) dlBtn.classList.toggle('hidden', viewId !== 'playlist-view');
  }

  bindPlayerControls() {
    document.getElementById('btn-play-pause').addEventListener('click', () => this.player.togglePlay());
    document.getElementById('btn-mobile-play').addEventListener('click', (e) => { e.stopPropagation(); this.player.togglePlay(); });
    
    // Overlay controls
    document.getElementById('np-btn-play-pause').addEventListener('click', () => this.player.togglePlay());
    document.getElementById('np-btn-next').addEventListener('click', () => this.player.next());
    document.getElementById('np-btn-prev').addEventListener('click', () => this.player.prev());
    document.getElementById('np-btn-shuffle').addEventListener('click', () => this.player.toggleShuffle());
    document.getElementById('np-btn-repeat').addEventListener('click', () => this.player.toggleRepeat());
    const npProgContainer = document.getElementById('np-progress-container');
    if (npProgContainer) {
      npProgContainer.addEventListener('click', (e) => {
        const rect = npProgContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        if (this.player.audio.duration) this.player.seek(pos * this.player.audio.duration);
      });
    }

    const showLyricsBtn = document.getElementById('np-show-lyrics-btn');
    if (showLyricsBtn) {
      showLyricsBtn.addEventListener('click', (e) => {
        const textContainer = document.getElementById('np-lyrics-text');
        if (!textContainer) return;
        if (textContainer.style.maxHeight === 'none') {
          textContainer.style.maxHeight = '120px';
          e.target.textContent = 'Show lyrics';
        } else {
          textContainer.style.maxHeight = 'none';
          e.target.textContent = 'Hide lyrics';
        }
      });
    }

    document.querySelector('.player-left').addEventListener('click', (e) => {
      if (window.innerWidth <= 600 && !e.target.closest('.player-btn')) {
        document.getElementById('now-playing-overlay').classList.add('active');
      }
    });
    document.getElementById('btn-next').addEventListener('click', () => this.player.next());
    document.getElementById('btn-prev').addEventListener('click', () => this.player.prev());
    document.getElementById('btn-shuffle').addEventListener('click', () => this.player.toggleShuffle());
    document.getElementById('btn-repeat').addEventListener('click', () => this.player.toggleRepeat());

    const progContainer = document.getElementById('progress-container');
    progContainer.addEventListener('click', (e) => {
      const rect = progContainer.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      if (this.player.audio.duration) this.player.seek(pos * this.player.audio.duration);
    });

    const volContainer = document.getElementById('volume-container');
    volContainer.addEventListener('click', (e) => {
      const rect = volContainer.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.player.setVolume(pos);
      document.getElementById('volume-bar').style.width = `${pos * 100}%`;
      
      const muteBtn = document.getElementById('btn-mute');
      if (muteBtn) {
        if (pos === 0) muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        else if (pos < 0.5) muteBtn.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
        else muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
      }
    });
    this.player.setVolume(1);
    document.getElementById('volume-bar').style.width = '100%';
    
    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        if (this.player.audio.volume > 0) {
          this.player.previousVolume = this.player.audio.volume;
          this.player.setVolume(0);
          document.getElementById('volume-bar').style.width = '0%';
          muteBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        } else {
          const vol = this.player.previousVolume || 1;
          this.player.setVolume(vol);
          document.getElementById('volume-bar').style.width = `${vol * 100}%`;
          if (vol < 0.5) muteBtn.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
          else muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        }
      });
    }

    this.player.onStateChange = (state) => {
      this.updatePlayerUI(state);
      this.updateLikeButton(state.currentTrack);
      if(state.isPlaying && state.currentTrack) recentlyPlayed.addRecord(state.currentTrack);
      this.renderQueueView();
    };
    this.player.onProgress = (cur, tot) => this.updateProgressUI(cur, tot);
    
    document.getElementById('player-like-btn').addEventListener('click', async () => {
      const track = this.player.getCurrentTrack();
      if (track) await this.toggleLike(track);
    });

    // New Controls
    const rightSidebar = document.getElementById('right-sidebar');
    document.getElementById('btn-now-playing-view').addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('active');
      rightSidebar.classList.toggle('collapsed');
    });
    
    document.getElementById('close-rs-btn').addEventListener('click', () => {
      document.getElementById('btn-now-playing-view').classList.remove('active');
      rightSidebar.classList.add('collapsed');
    });

    document.getElementById('rs-like-btn').addEventListener('click', async () => {
      const track = this.player.getCurrentTrack();
      if (track) await this.toggleLike(track);
    });

    document.getElementById('rs-open-queue').addEventListener('click', () => {
      this.switchView('queue-view');
    });

    document.getElementById('global-home-btn').addEventListener('click', () => {
      this.switchView('home-view');
      document.getElementById('global-search-input').value = '';
    });

    document.getElementById('btn-queue').addEventListener('click', () => {
      this.switchView('queue-view');
    });

    document.getElementById('floating-info-btn').addEventListener('click', () => {
      document.getElementById('dev-info-modal').classList.add('active');
    });

    const mobInfoBtn = document.getElementById('mobile-info-btn');
    if (mobInfoBtn) {
      mobInfoBtn.addEventListener('click', () => {
        document.getElementById('dev-info-modal').classList.add('active');
      });
    }

    document.getElementById('close-dev-info-btn').addEventListener('click', () => {
      document.getElementById('dev-info-modal').classList.remove('active');
    });

    document.getElementById('global-search-input').addEventListener('input', (e) => {
      this.search.handleSearch(e.target.value);
    });

    const mobSearchInput = document.getElementById('mobile-search-input');
    if (mobSearchInput) {
      mobSearchInput.addEventListener('input', (e) => {
        this.search.handleSearch(e.target.value);
      });
    }

    document.getElementById('btn-fullscreen').addEventListener('click', () => {
      document.getElementById('now-playing-overlay').classList.add('active');
    });

    document.getElementById('close-now-playing-btn').addEventListener('click', () => {
      document.getElementById('now-playing-overlay').classList.remove('active');
    });

    const sleepBtn = document.getElementById('btn-sleep-timer');
    const sleepMenu = document.getElementById('sleep-timer-menu');
    sleepBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sleepMenu.classList.toggle('active');
    });
    document.addEventListener('click', () => sleepMenu.classList.remove('active'));
    
    document.querySelectorAll('.sleep-timer-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        const time = parseInt(e.target.getAttribute('data-time'), 10);
        this.player.setSleepTimer(time);
        document.querySelectorAll('.sleep-timer-option').forEach(o => o.classList.remove('active'));
        e.target.classList.add('active');
        sleepBtn.classList.toggle('active', time > 0);
      });
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        this.player.togglePlay();
      } else if (e.code === 'ArrowRight' && e.ctrlKey) {
        this.player.next();
      } else if (e.code === 'ArrowLeft' && e.ctrlKey) {
        this.player.prev();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        const v = Math.min(1, this.player.audio.volume + 0.1);
        this.player.setVolume(v);
        document.getElementById('volume-bar').style.width = `${v * 100}%`;
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        const v = Math.max(0, this.player.audio.volume - 0.1);
        this.player.setVolume(v);
        document.getElementById('volume-bar').style.width = `${v * 100}%`;
      }
    });
  }

  async toggleLike(track) {
    const existing = await db.get('likes', track.id);
    existing ? await db.delete('likes', track.id) : await db.put('likes', track);
    this.updateLikeButton(track);
    this.renderLikedView();
  }

  async updateLikeButton(track) {
    const btn = document.getElementById('player-like-btn');
    const rsBtn = document.getElementById('rs-like-btn');
    if (!track) {
      btn.innerHTML = '<i class="fa-regular fa-star"></i>';
      btn.classList.remove('liked');
      if (rsBtn) {
        rsBtn.classList.remove('liked', 'fa-solid');
        rsBtn.classList.add('fa-regular');
      }
      return;
    }
    const existing = await db.get('likes', track.id);
    if (existing) {
      btn.innerHTML = '<i class="fa-solid fa-star"></i>';
      btn.classList.add('liked');
      if (rsBtn) {
        rsBtn.classList.add('liked', 'fa-solid');
        rsBtn.classList.remove('fa-regular');
      }
    } else {
      btn.innerHTML = '<i class="fa-regular fa-star"></i>';
      btn.classList.remove('liked');
      if (rsBtn) {
        rsBtn.classList.remove('liked', 'fa-solid');
        rsBtn.classList.add('fa-regular');
      }
    }
  }

  updatePlayerUI(state) {
    const ppBtn = document.getElementById('btn-play-pause');
    const mpBtn = document.getElementById('btn-mobile-play');
    const npBtn = document.getElementById('np-btn-play-pause');
    const icon = state.isPlaying ? '<i class="fa-solid fa-circle-pause"></i>' : '<i class="fa-solid fa-circle-play"></i>';
    ppBtn.innerHTML = icon;
    if (mpBtn) mpBtn.innerHTML = icon;
    if (npBtn) {
      npBtn.innerHTML = state.isPlaying 
        ? '<i class="fa-solid fa-pause"></i>' 
        : '<i class="fa-solid fa-play" style="margin-left:4px;"></i>';
    }

    document.getElementById('btn-shuffle').classList.toggle('active', state.isShuffle);
    const npShuffle = document.getElementById('np-btn-shuffle');
    if (npShuffle) npShuffle.classList.toggle('active', state.isShuffle);
    
    const repBtn = document.getElementById('btn-repeat');
    const npRepBtn = document.getElementById('np-btn-repeat');
    [repBtn, npRepBtn].forEach(btn => {
      if (!btn) return;
      btn.classList.remove('active');
      btn.innerHTML = '<i class="fa-solid fa-repeat"></i>';
      if (state.repeatMode === 1) btn.classList.add('active');
      if (state.repeatMode === 2) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-repeat"></i><span style="font-size:10px;position:absolute;top:2px;right:2px">1</span>';
      }
    });

    if (state.currentTrack) {
      document.body.classList.add('has-player');
      document.getElementById('player-title').textContent = state.currentTrack.title;
      document.getElementById('player-artist').textContent = state.currentTrack.artist;
      document.getElementById('player-cover').src = state.currentTrack.coverUrl;

      
      const artistInfo = this.artistsData[state.currentTrack.artist] || { bio: "Known for their unique sound and style.", image: null };
      const bio = state.currentTrack.bio || artistInfo.bio;
      const artistImage = artistInfo.image;
      const lyrics = state.currentTrack.lyrics || "(Lyrics not available)";

      // Update fullscreen overlay
      document.getElementById('np-title-large').textContent = state.currentTrack.title;
      document.getElementById('np-artist-name-card').textContent = state.currentTrack.artist;
      document.getElementById('np-cover-large').src = state.currentTrack.coverUrl;
      document.getElementById('np-artist-bio').textContent = bio;
      document.getElementById('np-artist-image').src = artistImage || state.currentTrack.coverUrl;
      
      const lyricsContainer = document.getElementById('np-lyrics-text');
      if (lyricsContainer) {
        lyricsContainer.innerHTML = lyrics;
        lyricsContainer.style.maxHeight = '120px';
      }
      
      const showLyricsBtn = document.getElementById('np-show-lyrics-btn');
      if (showLyricsBtn) showLyricsBtn.textContent = 'Show lyrics';

      // Update Right Sidebar
      document.getElementById('rs-title').textContent = state.currentTrack.title;
      document.getElementById('rs-artist').textContent = state.currentTrack.artist;
      document.getElementById('rs-cover').src = state.currentTrack.coverUrl;
      
      document.getElementById('rs-artist-bio').textContent = bio;
      const imgPlaceholder = document.querySelector('.rs-artist-img-placeholder');
      if (imgPlaceholder) {
        if (artistImage && artistImage !== "PLACEHOLDER_ARTIST_IMAGE_URL") {
          imgPlaceholder.innerHTML = `<img src="${artistImage}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
          imgPlaceholder.innerHTML = `<i class="fa-solid fa-user"></i>`;
        }
      }
      
      const rsLyricsContainer = document.querySelector('.rs-lyrics-text');
      if (rsLyricsContainer) rsLyricsContainer.innerHTML = lyrics;
      
      const qList = document.getElementById('np-queue-list');
      if (qList) {
        qList.innerHTML = '';
        const upNext = this.player.queue.slice(this.player.currentIndex + 1, this.player.currentIndex + 4);
        if (upNext.length === 0) {
          qList.innerHTML = '<div style="color:var(--text-subdued);font-size:14px;">No upcoming tracks</div>';
        } else {
          upNext.forEach((song, i) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '12px';
            row.style.alignItems = 'center';
            row.style.cursor = 'pointer';
            row.innerHTML = `
              <img src="${song.coverUrl}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;">
              <div style="display:flex;flex-direction:column;overflow:hidden;">
                <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${song.title}</div>
                <div style="font-size:12px;color:var(--text-subdued);">${song.artist}</div>
              </div>
            `;
            row.addEventListener('click', async () => {
              this.player.currentIndex = this.player.currentIndex + 1 + i;
              await this.player.loadCurrent();
              this.player.play();
            });
            qList.appendChild(row);
          });
        }
      }
      
      const nextIndex = this.player.currentIndex + 1;
      if (nextIndex < this.player.queue.length) {
        const nextTrack = this.player.queue[nextIndex];
        document.getElementById('rs-next-title').textContent = nextTrack.title;
        document.getElementById('rs-next-artist').textContent = nextTrack.artist;
        document.querySelector('.rs-next-img-placeholder').innerHTML = `<img src="${nextTrack.coverUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">`;
      } else {
        document.getElementById('rs-next-title').textContent = "No track";
        document.getElementById('rs-next-artist').textContent = "Add songs to queue";
        document.querySelector('.rs-next-img-placeholder').innerHTML = `<i class="fa-solid fa-music"></i>`;
      }
    } else {
      document.body.classList.remove('has-player');
    }
  }

  updateProgressUI(current, total) {
    const formatTime = (sec) => {
      if (isNaN(sec)) return "0:00";
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    };
    
    document.getElementById('time-current').textContent = formatTime(current);
    document.getElementById('time-total').textContent = formatTime(total);
    const npCurr = document.getElementById('np-time-current');
    if (npCurr) npCurr.textContent = formatTime(current);
    const npTot = document.getElementById('np-time-total');
    if (npTot) npTot.textContent = formatTime(total);

    const percent = total ? (current / total) * 100 : 0;
    document.getElementById('progress-bar').style.width = `${percent}%`;
    const npProg = document.getElementById('np-progress-bar');
    if (npProg) npProg.style.width = `${percent}%`;
  }

  renderHome() {
    this.renderRecentHomeGrid();
    const discoverGrid = document.getElementById('home-discover-grid');
    discoverGrid.innerHTML = '';
    
    const artistMap = {};
    
    this.allSongs.forEach(song => {
      if (!artistMap[song.artist]) artistMap[song.artist] = { name: song.artist, songs: [] };
      artistMap[song.artist].songs.push(song);
    });
    
    Object.values(artistMap).forEach(artist => {
      const artistInfo = this.artistsData[artist.name] || {};
      const img = artistInfo.image || (artist.songs.length > 0 ? artist.songs[0].coverUrl : '');
      
      const el = document.createElement('div');
      el.className = 'media-card';
      
      const imgContent = img 
        ? `<img src="${img}" alt="${artist.name}" style="border-radius: 50%; width: 100%; height: 100%; object-fit: cover;">`
        : `<div style="border-radius: 50%; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--bg-active); font-size: 32px;"><i class="fa-solid fa-user"></i></div>`;

      el.innerHTML = `
        <div class="media-card-img-container" style="border-radius: 50%;">
          ${imgContent}
        </div>
        <h4>${artist.name}</h4>
        <p>Artist</p>
      `;
      el.addEventListener('click', () => this.openArtistView(artist.name));
      discoverGrid.appendChild(el);
    });
  }

  openArtistView(artistName) {
    this.switchView('artist-view');
    const artistSongs = this.allSongs.filter(s => s.artist === artistName);
    const artistInfo = this.artistsData[artistName] || {};
    
    document.getElementById('artist-view-title').textContent = artistName;
    document.getElementById('artist-view-stats').textContent = `${artistSongs.length} songs`;
    document.getElementById('artist-view-bio').textContent = artistInfo.bio || "Explore their top tracks.";
    document.getElementById('artist-view-cover').src = artistInfo.image || (artistSongs.length > 0 ? artistSongs[0].coverUrl : '');
    
    const trackList = document.getElementById('artist-track-list');
    trackList.innerHTML = '';
    artistSongs.forEach((song, idx) => {
      trackList.appendChild(this.createTrackRow(song, idx, artistSongs));
    });
    
    const playBtn = document.getElementById('play-artist-btn');
    if (playBtn) {
      playBtn.onclick = () => this.player.setQueue(artistSongs, 0);
    }
  }

  async renderRecentHomeGrid() {
    const recentGrid = document.getElementById('home-recent-grid');
    recentGrid.innerHTML = '';
    const history = await recentlyPlayed.getHistory();
    const limited = history.slice(0, 6);
    if (limited.length === 0) {
      recentGrid.innerHTML = '<div style="color: var(--text-subdued); padding: 16px;">Play some music to see history here!</div>';
    }
    limited.forEach((song) => {
      recentGrid.appendChild(this.createCard(song, () => this.player.setQueue(limited, limited.indexOf(song))));
    });
  }

  createCard(song, onClick) {
    const el = document.createElement('div');
    el.className = 'media-card';
    el.innerHTML = `
      <div class="media-card-img-container">
        <img src="${song.coverUrl}" alt="${song.title}">
        <button class="play-btn-overlay"><i class="fa-solid fa-play"></i></button>
      </div>
      <h4>${song.title}</h4>
      <p>${song.artist}</p>
    `;
    el.addEventListener('click', onClick);
    return el;
  }

  createTrackRow(song, index, contextList, options = {}) {
    const el = document.createElement('div');
    el.className = 'track-row';
    el.innerHTML = `
      <div class="track-num">${index + 1}</div>
      <div class="track-info">
        <img class="track-img" src="${song.coverUrl}" alt="">
        <div class="track-text">
          <div class="track-name">${song.title}</div>
          <div class="track-artist artist-link" style="cursor:pointer;" data-artist="${song.artist}">${song.artist}</div>
        </div>
      </div>
      <div class="track-album">${song.album}</div>
      <div class="track-actions">
        ${options.playlistId ? `<i class="fa-solid fa-trash remove-from-pl-btn" title="Remove from Playlist" style="margin-right:8px; color:var(--text-subdued);"></i>` : ''}
        <i class="fa-solid fa-plus add-to-queue-btn" title="Add to Queue" style="margin-right:8px;"></i>
        <i class="fa-regular fa-star like-toggle-btn" data-id="${song.id}"></i>
        <i class="fa-solid fa-ellipsis"></i>
      </div>
    `;

    el.addEventListener('click', (e) => {
      if (e.target.closest('.artist-link')) {
        e.stopPropagation();
        this.renderArtistView(song.artist);
        return;
      }
      if (e.target.closest('.track-actions')) return; // Ignore clicks inside actions container
      this.player.setQueue(contextList, index);
    });

    const likeBtn = el.querySelector('.like-toggle-btn');
    db.get('likes', song.id).then(existing => {
      if(existing) { likeBtn.classList.remove('fa-regular'); likeBtn.classList.add('fa-solid', 'liked'); }
    });

    likeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.toggleLike(song);
      const existing = await db.get('likes', song.id);
      if(existing) { likeBtn.classList.remove('fa-regular'); likeBtn.classList.add('fa-solid', 'liked'); }
      else { likeBtn.classList.remove('fa-solid', 'liked'); likeBtn.classList.add('fa-regular'); }
    });
    
    const ellipsisBtn = el.querySelector('.fa-ellipsis');
    ellipsisBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.playlists.openAddToPlaylistModal(song);
    });

    const addQueueBtn = el.querySelector('.add-to-queue-btn');
    addQueueBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.player.addToQueue(song);
      this.renderQueueView();
    });
    
    if (options.playlistId) {
      const rmBtn = el.querySelector('.remove-from-pl-btn');
      rmBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.playlists.removeSongFromPlaylist(options.playlistId, song.id);
      });
    }

    return el;
  }

  async renderLikedView() {
    const likedSongs = await db.getAll('likes');
    const list = document.getElementById('liked-track-list');
    const stats = document.getElementById('liked-stats');
    list.innerHTML = '';
    stats.textContent = `${likedSongs.length} songs`;
    
    if (likedSongs.length === 0) {
      list.innerHTML = '<div style="padding: 24px; color: var(--text-subdued);">No liked songs yet.</div>';
      document.getElementById('play-liked-btn').style.opacity = '0.5';
      document.getElementById('play-liked-btn').onclick = null;
      return;
    }

    document.getElementById('play-liked-btn').style.opacity = '1';
    document.getElementById('play-liked-btn').onclick = () => this.player.setQueue(likedSongs, 0);
    likedSongs.forEach((song, i) => list.appendChild(this.createTrackRow(song, i, likedSongs)));
  }

  async renderRecentView() {
    const history = await recentlyPlayed.getHistory();
    const list = document.getElementById('recent-track-list');
    list.innerHTML = '';
    if (history.length === 0) {
      list.innerHTML = '<div style="padding: 24px; color: var(--text-subdued);">No play history.</div>';
      return;
    }
    history.forEach((song, i) => list.appendChild(this.createTrackRow(song, i, history)));
  }

  async renderDownloadsView() {
    const dlFilterBtn = document.querySelector('.filter-btn[data-filter="downloads"]');
    const grid = document.getElementById('library-grid');
    if(dlFilterBtn && grid) {
      dlFilterBtn.addEventListener('click', async () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        dlFilterBtn.classList.add('active');
        
        const downloads = await db.getAll('downloads');
        grid.innerHTML = '';
        if(downloads.length === 0) {
          grid.innerHTML = '<div style="padding: 24px; color: var(--text-subdued);">No downloaded songs yet.</div>';
          return;
        }
        
        const card = document.createElement('div');
        card.className = 'media-card';
        card.innerHTML = `
          <div class="media-card-img-container">
            <div class="placeholder"><i class="fa-solid fa-download"></i></div>
            <button class="play-btn-overlay"><i class="fa-solid fa-play"></i></button>
          </div>
          <h4>Offline Tracks</h4>
          <p>${downloads.length} songs</p>
        `;
        const songs = downloads.map(d => d.song);
        card.addEventListener('click', () => this.player.setQueue(songs, 0));
        grid.appendChild(card);
      });
      
      const plFilterBtn = document.querySelector('.filter-btn[data-filter="playlists"]');
      if(plFilterBtn) {
        plFilterBtn.addEventListener('click', () => {
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          plFilterBtn.classList.add('active');
          this.playlists.renderLibraryPlaylists();
        });
      }
    }
  }
  renderQueueView() {
    const npList = document.getElementById('queue-now-playing');
    const nextList = document.getElementById('queue-next-list');
    if (!npList || !nextList) return;
    
    npList.innerHTML = '';
    nextList.innerHTML = '';
    
    const current = this.player.getCurrentTrack();
    if (current) {
      npList.appendChild(this.createTrackRow(current, this.player.currentIndex, this.player.queue));
      
      // Refresh the right sidebar queue next-up on queue render
      this.updatePlayerUI({ 
        isPlaying: this.player.isPlaying, 
        currentTrack: current, 
        isShuffle: this.player.isShuffle, 
        repeatMode: this.player.repeatMode 
      });
    }
    
    if (this.player.queue.length > this.player.currentIndex + 1) {
      const nextTracks = this.player.queue.slice(this.player.currentIndex + 1);
      nextTracks.forEach((song, i) => {
        nextList.appendChild(this.createTrackRow(song, this.player.currentIndex + 1 + i, this.player.queue));
      });
    } else {
      nextList.innerHTML = '<div style="color: var(--text-subdued); padding: 16px;">Queue is empty.</div>';
    }
  }

  renderArtistView(artistName) {
    const artistSongs = this.allSongs.filter(s => s.artist === artistName);
    document.getElementById('artist-view-title').textContent = artistName;
    document.getElementById('artist-track-list').innerHTML = '';
    
    artistSongs.forEach((song, i) => {
      document.getElementById('artist-track-list').appendChild(this.createTrackRow(song, i, artistSongs));
    });
    
    document.getElementById('play-artist-btn').onclick = () => this.player.setQueue(artistSongs, 0);
    this.switchView('artist-view');
  }
}

window.addEventListener('DOMContentLoaded', () => { window._app = new App(); });
