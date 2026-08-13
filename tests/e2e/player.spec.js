import { test, expect } from '@playwright/test';

const playlist = {
  id: 'e2e-playlist',
  youtubePlaylistId: null,
  title: 'Playlist de prueba',
  description: 'Datos simulados para las pruebas',
  thumbnail: '',
  tracks: [
    {
      id: 'e2e-track-1',
      videoId: 'e2e-video-1',
      originalTitle: 'Artista Uno - Cancion Uno',
      title: 'Cancion Uno',
      artist: 'Artista Uno',
      channelTitle: 'Canal de prueba',
      thumbnailUrl: '',
      publishedAt: null,
      status: 'healthy',
      statusMessage: null,
      addedAt: Date.now()
    }
  ],
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const seedApp = async (page) => {
  await page.addInitScript((initialPlaylist) => {
    localStorage.setItem('yt_player_playlists', JSON.stringify([initialPlaylist]));
    localStorage.setItem('yt_auto_sync', 'false');
    localStorage.setItem('yt_auto_check', 'false');

    class MockPlayer {
      constructor(id, options) {
        this.options = options;
        this.currentTime = 0;
        this.volume = 100;
        this.playing = false;
        window.__ytMock = this;
        setTimeout(() => options.events.onReady({ target: this }), 0);
      }

      getIframe() { return document.querySelector('#yt-player-container iframe') || document.createElement('iframe'); }
      setVolume(value) { this.volume = value; }
      getDuration() { return 180; }
      getCurrentTime() { return this.currentTime; }
      loadVideoById(videoId) { this.videoId = videoId; this.playing = true; }
      playVideo() {
        this.playing = true;
        this.options.events.onStateChange({ data: 1 });
      }
      pauseVideo() {
        this.playing = false;
        this.options.events.onStateChange({ data: 2 });
      }
      seekTo(seconds) { this.currentTime = seconds; }
    }

    window.YT = {
      Player: MockPlayer,
      PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0, BUFFERING: 3, CUED: 5 }
    };
  }, playlist);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Playlist de prueba' })).toBeVisible();
};

test('edita una canción, cierra la modal y muestra feedback', async ({ page }) => {
  await seedApp(page);

  await page.getByTitle('Editar metadatos').click();
  await expect(page.getByRole('heading', { name: 'Editar Canción' })).toBeVisible();
  await page.locator('input[placeholder="Nombre de la canción..."]').fill('Cancion actualizada');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByRole('heading', { name: 'Editar Canción' })).toBeHidden();
  await expect(page.getByRole('status')).toContainText('Canción actualizada');
  await expect(page.getByText('Cancion actualizada', { exact: true })).toBeVisible();
});

test('exporta e importa un respaldo JSON', async ({ page }) => {
  await seedApp(page);

  await page.locator('header button').click();
  await expect(page.getByRole('heading', { name: 'Ajustes del Reproductor' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^youtube-player-backup-.*\.json$/);
  await expect(page.getByRole('status')).toContainText('Respaldo exportado correctamente');

  const imported = JSON.stringify({
    version: 1,
    playlists: [{ ...playlist, id: 'imported-playlist', title: 'Playlist importada' }]
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(imported)
  });
  await expect(page.getByText('Datos restaurados correctamente.')).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Respaldo importado correctamente');
});

test('los atajos controlan el reproductor mock', async ({ page }) => {
  await seedApp(page);
  await page.locator('tr').nth(1).click();
  await page.waitForTimeout(250);

  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.__ytMock.playing)).toBe(false);
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.__ytMock.playing)).toBe(true);

  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => window.__ytMock.volume)).toBe(95);
  await page.keyboard.press('m');
  expect(await page.evaluate(() => window.__ytMock.volume)).toBe(0);
});
