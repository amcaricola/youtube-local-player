import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTrackMetadata } from '../src/api/metadataParser.js';

test('formato Artista - Canción (Official Video)', () => {
  assert.deepEqual(
    parseTrackMetadata('Metallica - Nothing Else Matters (Official Video)', 'Metallica'),
    { artist: 'Metallica', title: 'Nothing Else Matters' }
  );
});

test('formato Canción ft. Feature - Artista', () => {
  assert.deepEqual(
    parseTrackMetadata('Master of Puppets ft. Orchestral - Metallica (Official Music Video)', 'Metallica'),
    { artist: 'Metallica', title: 'Master of Puppets ft. Orchestral' }
  );
});

test('formato Canción ft. Feature - Artista con etiqueta en artista', () => {
  assert.deepEqual(
    parseTrackMetadata('Empire State of Mind ft. Alicia Keys - Jay-Z (Official Video)', 'Jay-Z'),
    { artist: 'Jay-Z', title: 'Empire State of Mind ft. Alicia Keys' }
  );
});

test('separador pipe conserva solo la parte principal', () => {
  assert.deepEqual(
    parseTrackMetadata('Queen - Bohemian Rhapsody | Live at Wembley', 'Queen'),
    { artist: 'Queen', title: 'Bohemian Rhapsody' }
  );
});

test('guion en dash', () => {
  assert.deepEqual(
    parseTrackMetadata('AC/DC – Thunderstruck', 'AC/DC'),
    { artist: 'AC/DC', title: 'Thunderstruck' }
  );
});

test('canal - Topic como artista', () => {
  assert.deepEqual(
    parseTrackMetadata('One More Time', 'Daft Punk - Topic'),
    { artist: 'Daft Punk', title: 'One More Time' }
  );
});

test('canal VEVO como artista', () => {
  assert.deepEqual(
    parseTrackMetadata('Rolling in the Deep', 'AdeleVEVO'),
    { artist: 'Adele', title: 'Rolling in the Deep' }
  );
});

test('título entre comillas se limpia', () => {
  assert.deepEqual(
    parseTrackMetadata('"Shape of You" - Ed Sheeran', 'Ed Sheeran'),
    { artist: 'Ed Sheeran', title: 'Shape of You' }
  );
});

test('artista en el canal sin guion separador', () => {
  assert.deepEqual(
    parseTrackMetadata('Somewhere Over The Rainbow', 'Israel Kamakawiwo\'ole'),
    { artist: 'Israel Kamakawiwo\'ole', title: 'Somewhere Over The Rainbow' }
  );
});
