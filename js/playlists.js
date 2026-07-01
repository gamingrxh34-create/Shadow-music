import { db } from './indexeddb.js';

export class Playlists {
  constructor(app) {
    this.app = app;
    this.currentSongToAdd = null;
    this.currentPlaylistViewId = null;
    this.bindEvents();
    this.renderSidebarPlaylists();
    this.renderLibraryPlaylists();
  }

  bindEvents() {
    document.getElementById('create-playlist-btn').addEventListener('click', () => {
      document.getElementById('playlist-modal').classList.add('active');
    });

    const mobCreateBtn = document.getElementById('mobile-create-playlist-btn');
    if (mobCreateBtn) {
      mobCreateBtn.addEventListener('click', () => {
        document.getElementById('playlist-modal').classList.add('active');
      });
    }

    document.getElementById('cancel-playlist-btn').addEventListener('click', () => {
      document.getElementById('playlist-modal').classList.remove('active');
      document.getElementById('new-playlist-name').value = '';
    });

    document.getElementById('save-playlist-btn').addEventListener('click', async () => {
      const name = document.getElementById('new-playlist-name').value.trim();
      if (!name) return;
      const newPlaylist = { name: name, songs: [], createdAt: Date.now() };
      await db.add('playlists', newPlaylist);
      document.getElementById('playlist-modal').classList.remove('active');
      document.getElementById('new-playlist-name').value = '';
      this.renderSidebarPlaylists();
      this.renderLibraryPlaylists();
    });

    document.getElementById('close-add-to-playlist-btn').addEventListener('click', () => {
      document.getElementById('add-to-playlist-modal').classList.remove('active');
      this.currentSongToAdd = null;
    });

    document.getElementById('play-playlist-btn').addEventListener('click', async () => {
      if (!this.currentPlaylistViewId) return;
      const pl = await db.get('playlists', this.currentPlaylistViewId);
      if (pl && pl.songs.length > 0) this.app.player.setQueue(pl.songs, 0);
    });
    
    document.getElementById('edit-playlist-btn').addEventListener('click', async () => {
      if (!this.currentPlaylistViewId) return;
      const pl = await db.get('playlists', this.currentPlaylistViewId);
      document.getElementById('edit-playlist-name').value = pl.name;
      document.getElementById('edit-playlist-cover').value = pl.coverUrl || '';
      document.getElementById('edit-playlist-modal').classList.add('active');
    });

    document.getElementById('cancel-edit-playlist-btn').addEventListener('click', () => {
      document.getElementById('edit-playlist-modal').classList.remove('active');
    });

    document.getElementById('save-edit-playlist-btn').addEventListener('click', async () => {
      if (!this.currentPlaylistViewId) return;
      const pl = await db.get('playlists', this.currentPlaylistViewId);
      const newName = document.getElementById('edit-playlist-name').value.trim();
      const newCover = document.getElementById('edit-playlist-cover').value.trim();
      
      if (newName) {
        pl.name = newName;
        pl.coverUrl = newCover || null;
        await db.put('playlists', pl);
        document.getElementById('edit-playlist-modal').classList.remove('active');
        this.renderSidebarPlaylists();
        this.renderLibraryPlaylists();
        this.openPlaylistView(this.currentPlaylistViewId);
      }
    });

    const searchInput = document.getElementById('playlist-internal-search');
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const resultsContainer = document.getElementById('playlist-search-results');
      resultsContainer.innerHTML = '';
      if (!q) return;
      
      const results = this.app.allSongs.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)).slice(0, 5);
      
      results.forEach(song => {
        const row = document.createElement('div');
        row.className = 'track-row';
        row.innerHTML = `
          <div class="track-num"><i class="fa-solid fa-music" style="color:var(--text-subdued)"></i></div>
          <div class="track-info">
            <img class="track-img" src="${song.coverUrl}" alt="">
            <div class="track-text">
              <div class="track-name">${song.title}</div>
              <div class="track-artist">${song.artist}</div>
            </div>
          </div>
          <div class="track-album">${song.album}</div>
          <div class="track-actions">
            <button class="btn-secondary" style="border: 1px solid var(--text-subdued); border-radius: 500px; padding: 4px 12px;">Add</button>
          </div>
        `;
        row.querySelector('button').addEventListener('click', async () => {
          const pl = await db.get('playlists', this.currentPlaylistViewId);
          if (!pl.songs.find(s => s.id === song.id)) {
            pl.songs.push(song);
            await db.put('playlists', pl);
            this.openPlaylistView(this.currentPlaylistViewId);
            this.renderLibraryPlaylists();
            searchInput.value = '';
            resultsContainer.innerHTML = '';
          }
        });
        resultsContainer.appendChild(row);
      });
    });

    document.getElementById('delete-playlist-btn').addEventListener('click', async () => {
      if (!this.currentPlaylistViewId) return;
      if (confirm("Are you sure you want to delete this playlist?")) {
        await db.delete('playlists', this.currentPlaylistViewId);
        this.currentPlaylistViewId = null;
        this.renderSidebarPlaylists();
        this.renderLibraryPlaylists();
        this.app.switchView('home-view');
      }
    });
  }

  async renderSidebarPlaylists() {
    const playlists = await db.getAll('playlists');
    const container = document.getElementById('library-rich-list');
    if (!container) return;
    container.innerHTML = '';
    
    // 1. Liked Songs Item
    const likedItem = document.createElement('div');
    likedItem.className = 'rich-list-item nav-item';
    likedItem.dataset.target = 'liked-view';
    likedItem.innerHTML = `
      <div class="rich-list-img liked"><i class="fa-solid fa-star"></i></div>
      <div class="rich-list-text">
        <span class="rich-list-title">Liked Songs</span>
        <span class="rich-list-subtitle"><i class="fa-solid fa-thumbtack" style="color:var(--accent); font-size:10px;"></i> Playlist • Auto</span>
      </div>
    `;
    likedItem.addEventListener('click', () => {
      document.querySelectorAll('.rich-list-item').forEach(el => el.classList.remove('active'));
      likedItem.classList.add('active');
      this.app.switchView('liked-view');
    });
    container.appendChild(likedItem);

    // 2. Custom Playlists
    playlists.forEach(pl => {
      const item = document.createElement('div');
      item.className = 'rich-list-item';
      
      const coverHtml = pl.coverUrl 
        ? `<img src="${pl.coverUrl}" class="rich-list-img">`
        : `<div class="rich-list-img"><i class="fa-solid fa-music"></i></div>`;

      item.innerHTML = `
        ${coverHtml}
        <div class="rich-list-text">
          <span class="rich-list-title">${pl.name}</span>
          <span class="rich-list-subtitle">Playlist • ${pl.songs.length} songs</span>
        </div>
      `;
      item.addEventListener('click', () => {
        document.querySelectorAll('.rich-list-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        this.openPlaylistView(pl.id);
      });
      container.appendChild(item);
    });
  }

  async renderLibraryPlaylists() {
    const playlists = await db.getAll('playlists');
    const grid = document.getElementById('library-grid');
    if (!grid) return;
    grid.innerHTML = '';
    playlists.forEach(pl => {
      const card = document.createElement('div');
      card.className = 'media-card';
      const coverUrl = pl.coverUrl || (pl.songs.length > 0 ? pl.songs[0].coverUrl : null);
      const coverHtml = coverUrl 
        ? `<img src="${coverUrl}" style="width:100%;height:100%;object-fit:cover;">`
        : `<div class="placeholder"><i class="fa-solid fa-music"></i></div>`;
      card.innerHTML = `
        <div class="media-card-img-container">
          ${coverHtml}
          <button class="play-btn-overlay"><i class="fa-solid fa-play"></i></button>
        </div>
        <h4>${pl.name}</h4>
        <p>${pl.songs.length} songs</p>
      `;
      card.addEventListener('click', (e) => {
        if(e.target.closest('.play-btn-overlay') && pl.songs.length > 0) {
          this.app.player.setQueue(pl.songs, 0);
          e.stopPropagation();
        } else {
          this.openPlaylistView(pl.id);
        }
      });
      grid.appendChild(card);
    });
  }

  async openPlaylistView(id) {
    this.currentPlaylistViewId = id;
    const pl = await db.get('playlists', id);
    if (!pl) return;

    document.getElementById('current-playlist-title').textContent = pl.name;
    document.getElementById('current-playlist-stats').textContent = `${pl.songs.length} songs`;
    
    const coverContainer = document.getElementById('current-playlist-cover');
    const coverUrl = pl.coverUrl || (pl.songs.length > 0 ? pl.songs[0].coverUrl : null);
    if (coverUrl) {
      coverContainer.innerHTML = `<img src="${coverUrl}" style="width:100%;height:100%;object-fit:cover;">`;
      document.getElementById('play-playlist-btn').style.opacity = '1';
    } else {
      coverContainer.innerHTML = `<i class="fa-solid fa-music"></i>`;
      document.getElementById('play-playlist-btn').style.opacity = '0.5';
    }

    const list = document.getElementById('playlist-track-list');
    list.innerHTML = '';
    if (pl.songs.length === 0) {
      list.innerHTML = '<div style="padding: 24px; color: var(--text-subdued);">Empty playlist. Add songs to it!</div>';
    } else {
      pl.songs.forEach((song, i) => {
        const row = this.app.createTrackRow(song, i, pl.songs, { playlistId: pl.id });
        row.draggable = true;
        
        row.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', i);
          e.dataTransfer.effectAllowed = 'move';
          row.style.opacity = '0.4';
        });
        
        row.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          row.style.borderTop = '2px solid var(--accent)';
        });
        
        row.addEventListener('dragleave', () => {
          row.style.borderTop = '';
        });
        
        row.addEventListener('drop', async (e) => {
          e.preventDefault();
          row.style.borderTop = '';
          const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
          const dropIndex = i;
          
          if (!isNaN(dragIndex) && dragIndex !== dropIndex) {
            const songToMove = pl.songs.splice(dragIndex, 1)[0];
            pl.songs.splice(dropIndex, 0, songToMove);
            await db.put('playlists', pl);
            this.openPlaylistView(this.currentPlaylistViewId);
            this.renderLibraryPlaylists();
          }
        });
        
        row.addEventListener('dragend', () => {
          row.style.opacity = '1';
        });
        
        list.appendChild(row);
      });
    }

    const dlBtn = document.getElementById('download-playlist-btn');
    if (dlBtn) {
      dlBtn.classList.remove('hidden');
      dlBtn.onclick = () => { if (this.app.downloads) this.app.downloads.downloadPlaylist(pl); };
    }
    this.app.switchView('playlist-view');
  }

  async openAddToPlaylistModal(song) {
    this.currentSongToAdd = song;
    const modal = document.getElementById('add-to-playlist-modal');
    const list = document.getElementById('modal-playlists-list');
    list.innerHTML = '';
    
    const playlists = await db.getAll('playlists');
    if (playlists.length === 0) {
      list.innerHTML = '<div style="padding: 12px; color: var(--text-subdued);">No playlists created yet.</div>';
    } else {
      playlists.forEach(pl => {
        const item = document.createElement('div');
        item.className = 'modal-list-item';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '16px';
        
        const coverUrl = pl.coverUrl || (pl.songs.length > 0 ? pl.songs[0].coverUrl : null);
        const coverHtml = coverUrl 
          ? `<img src="${coverUrl}" style="width:56px;height:56px;object-fit:cover;border-radius:4px;">` 
          : `<div style="width:56px;height:56px;background:var(--bg-active);border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--text-subdued);font-size:24px;"><i class="fa-solid fa-music"></i></div>`;
        
        item.innerHTML = `
          ${coverHtml}
          <div style="display:flex; flex-direction:column; overflow:hidden;">
            <div style="font-weight:600;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${pl.name}</div>
            <div style="font-size:14px;color:var(--text-subdued);margin-top:4px;">${pl.songs.length} songs</div>
          </div>
        `;
        
        item.addEventListener('click', async () => {
          if (!pl.songs.find(s => s.id === song.id)) {
            pl.songs.push(song);
            await db.put('playlists', pl);
            this.renderSidebarPlaylists();
            this.renderLibraryPlaylists();
            if (this.currentPlaylistViewId === pl.id) this.openPlaylistView(pl.id);
          }
          modal.classList.remove('active');
        });
        list.appendChild(item);
      });
    }
    modal.classList.add('active');
  }

  async removeSongFromPlaylist(playlistId, songId) {
    const pl = await db.get('playlists', playlistId);
    if (!pl) return;
    
    // Remove the first instance of the song
    const index = pl.songs.findIndex(s => s.id === songId);
    if (index > -1) {
      pl.songs.splice(index, 1);
      await db.put('playlists', pl);
      if (this.currentPlaylistViewId === playlistId) {
        this.openPlaylistView(playlistId);
      }
      this.renderLibraryPlaylists();
    }
  }
}
