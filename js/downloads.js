import { db } from './indexeddb.js';

export class Downloads {
  constructor(app) {
    this.app = app;
  }

  async downloadPlaylist(playlist) {
    if (!playlist || !playlist.songs || playlist.songs.length === 0) {
      alert('Playlist is empty.');
      return;
    }
    const btn = document.getElementById('download-playlist-btn');
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Downloading...';
      btn.disabled = true;
    }
    try {
      for (const song of playlist.songs) {
        if (await db.get('downloads', song.id)) continue;
        const res = await fetch(song.audioUrl);
        if (!res.ok) throw new Error('Network response not ok');
        const blob = await res.blob();
        await db.put('downloads', { id: song.id, song: song, audioBlob: blob, timestamp: Date.now() });
      }
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Downloaded';
        btn.classList.replace('btn-primary', 'btn-secondary');
      }
    } catch (e) {
      console.error('Download error:', e);
      if (btn) btn.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Error';
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async getLocalAudioUrl(songId) {
    const downloaded = await db.get('downloads', songId);
    return downloaded && downloaded.audioBlob ? URL.createObjectURL(downloaded.audioBlob) : null;
  }
}
