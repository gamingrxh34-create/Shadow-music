import { db } from './indexeddb.js';

export class RecentlyPlayed {
  constructor() {
    this.maxHistory = 50;
  }

  async addRecord(song) {
    if (!song || !song.id) return;
    const record = {
      id: song.id,
      song: song,
      timestamp: Date.now()
    };
    await db.put('history', record);
    
    const all = await db.getAll('history');
    if (all.length > this.maxHistory) {
      all.sort((a, b) => b.timestamp - a.timestamp);
      const toDelete = all.slice(this.maxHistory);
      for (const item of toDelete) {
        await db.delete('history', item.id);
      }
    }
  }

  async getHistory() {
    const all = await db.getAll('history');
    return all.sort((a, b) => b.timestamp - a.timestamp).map(r => r.song);
  }
}
export const recentlyPlayed = new RecentlyPlayed();
