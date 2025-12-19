// Basic service worker for ViewLoop
const CACHE_NAME = 'viewloop-v1';

self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activating...');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Log fetch events for debugging
  console.log('Fetch event:', event.request.url);
  // TODO: Add caching logic as needed
});
