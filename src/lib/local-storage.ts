
export function loadFromLocalStorage<T>(key: string): T | null {
  try {
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
    const serializedState = JSON.stringify(state);
    localStorage.setItem(key, serializedState);
  } catch (error) {
    console.error(`Could not save state for "${key}" to local storage`, error);
  }
}
