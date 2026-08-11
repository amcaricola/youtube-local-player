import { LocalStorageAdapter } from './LocalStorageAdapter.js';

// Here we can easily switch to IndexedDBAdapter or MongoDBAdapter later.
const activeStorage = new LocalStorageAdapter();

// Initialize the storage on module load (or handle it explicitly in App initialization)
// activeStorage.init();

export default activeStorage;
