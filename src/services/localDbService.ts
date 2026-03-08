const DB_NAME = 'LuminaGalleryDB';
const DB_VERSION = 1;
const STORE_NAME = 'gallery_images';

export interface GalleryImage {
    id: string;
    url: string;
    reference: string;
    text: string;
    date: string;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
            console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
            reject('Error opening IndexedDB');
        };
    });
}

export async function saveGalleryToIndexedDB(images: GalleryImage[]): Promise<void> {
    try {
        const db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Clear existing, then bulk put
        store.clear();

        for (const item of images) {
            store.put(item);
        }

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => {
                console.error('Transaction error:', (event.target as IDBTransaction).error);
                reject('Error saving data');
            };
        });
    } catch (error) {
        console.error('Failed to save gallery data to IndexedDB:', error);
    }
}

export async function getGalleryFromIndexedDB(): Promise<GalleryImage[]> {
    try {
        const db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                resolve((event.target as IDBRequest).result || []);
            };
            request.onerror = (event) => {
                console.error('Request error:', (event.target as IDBRequest).error);
                reject('Error getting data');
            };
        });
    } catch (error) {
        console.error('Failed to get gallery data from IndexedDB:', error);
        return [];
    }
}
