import { signal, computed, effect } from '@preact/signals';

export const playerState = {
  isPlaying: signal(false),
  volume: signal(parseInt(localStorage.getItem('yt_volume') || '100', 10)),
  isMuted: signal(false),
  currentTime: signal(0),
  duration: signal(0),
  currentTrack: signal(null), // { videoId, title, artist, thumbnailUrl }
  isReady: signal(false),
  trackEndedFlag: signal(0)
};

effect(() => {
  localStorage.setItem('yt_volume', playerState.volume.value.toString());
});

export const progressPercent = computed(() => {
  if (playerState.duration.value === 0) return 0;
  return (playerState.currentTime.value / playerState.duration.value) * 100;
});
