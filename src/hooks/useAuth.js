import { useState, useEffect } from 'react';
import {
  GoogleAuthProvider,
  signInAnonymously,
  signInWithCustomToken,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, ADMIN_UIDS } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [adminError, setAdminError] = useState('');

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
        setAdminError("Failed to connect to the ordering system.");
      }
    };
    
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAdminLogin = async () => {
    setAdminError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const uid = result.user.uid;
      
      if (!ADMIN_UIDS.includes(uid)) {
        await signOut(auth);
        setAdminError('Your Google account is not authorized for admin access.');
        return false;
      }
      return true;
    } catch (err) {
      console.error("Admin login error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setAdminError('Sign-in was cancelled.');
      } else {
        setAdminError('Failed to sign in. Please try again.');
      }
      return false;
    }
  };

  const handleAdminLogout = async () => {
    try {
      await signOut(auth);
      return true;
    } catch (err) {
      console.error("Logout error:", err);
      return false;
    }
  };

  const isAdmin = user && ADMIN_UIDS.includes(user.uid);

  return {
    user,
    isLoadingAuth,
    adminError,
    setAdminError,
    handleAdminLogin,
    handleAdminLogout,
    isAdmin
  };
}

// Made with Bob
