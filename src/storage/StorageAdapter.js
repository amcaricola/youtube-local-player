/**
 * Abstract Interface for Storage Adapters.
 * Defines the contract that all storage drivers (Local, IDB, Mongo, etc) must fulfill.
 */
export class StorageAdapter {
  /**
   * Initializes the storage connection if needed.
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error('Method not implemented.');
  }

  /**
   * Fetches all playlists.
   * @returns {Promise<import('../types/player.js').Playlist[]>}
   */
  async getPlaylists() {
    throw new Error('Method not implemented.');
  }

  /**
   * Saves or updates a playlist.
   * @param {import('../types/player.js').Playlist} playlist
   * @returns {Promise<void>}
   */
  async savePlaylist(playlist) {
    throw new Error('Method not implemented.');
  }

  /**
   * Deletes a playlist by ID.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deletePlaylist(id) {
    throw new Error('Method not implemented.');
  }

  /**
   * Updates a specific track within a playlist.
   * @param {string} playlistId
   * @param {string} trackId
   * @param {Partial<import('../types/player.js').Track>} updates
   * @returns {Promise<void>}
   */
  async updateTrack(playlistId, trackId, updates) {
    throw new Error('Method not implemented.');
  }

  /**
   * Deletes all stored data (user request / data retention compliance).
   * @returns {Promise<void>}
   */
  async clearAll() {
    throw new Error('Method not implemented.');
  }

  /**
   * Exports the entire database as a JSON string.
   * @returns {Promise<string>}
   */
  async exportData() {
    throw new Error('Method not implemented.');
  }

  /**
   * Imports a JSON string to restore the database.
   * @param {string} jsonData
   * @returns {Promise<void>}
   */
  async importData(jsonData) {
    throw new Error('Method not implemented.');
  }
}
