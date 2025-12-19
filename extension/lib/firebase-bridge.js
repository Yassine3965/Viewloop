// lib/firebase-bridge.js
'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBDRLk64HrmlsRKn0BqC3kdmvapOoA_u6g",
  authDomain: "viewloop-app.firebaseapp.com",
  projectId: "viewloop-app",
  storageBucket: "viewloop-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

export function setupFirebaseForBridge() {
  if (typeof window === 'undefined') return;

  // تجنب التهيئة المزدوجة
  if (window.firebase && window.firebase.apps?.length > 0) {
    console.log('ℹ️ Firebase Bridge: Firebase موجود بالفعل');
    return;
  }

  // تهيئة Firebase
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);

  // تهيئة window.firebase للجسر
  window.firebase = {
    // الوظائف الأساسية
    initializeApp: () => app,
    app: app,
    apps: [app],

    // auth متوافق مع الجسر
    auth: () => ({
      // خاصية currentUser
      get currentUser() {
        return auth.currentUser;
      },

      // دالة getIdToken
      getIdToken: (forceRefresh = false) => {
        if (!auth.currentUser) return Promise.reject('No user');
        return auth.currentUser.getIdToken(forceRefresh);
      },

      // التوافقية مع firebase.auth()
      onAuthStateChanged: auth.onAuthStateChanged.bind(auth),
      signOut: auth.signOut.bind(auth)
    }),

    // للتوافقية الكاملة
    __bridgeMode: true
  };

  console.log('🌉 Firebase Bridge: تم تهيئة Firebase للجسر بنجاح');

  // مراقبة تغييرات auth
  auth.onAuthStateChanged((user) => {
    console.log('👤 Bridge Auth State:', user ? user.email : 'لا يوجد مستخدم');
  });
}
