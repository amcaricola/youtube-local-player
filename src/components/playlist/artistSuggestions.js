export const getArtistSuggestions = (active, artist, track) => {
  if (!active || !track || !artist.trim()) return [];

  const query = artist.trim().toLowerCase();
  const unique = [...new Map(
    active.tracks
      .map(t => t.artist?.trim())
      .filter(Boolean)
      .map(name => [name.toLowerCase(), name])
  ).values()];

  return unique
    .filter(name => name.toLowerCase() !== (track.artist || '').toLowerCase())
    .filter(name => name.toLowerCase().includes(query))
    .slice(0, 3);
};
