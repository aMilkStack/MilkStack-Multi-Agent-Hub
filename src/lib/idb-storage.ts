'use client';

const DB_NAME = 'MilkStackDB';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

let db: IDBDatabase | null = null;

function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', (event.target as IDBRequest).error);
      reject('IndexedDB error');
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBRequest).result;
      resolve(db as IDBDatabase);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function getFromDb<T>(key: IDBValidKey): Promise<T | null> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onerror = () => {
            console.error('Error getting data from DB:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            resolve(request.result !== undefined ? request.result : null);
        };
    });
}

export async function saveToDb(key: IDBValidKey, value: any): Promise<void> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);
        
        request.onerror = () => {
            console.error('Error saving data to DB:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve();
        };
    });
}

export async function deleteFromDb(key: IDBValidKey): Promise<void> {
    const db = await getDb();
     return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(key);
        
        request.onerror = () => {
            console.error('Error deleting data from DB:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve();
        };
    });
}
