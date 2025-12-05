// src/lib/config.ts

// This file centralizes access to environment variables,
// ensuring they are read correctly on the server side.

export const serverConfig = {
  extensionSecret: process.env.EXTENSION_SECRET,
  sessionTTLSeconds: process.env.SESSION_TTL_SECONDS,
  heartbeatAllowedInterval: process.env.HEARTBEAT_ALLOWED_INTERVAL,
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  },
};
