import { signal, computed } from '@preact/signals';
import { fetchPlaylistData } from '../api/youtubeApi.js';
import { parseTrackMetadata } from '../api/metadataParser.js';
import storage from '../storage/index.js';
import { playerState } from './playerState.js';

export const playlistState = {
  playlists: signal([]),
  activePlaylist: signal(null),
  isLoading: signal(false),
  error: signal(null),
  searchQuery: signal(''),
  isShuffle: signal(false),
  shuffledQueue: signal([]),
  playedHistory: signal([])
};

export const filteredTracks = computed(() => {
  const active = playlistState.activePlaylist.value;
  if (!active) return [];
  const query = playlistState.searchQuery.value.trim().toLowerCase();
  if (!query) return active.tracks;
  
  return active.tracks.filter(t => 
    t.title.toLowerCase().includes(query) || 
    t.artist.toLowerCase().includes(query)
  );
});

export const generateShuffle = (tracks, excludeTrackId = null) => {
  let queue = tracks.map(t => t.id);
  // Fisher-Yates
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  if (excludeTrackId) {
    queue = queue.filter(id => id !== excludeTrackId);
  }
  return queue;
};

export const toggleShuffle = () => {
  playlistState.isShuffle.value = !playlistState.isShuffle.value;
  if (playlistState.isShuffle.value) {
    const current = playerState.currentTrack.value;
    playlistState.shuffledQueue.value = generateShuffle(filteredTracks.value, current?.id);
    playlistState.playedHistory.value = current ? [current.id] : [];
  } else {
    playlistState.shuffledQueue.value = [];
  }
};

/**
 * Carga las playlists desde el storage local
 */
export const loadLocalPlaylists = async () => {
  const lists = await storage.getPlaylists();
  playlistState.playlists.value = lists;
  if (lists.length > 0 && !playlistState.activePlaylist.value) {
    playlistState.activePlaylist.value = lists[0];
  }
};

/**
 * Importa y parsea una playlist desde YouTube a la base de datos local
 * @param {string} playlistId 
 * @param {string} apiKey 
 */
export const importYouTubePlaylist = async (playlistId, apiKey) => {
  playlistState.isLoading.value = true;
  playlistState.error.value = null;
  
  try {
    const data = await fetchPlaylistData(playlistId, apiKey);
    
    // Transformar a nuestro modelo de base de datos
    const tracks = data.rawItems
      .filter(item => item.snippet.title !== 'Private video' && item.snippet.title !== 'Deleted video')
      .map(item => {
        const { title, artist } = parseTrackMetadata(item.snippet.title, item.snippet.videoOwnerChannelTitle || '');
        
        return {
          id: item.contentDetails.videoId,
          videoId: item.contentDetails.videoId,
          originalTitle: item.snippet.title,
          title: title,
          artist: artist,
          channelTitle: item.snippet.videoOwnerChannelTitle || 'Desconocido',
          thumbnailUrl: item.snippet.thumbnails?.default?.url || '',
          status: 'unchecked',
          addedAt: Date.now()
        };
      });

    const newPlaylist = {
      id: `pl_${Date.now()}`,
      youtubePlaylistId: data.youtubePlaylistId,
      title: data.title,
      description: data.description,
      thumbnail: data.thumbnail,
      tracks: tracks,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Guardar en la persistencia local
    await storage.savePlaylist(newPlaylist);
    await loadLocalPlaylists();
    
    playlistState.activePlaylist.value = newPlaylist;
    
  } catch (error) {
    console.error("Error al importar playlist:", error);
    playlistState.error.value = error.message;
  } finally {
    playlistState.isLoading.value = false;
  }
};

/**
 * Reproduce la siguiente canción de la lista activa
 */
export const playNextTrack = () => {
  const active = playlistState.activePlaylist.value;
  const current = playerState.currentTrack.value;
  if (!active) return;
  
  const tracks = filteredTracks.value;
  if (tracks.length === 0) return;

  import('../api/iframePlayer.js').then(({ playTrack }) => {
    if (playlistState.isShuffle.value) {
      if (playlistState.shuffledQueue.value.length === 0) {
        playlistState.shuffledQueue.value = generateShuffle(tracks);
        playlistState.playedHistory.value = [];
      }
      const queue = [...playlistState.shuffledQueue.value];
      const nextId = queue.shift();
      playlistState.shuffledQueue.value = queue;
      
      const nextTrack = tracks.find(t => t.id === nextId) || active.tracks.find(t => t.id === nextId);
      if (nextTrack) {
        if (current) {
          playlistState.playedHistory.value = [...playlistState.playedHistory.value, current.id];
        }
        playTrack(nextTrack);
      }
    } else {
      if (!current) {
        playTrack(tracks[0]);
        return;
      }
      const currentIndex = tracks.findIndex(t => t.id === current.id);
      if (currentIndex >= 0 && currentIndex < tracks.length - 1) {
        playTrack(tracks[currentIndex + 1]);
      } else {
        // Loop back to start
        playTrack(tracks[0]);
      }
    }
  });
};

/**
 * Reproduce la canción anterior de la lista activa
 */
export const playPrevTrack = () => {
  const active = playlistState.activePlaylist.value;
  const current = playerState.currentTrack.value;
  if (!active || !current) return;
  
  // Si lleva más de 3 segundos, reiniciar la canción actual
  if (playerState.currentTime.value > 3) {
    import('../api/iframePlayer.js').then(({ seekTo }) => {
      seekTo(0);
    });
    return;
  }
  
  const tracks = filteredTracks.value;

  import('../api/iframePlayer.js').then(({ playTrack }) => {
    if (playlistState.isShuffle.value) {
      if (playlistState.playedHistory.value.length > 0) {
        const history = [...playlistState.playedHistory.value];
        const prevId = history.pop();
        playlistState.playedHistory.value = history;
        
        playlistState.shuffledQueue.value = [current.id, ...playlistState.shuffledQueue.value];
        const prevTrack = tracks.find(t => t.id === prevId) || active.tracks.find(t => t.id === prevId);
        if (prevTrack) playTrack(prevTrack);
      } else {
        import('../api/iframePlayer.js').then(({ seekTo }) => seekTo(0));
      }
    } else {
      const currentIndex = tracks.findIndex(t => t.id === current.id);
      if (currentIndex > 0) {
        playTrack(tracks[currentIndex - 1]);
      } else {
        playTrack(tracks[tracks.length - 1]);
      }
    }
  });
};
