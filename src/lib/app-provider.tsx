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

interface AppContextState {
    user: (UserProfile & { getIdToken: () => Promise<string>, emailVerified: boolean }) | null;
    isUserLoading: boolean;
    videos: Video[];
    addVideo: (video: Omit<Video, 'id' | 'submissionDate'>) => Promise<{ success: boolean, message: string }>;
    deleteVideo: (video: Video) => Promise<{ success: boolean, message: string }>;
    deleteCurrentUserAccount: (reason?: string) => Promise<{ success: boolean, message: string }>;
    login: (email: string, password: string) => Promise<boolean>;
    registerAndSendCode: (details: any) => Promise<{ success: boolean; message: string; userId?: string }>;
    verifyRegistrationCodeAndCreateUser: (userId: string, code: string, details: any) => Promise<{ success: boolean; message: string }>;
    loginWithGoogle: () => Promise<boolean>;
    logout: () => Promise<void>;
}

const AppContext = createContext<AppContextState | undefined>(undefined);

const getInitialAvatar = (name: string): string => {
    const sanitizedName = encodeURIComponent(name);
    return `https://source.boringavatars.com/beam/120/${sanitizedName}?colors=264653,2a9d8f,e9c46a,f4a261,e76f51`;
};


export function AppProvider({ children }: { children: ReactNode }) {
  const { auth, db } = useFirebase();
  const [user, setUser] = useState<AppContextState['user']>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [videos, setVideos] = useState<Video[]>([]);
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
        
        const storeTokenImmediately = async () => {
          try {
            const token = await authUser.getIdToken();
            if (typeof window !== 'undefined') {
              localStorage.setItem('authToken', token);
              localStorage.setItem('userAuthToken', token);
              localStorage.setItem('firebaseToken', token);
            }
          } catch (error) {
            console.error('[ViewLoop] Failed to store token:', error);
          }
        };
        
        storeTokenImmediately();

        const userRef = doc(db, 'users', authUser.uid);
        
        if (authUser.emailVerified) {
            updateDoc(userRef, { lastLogin: serverTimestamp() }).catch(err => {});
        }

        unsubscribeProfile = onSnapshot(
          userRef,
          (userSnap) => {
            if (userSnap.exists()) {
                const userProfileData = userSnap.data() as UserProfile;
                const userProfile = {
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
            localStorage.removeItem('authToken');
            localStorage.removeItem('userAuthToken');
            localStorage.removeItem('firebaseToken');
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
    if (!user || !db) return { success: false, message: "المستخدم غير مسجل دخوله أو أن قاعدة البيانات غير متاحة." };

    const youtubeVideoId = getYoutubeVideoId(videoData.url);
    if (!youtubeVideoId) {
        return { success: false, message: "رابط يوتيوب غير صالح." };
    }
    
    const videoRef = doc(db, 'videos', youtubeVideoId);
    
    try {
        const videoSnap = await getDoc(videoRef);

        if (videoSnap.exists()) {
            return { success: false, message: "هذا الفيديو موجود بالفعل في قائمة المشاهدة." };
        }
        
        const newVideo = {
            ...videoData,
            submissionDate: serverTimestamp(),
        };

        await setDoc(videoRef, newVideo)
          .catch(async (serverError: FirestoreError) => {
              const permissionError = new FirestorePermissionError({
                path: videoRef.path,
                operation: 'create',
                requestResourceData: newVideo,
              });
              errorEmitter.emit('permission-error', permissionError);
              throw serverError; // Re-throw to be caught by outer catch
          });

      return { success: true, message: "تمت إضافة الفيديو بنجاح." };
    } catch (error: any) {
      return { success: false, message: error.message || "فشل إنشاء الحملة." };
    }
  }, [user, db]);

  const deleteVideo = useCallback(async (video: Video): Promise<{ success: boolean, message: string }> => {
    if (!user || !db) return { success: false, message: "المستخدم غير مسجل دخوله أو أن قاعدة البيانات غير متاحة." };
    if (user.id !== video.submitterId) return { success: false, message: "ليس لديك إذن لحذف هذا الفيديو." };

    const videoRef = doc(db, 'videos', video.id);

    try {
        deleteDoc(videoRef)
        .catch(async (serverError: FirestoreError) => {
            const permissionError = new FirestorePermissionError({
              path: videoRef.path,
              operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
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
            } else if (error.code === 'permission-denied'){
                 message = "ليس لديك الإذن الكافي لحذف هذا الحساب.";
            }

            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists() && user) {
                const { getIdToken, emailVerified, ...profileData } = user;
                await setDoc(userDocRef, profileData);
            }
            return { success: false, message };
        }
    }, [auth, db, user]);

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
            localStorage.setItem('authToken', token);
            localStorage.setItem('userAuthToken', token);
            localStorage.setItem('firebaseToken', token);
        }
        
        return true;
    } catch (error) {
        return false;
    }
  }, [auth, db]);

  const registerAndSendCode = useCallback(async (details: any): Promise<{ success: boolean; message: string; userId?: string; }> => {
    const { name, email, password, gender } = details;
    if (!auth || !db) return { success: false, message: "خدمات المصادقة غير متاحة."};
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const authUser = userCredential.user;
        
        const locationRes = await fetch('/api/user-location');
        const locationData = await locationRes.json();
        
        const newUserProfile: Omit<UserProfile, 'id'> = {
            name: name,
            email: email,
            avatar: getInitialAvatar(name),
            role: 'user',
            gender: gender,
            country: locationData.country || 'Unknown',
            country_code: locationData.country_code || '',
            city: locationData.city || '',
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            points: 100,
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
            localStorage.setItem('authToken', token);
            localStorage.setItem('userAuthToken', token);
            localStorage.setItem('firebaseToken', token);
        }

        if (!userSnap.exists()) {
            const locationRes = await fetch('/api/user-location');
            const locationData = await locationRes.json();
            
            const gender = 'male';
            const newUserProfile: Omit<UserProfile, 'id'> = {
                name: authUser.displayName || 'Anonymous User',
                email: authUser.email!,
                avatar: getInitialAvatar(authUser.displayName || 'A'),
                role: 'user',
                gender: gender,
                country: locationData.country || 'Unknown',
                country_code: locationData.country_code || '',
                city: locationData.city || '',
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
                points: 100,
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

  const contextValue = useMemo(() => ({
    user,
    isUserLoading,
    videos,
    addVideo,
    deleteVideo,
    deleteCurrentUserAccount,
    login,
    registerAndSendCode,
    verifyRegistrationCodeAndCreateUser,
    loginWithGoogle,
    logout,
  }), [user, isUserLoading, videos, addVideo, deleteVideo, deleteCurrentUserAccount, login, registerAndSendCode, verifyRegistrationCodeAndCreateUser, loginWithGoogle, logout]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      <PointsAwardedModal 
        open={awardedPoints > 0}
        points={awardedPoints}
        onConfirm={() => setAwardedPoints(0)}
      />
    </AppContext.Provider>
  );
}

export const useApp = (): AppContextState => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider component.');
  }
  return context;
};

    

    
