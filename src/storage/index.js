import { signal, effect } from '@preact/signals';
import { LocalStorageAdapter } from './LocalStorageAdapter.js';
import { InMemoryStorageAdapter } from './InMemoryStorageAdapter.js';
import { modeState } from '../state/modeState.js';

const localStorageAdapter = new LocalStorageAdapter();
const memoryAdapter = new InMemoryStorageAdapter();

// La demo (ruta /demo) usa un adaptador de memoria: nada se persiste.
const activeStorage = signal(localStorageAdapter);

effect(() => {
  activeStorage.value = modeState.isDemo.value ? memoryAdapter : localStorageAdapter;
});

// Fachada: delega cada método al adaptador activo.
const storage = new Proxy({}, {
  get(_, prop) {
    const adapter = activeStorage.value;
    const value = adapter[prop];
    return typeof value === 'function' ? value.bind(adapter) : value;
  }
});

export default storage;