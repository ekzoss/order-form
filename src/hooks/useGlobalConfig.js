import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, appId } from '../firebase';

export function useGlobalConfig(user) {
  const [globalConfig, setGlobalConfig] = useState({
    pageTitle: 'Austin Velocity 161 Diamond Team Shirt - Order form',
    pageDescription: '',
    venmoUsername: 'ekzoss',
    cashappUsername: 'KandiZoss',
    notificationEmail: '',
    emailjsServiceId: '',
    emailjsTemplateId: '',
    emailjsPublicKey: '',
    processingFee: ''
  });
  const [configForm, setConfigForm] = useState({ ...globalConfig });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [storeConfig, setStoreConfig] = useState({ frontImage: null, backImage: null });

  useEffect(() => {
    if (!user) return;

    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_config', 'main');
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Store legacy data for backward compatibility
        setStoreConfig(data);
        // Extract only global settings
        const config = {
          pageTitle: data.pageTitle || 'Austin Velocity 161 Diamond Team Shirt - Order form',
          pageDescription: data.pageDescription || '',
          venmoUsername: data.venmoUsername || 'ekzoss',
          cashappUsername: data.cashappUsername || 'KandiZoss',
          notificationEmail: data.notificationEmail || '',
          emailjsServiceId: data.emailjsServiceId || '',
          emailjsTemplateId: data.emailjsTemplateId || '',
          emailjsPublicKey: data.emailjsPublicKey || '',
          processingFee: data.processingFee || ''
        };
        setGlobalConfig(config);
        setConfigForm(config);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const normalizedSavedConfig = useMemo(() => ({
    pageTitle: globalConfig.pageTitle || 'Austin Velocity 161 Diamond Team Shirt - Order form',
    pageDescription: globalConfig.pageDescription || '',
    venmoUsername: globalConfig.venmoUsername || 'ekzoss',
    cashappUsername: globalConfig.cashappUsername || 'KandiZoss',
    notificationEmail: globalConfig.notificationEmail || '',
    emailjsServiceId: globalConfig.emailjsServiceId || '',
    emailjsTemplateId: globalConfig.emailjsTemplateId || '',
    emailjsPublicKey: globalConfig.emailjsPublicKey || '',
    processingFee: globalConfig.processingFee || ''
  }), [globalConfig]);

  const hasUnsavedConfigChanges = JSON.stringify(configForm) !== JSON.stringify(normalizedSavedConfig);

  const saveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_config', 'main');
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
