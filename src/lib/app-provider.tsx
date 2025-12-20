'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import type { UserProfile, Video } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  limit,
  getDocs,
  deleteDoc,
  writeBatch,
  FirestoreError,
  Timestamp
} from 'firebase/firestore';
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
  sendEmailVerification,
  deleteUser,
} from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { PointsAwardedModal } from '@/components/points-awarded-modal';
import { getYoutubeVideoId } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Define a more specific user type for the context
export type AppUser = UserProfile & {
  getIdToken: () => Promise<string>;
  emailVerified: boolean;
};

interface AppState {
  user: AppUser | null;
  isUserLoading: boolean;
  videos: Video[];
  searchQuery: string;
}

interface AppDispatch {
  setSearchQuery: (query: string) => void;
  addVideo: (video: Omit<Video, 'id' | 'submissionDate'>) => Promise<{ success: boolean, message: string }>;
  deleteVideo: (video: Video) => Promise<{ success: boolean, message: string }>;
  deleteCurrentUserAccount: (reason?: string) => Promise<{ success: boolean, message: string }>;
  improveReputation: () => Promise<{ success: boolean, message: string }>;
  login: (email: string, password: string) => Promise<boolean>;
  registerAndSendCode: (details: any) => Promise<{ success: boolean; message: string; userId?: string }>;
  verifyRegistrationCodeAndCreateUser: (userId: string, code: string, details: any) => Promise<{ success: boolean; message: string }>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => Promise<void>;
  getConnectionToken: () => Promise<string | null>;
}

const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<AppDispatch | undefined>(undefined);


const getInitialAvatar = (name: string): string => {
  const sanitizedName = encodeURIComponent(name.trim());
  return `https://source.boringavatars.com/beam/120/${sanitizedName}?colors=264653,2a9d8f,e9c46a,f4a261,e76f51`;
};


export function AppProvider({ children }: { children: ReactNode }) {
  const { auth, db } = useFirebase();
  const { toast } = useToast();

  const [user, setUser] = useState<AppUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [videos, setVideos] = useState<Video[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [awardedPoints, setAwardedPoints] = useState(0);

  // Videos listener
  useEffect(() => {
    if (!db) return;
    const videosQuery = query(collection(db, 'videos'));
    const unsubscribe = onSnapshot(videosQuery, (snapshot) => {
      const videosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Video[];
      setVideos(videosData);
    },
      async (err: FirestoreError) => {
        const permissionError = new FirestorePermissionError({
          path: 'videos',
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
      });
    return () => unsubscribe();
  }, [db]);


  // Auth state listener and extension token bridge
  useEffect(() => {
    if (!auth || !db) {
      setIsUserLoading(false);
      return;
    }

    let unsubscribeProfile: (() => void) | undefined;
    let previousPoints: number | null = null;


    const handleUserChange = (authUser: FirebaseUser | null) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }

      if (authUser) {
        setIsUserLoading(true);

        const storeTokenAndNotifyExtension = async () => {
          try {
            const token = await authUser.getIdToken();
            if (typeof window !== 'undefined') {
              // Store in localStorage as a reliable fallback
              localStorage.setItem('userAuthToken', token);

              // Attempt to send to extension directly
              if (window.chrome && window.chrome.runtime && window.chrome.runtime.id) {
                window.chrome.runtime.sendMessage(window.chrome.runtime.id, {
                  type: 'STORE_AUTH_TOKEN',
                  token: token,
                  secret: "6B65FDC657B5D8CF4D5AB28C92CF2"
                }, (response: any) => {
                  if (window.chrome && window.chrome.runtime && window.chrome.runtime.lastError) {
                    // This is expected if the extension is not listening, localStorage is the fallback.
                  }
                });
              }
            }
          } catch (error) {
            console.error('[ViewLoop] Failed to store/send token:', error);
          }
        };

        storeTokenAndNotifyExtension();

        const userRef = doc(db, 'users', authUser.uid);

        if (authUser.emailVerified) {
          updateDoc(userRef, { lastLogin: serverTimestamp() }).catch(err => { });
        }

        unsubscribeProfile = onSnapshot(
          userRef,
          (userSnap) => {
            if (userSnap.exists()) {
              const userProfileData = userSnap.data() as UserProfile;
              const userProfile: AppUser = {
                ...userProfileData,
                id: userSnap.id,
                getIdToken: () => authUser.getIdToken(),
                emailVerified: authUser.emailVerified,
              };
              setUser(userProfile);

              if (previousPoints !== null && userProfile.points > previousPoints) {
                const pointsGained = userProfile.points - previousPoints;
                if (pointsGained > 0) {
                  setAwardedPoints(pointsGained);
                }
              }
              previousPoints = userProfile.points;

            } else {
              setUser(null);
              previousPoints = null;
            }
            setIsUserLoading(false);
          },
          async (err: FirestoreError) => {
            if (auth.currentUser) {
              const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'get',
              });
              errorEmitter.emit('permission-error', permissionError);
            }
            setUser(null);
            previousPoints = null;
            setIsUserLoading(false);
          }
        );
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('userAuthToken');
        }
        setUser(null);
        previousPoints = null;
        setIsUserLoading(false);
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, handleUserChange);

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, [auth, db]);

  const addVideo = useCallback(async (videoData: Omit<Video, 'id' | 'submissionDate'>): Promise<{ success: boolean, message: string }> => {
    const currentUser = user;
    if (!currentUser || !db) return { success: false, message: "المستخدم غير مسجل دخوله أو أن قاعدة البيانات غير متاحة." };

    const youtubeVideoId = getYoutubeVideoId(videoData.url);
    if (!youtubeVideoId) {
      return { success: false, message: "رابط يوتيوب غير صالح." };
    }

    // The document ID is the YouTube video ID
    const videoRef = doc(db, 'videos', youtubeVideoId);

    try {
      const videoSnap = await getDoc(videoRef);

      if (videoSnap.exists()) {
        return { success: false, message: "هذا الفيديو موجود بالفعل في قائمة المشاهدة." };
      }

      // Ensure the videoId field is also set within the document data
      const newVideoData = {
        ...videoData,
        videoId: youtubeVideoId, // Explicitly add the videoId field
        submissionDate: serverTimestamp(),
      };

      await setDoc(videoRef, newVideoData)
        .catch(async (serverError: FirestoreError) => {
          const permissionError = new FirestorePermissionError({
            path: videoRef.path,
            operation: 'create',
            requestResourceData: newVideoData,
          });
          errorEmitter.emit('permission-error', permissionError);
          throw serverError;
        });

      return { success: true, message: "تمت إضافة الفيديو بنجاح." };
    } catch (error: any) {
      console.error("Error in addVideo:", error);
      return { success: false, message: error.message || "فشل إنشاء الحملة." };
    }
  }, [user, db]);

  const deleteVideo = useCallback(async (video: Video): Promise<{ success: boolean, message: string }> => {
    const currentUser = user;
    if (!currentUser || !db) return { success: false, message: "المستخدم غير مسجل دخوله أو أن قاعدة البيانات غير متاحة." };
    if (currentUser.id !== video.submitterId) return { success: false, message: "ليس لديك إذن لحذف هذا الفيديو." };

    // The video ID from the app is the YouTube video ID, which is the document ID.
    const videoRef = doc(db, 'videos', video.id);

    try {
      await deleteDoc(videoRef)
        .catch(async (serverError: FirestoreError) => {
          const permissionError = new FirestorePermissionError({
            path: videoRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
          throw new Error("Firestore deletion failed");
        });
      return { success: true, message: `تم حذف الفيديو بنجاح.` };
    } catch (error: any) {
      return { success: false, message: "فشل حذف الفيديو." };
    }
  }, [user, db]);

  const deleteCurrentUserAccount = useCallback(async (reason?: string): Promise<{ success: boolean, message: string }> => {
    const authUser = auth.currentUser;
    if (!authUser || !db) {
      return { success: false, message: "المستخدم غير مسجل دخوله حاليًا." };
    }

    const userDocRef = doc(db, 'users', authUser.uid);

    try {
      await deleteDoc(userDocRef)
        .catch(async (serverError: FirestoreError) => {
          const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
          throw new Error("Firestore deletion failed");
        });

      await deleteUser(authUser);

      return { success: true, message: "تم حذف الحساب بنجاح." };

    } catch (error: any) {
      let message = "حدث خطأ غير متوقع.";

      if (error.message === "Firestore deletion failed") {
        message = "فشلت عملية حذف البيانات. قد تكون الأذونات غير كافية."
      } else if (error.code === 'auth/requires-recent-login') {
        message = "هذه العملية حساسة وتتطلب إعادة تسجيل الدخول. الرجاء تسجيل الخروج ثم الدخول مرة أخرى والمحاولة مجددًا.";
      } else if (error.code === 'permission-denied') {
        message = "ليس لديك الإذن الكافي لحذف هذا الحساب.";
      }

      const currentUser = user;
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists() && currentUser) {
        const { getIdToken, emailVerified, ...profileData } = currentUser;
        await setDoc(userDocRef, profileData);
      }
      return { success: false, message };
    }
  }, [auth, db, user]);

  const improveReputation = useCallback(async (): Promise<{ success: boolean, message: string }> => {
    const currentUser = user;
    if (!currentUser) return { success: false, message: "يجب تسجيل الدخول أولاً." };

    try {
      const userAuthToken = await currentUser.getIdToken();
      const response = await fetch('/api/improve-reputation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAuthToken }),
      });

      const result = await response.json();

      toast({
        title: result.success ? "نجاح" : "فشل",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });

      return result;

    } catch (error) {
      const message = "حدث خطأ في الشبكة.";
      toast({
        title: "خطأ",
        description: message,
        variant: "destructive",
      });
      return { success: false, message };
    }

  }, [user, toast]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (!auth || !db) return false;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, 'users', userCredential.user.uid);

      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        return false;
      }

      await updateDoc(userRef, { lastLogin: serverTimestamp() });
      const token = await userCredential.user.getIdToken();
      if (typeof window !== 'undefined') {
        localStorage.setItem('userAuthToken', token);
      }

      return true;
    } catch (error) {
      return false;
    }
  }, [auth, db]);

  const registerAndSendCode = useCallback(async (details: any): Promise<{ success: boolean; message: string; userId?: string; }> => {
    const { name, email, password, gender } = details;
    if (!auth || !db) return { success: false, message: "خدمات المصادقة غير متاحة." };

    const trimmedName = name.trim();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const authUser = userCredential.user;

      const locationRes = await fetch('/api/user-location');
      const locationData = await locationRes.json();

      const newUserProfile: Omit<UserProfile, 'id'> = {
        name: trimmedName,
        email: email,
        avatar: getInitialAvatar(trimmedName),
        role: 'user',
        gender: gender,
        country: locationData.country || 'Unknown',
        country_code: locationData.country_code || '',
        city: locationData.city || '',

        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        points: 100,
        gems: 0,
        level: 1,
        reputation: 4.5,
        lastUpdated: Date.now(),
      };

      const userDocRef = doc(db, 'users', authUser.uid);
      await setDoc(userDocRef, newUserProfile).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: userDocRef.path,
          operation: 'create',
          requestResourceData: newUserProfile,
        });
        errorEmitter.emit('permission-error', permissionError);
      });

      await sendEmailVerification(authUser);

      if (auth.currentUser) {
        await signOut(auth);
      }

      return {
        success: true,
        message: "تم إرسال رابط التحقق. يرجى التحقق من بريدك الإلكتروني.",
        userId: authUser.uid
      };

    } catch (error: any) {
      let message = "حدث خطأ غير متوقع.";
      if (error.code === 'auth/email-already-in-use') {
        message = "هذا البريد الإلكتروني مستخدم بالفعل.";
      }
      return { success: false, message };
    }
  }, [auth, db]);

  const verifyRegistrationCodeAndCreateUser = useCallback(async (userId: string, oobCode: string, details: any): Promise<{ success: boolean; message: string; }> => {
    return { success: false, message: "This function is deprecated." };
  }, []);

  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    if (!auth || !db) return false;
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const { user: authUser } = result;

      const userRef = doc(db, 'users', authUser.uid);
      const userSnap = await getDoc(userRef);

      const token = await authUser.getIdToken();
      if (typeof window !== 'undefined') {
        localStorage.setItem('userAuthToken', token);
      }

      const trimmedName = authUser.displayName?.trim() || 'Anonymous User';

      if (!userSnap.exists()) {
        const locationRes = await fetch('/api/user-location');
        const locationData = await locationRes.json();

        const gender = 'male';
        const newUserProfile: Omit<UserProfile, 'id'> = {
          name: trimmedName,
          email: authUser.email!,
          avatar: getInitialAvatar(trimmedName),
          role: 'user',
          gender: gender,
          country: locationData.country || 'Unknown',
          country_code: locationData.country_code || '',
          city: locationData.city || '',
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          points: 100,
          gems: 0,
          level: 1,
          reputation: 4.5,
          lastUpdated: Date.now(),
        };
        await setDoc(userRef, newUserProfile)
          .catch(async (serverError: FirestoreError) => {
            const permissionError = new FirestorePermissionError({
              path: userRef.path,
              operation: 'create',
              requestResourceData: newUserProfile,
            });
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
          });
      } else {
        const updateData = { lastLogin: serverTimestamp() };
        // Also update name and avatar in case they changed in Google account
        if (userSnap.data().name !== trimmedName) {
          (updateData as any).name = trimmedName;
        }
        if (userSnap.data().avatar !== getInitialAvatar(trimmedName)) {
          (updateData as any).avatar = getInitialAvatar(trimmedName);
        }

        await updateDoc(userRef, updateData)
          .catch(async (serverError: FirestoreError) => {
            const permissionError = new FirestorePermissionError({
              path: userRef.path,
              operation: 'update',
              requestResourceData: updateData,
            });
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
          });
      }
      return true;
    } catch (error) {
      return false;
    }
  }, [auth, db]);

  const logout = useCallback(async () => {
    if (!auth) return;
    await signOut(auth);
  }, [auth]);

  const getConnectionToken = useCallback(async (): Promise<string | null> => {
    if (!auth?.currentUser) return null;
    return await auth.currentUser.getIdToken();
  }, [auth]);

  const stateContextValue = useMemo(() => ({
    user,
    isUserLoading,
    videos,
    searchQuery,
  }), [user, isUserLoading, videos, searchQuery]);

  const dispatchContextValue = useMemo(() => ({
    setSearchQuery,
    addVideo,
    deleteVideo,
    deleteCurrentUserAccount,
    improveReputation,
    login,
    registerAndSendCode,
    verifyRegistrationCodeAndCreateUser,
    loginWithGoogle,
    logout,
    getConnectionToken,
  }), [addVideo, deleteVideo, deleteCurrentUserAccount, improveReputation, login, registerAndSendCode, verifyRegistrationCodeAndCreateUser, loginWithGoogle, logout, getConnectionToken]);

  return (
    <AppStateContext.Provider value={stateContextValue}>
      <AppDispatchContext.Provider value={dispatchContextValue}>
        {children}
        <PointsAwardedModal
          open={awardedPoints > 0}
          points={awardedPoints}
          onConfirm={() => setAwardedPoints(0)}
        />
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export const useAppState = (): AppState => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppProvider component.');
  }
  return context;
};

export const useAppDispatch = (): AppDispatch => {
  const context = useContext(AppDispatchContext);
  if (context === undefined) {
    throw new Error('useAppDispatch must be used within an AppProvider component.');
  }
  return context;
};

export const useApp = (): AppState & AppDispatch => {
  return {
    ...useAppState(),
    ...useAppDispatch()
  }
}
