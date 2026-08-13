import test from 'node:test';
import assert from 'node:assert/strict';
import { getArtistSuggestions } from '../src/components/playlist/artistSuggestions.js';

test('artist suggestions are safe when the edit modal has already closed', () => {
  const active = {
    tracks: [
      { artist: 'Artist One' },
      { artist: 'Artist Two' }
    ]
  };

  assert.deepEqual(getArtistSuggestions(active, 'artist', null), []);
});

test('artist suggestions exclude the current artist', () => {
  const active = {
    tracks: [
      { artist: 'Artist One' },
      { artist: 'Artist Two' }
    ]
  };

  assert.deepEqual(
    getArtistSuggestions(active, 'artist', { artist: 'Artist One' }),
    ['Artist Two']
  );
});
