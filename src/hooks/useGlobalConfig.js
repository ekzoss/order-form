import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, appId } from '../firebase';

export function useGlobalConfig(user) {
  const [globalConfig, setGlobalConfig] = useState({
    pageTitle: 'Order Form',
    pageDescription: '',
    notificationEmail: '',
    processingFee: '2.90% + $0.30'
  });
  const [configForm, setConfigForm] = useState({ ...globalConfig });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [storeConfig, setStoreConfig] = useState({ frontImage: null, backImage: null });

  useEffect(() => {
    if (!user) return;

    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main');
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Store legacy data for backward compatibility
        setStoreConfig(data);
        // Extract only global settings
        const config = {
          pageTitle: data.pageTitle || 'Order Form',
          pageDescription: data.pageDescription || '',
          notificationEmail: data.notificationEmail || '',
          processingFee: data.processingFee || '2.90% + $0.30'
        };
        setGlobalConfig(config);
        setConfigForm(config);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const normalizedSavedConfig = useMemo(() => ({
    pageTitle: globalConfig.pageTitle || 'Order Form',
    pageDescription: globalConfig.pageDescription || '',
    notificationEmail: globalConfig.notificationEmail || '',
    processingFee: globalConfig.processingFee || '2.90% + $0.30'
  }), [globalConfig]);

  const hasUnsavedConfigChanges = JSON.stringify(configForm) !== JSON.stringify(normalizedSavedConfig);

  const saveConfig = async () => {
    // Validate EmailJS configuration if notification email is set
    if (configForm.notificationEmail && configForm.notificationEmail.trim()) {
      const emailjsServiceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const emailjsTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const emailjsPublicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
      
      if (!emailjsServiceId || !emailjsTemplateId || !emailjsPublicKey) {
        alert("Error: Notification email is set but EmailJS environment variables are not configured.\n\nPlease set:\n- VITE_EMAILJS_SERVICE_ID\n- VITE_EMAILJS_TEMPLATE_ID\n- VITE_EMAILJS_PUBLIC_KEY");
        return false;
      }
    }
    
    setIsSavingConfig(true);
    try {
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main');
      await setDoc(configRef, configForm, { merge: true });
      return true;
    } catch (err) {
      console.error("Save config error", err);
      alert("Failed to save settings.");
      return false;
    } finally {
      setIsSavingConfig(false);
    }
  };

  return {
    globalConfig,
    configForm,
    setConfigForm,
    isSavingConfig,
    storeConfig,
    hasUnsavedConfigChanges,
    saveConfig
  };
}

// Made with Bob
