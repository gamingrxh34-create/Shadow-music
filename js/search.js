import { recentlyPlayed } from './recentlyPlayed.js';

export class Search {
  constructor(app) {
    this.app = app;
    this.searchInput = document.getElementById('global-search-input');
    this.trackList = document.getElementById('search-track-list');
    this.searchTitle = document.getElementById('search-title');
    this.bindEvents();
  }

  bindEvents() {
    this.searchInput.addEventListener('input', (e) => {
      this.app.switchView('search-view');
      this.handleSearch(e.target.value);
    });
  }

  async handleSearch(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      this.searchTitle.textContent = 'Recent Songs';
      const history = await recentlyPlayed.getHistory();
      this.renderResults(history);
      return;
    }
    this.searchTitle.textContent = 'Top Results';
    const results = this.app.allSongs.filter(song => {
      if (q.length < 2) {
        // Strict match for single letter to avoid matching everything
        return song.title.toLowerCase().startsWith(q) || 
               song.artist.toLowerCase().startsWith(q);
      }
      return song.title.toLowerCase().includes(q) || 
             song.artist.toLowerCase().includes(q) || 
             song.album.toLowerCase().includes(q);
    });
    
    // Sort results to prioritize those that START with the query
    results.sort((a, b) => {
      const aTitleStarts = a.title.toLowerCase().startsWith(q) ? 1 : 0;
      const bTitleStarts = b.title.toLowerCase().startsWith(q) ? 1 : 0;
      if (aTitleStarts !== bTitleStarts) return bTitleStarts - aTitleStarts;
      
      const aArtistStarts = a.artist.toLowerCase().startsWith(q) ? 1 : 0;
      const bArtistStarts = b.artist.toLowerCase().startsWith(q) ? 1 : 0;
      return bArtistStarts - aArtistStarts;
    });
    
    this.renderResults(results);
  }

  renderResults(songs) {
    this.trackList.innerHTML = '';
    if (songs.length === 0) {
      this.trackList.innerHTML = '<div style="padding: 24px; color: var(--text-subdued);">No results found</div>';
      return;
    }
    songs.forEach((song, index) => {
      this.trackList.appendChild(this.app.createTrackRow(song, index, songs));
    });
  }
}
