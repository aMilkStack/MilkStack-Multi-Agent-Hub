// This file is deprecated. Use idb-storage.ts instead.

export function loadFromLocalStorage<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined') return null;
    const serializedState = localStorage.getItem(key);
    if (serializedState === null) {
      return null;
    }
    return JSON.parse(serializedState);
  } catch (error) {
    console.error(`Could not load state for "${key}" from local storage`, error);
    return null;
  }
}

export function saveToLocalStorage<T>(key: string, state: T): void {
  try {
    if (typeof window === 'undefined') return;
    const serializedState = JSON.stringify(state);
    localStorage.setItem(key, serializedState);
  } catch (error) {
    console.error(`Could not save state for "${key}" to local storage`, error);
  }
}
