import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, appId } from '../firebase';
import { DEFAULT_TSHIRT_BACKGROUNDS } from '../constants';
import { compressImage } from '../imageUtils';

export function useTshirtBackgrounds(user) {
  const [tshirtBackgrounds, setTshirtBackgrounds] = useState(DEFAULT_TSHIRT_BACKGROUNDS);
  const [backgroundEditorModal, setBackgroundEditorModal] = useState({
    isOpen: false,
    image: null,
    imageName: ''
  });

  useEffect(() => {
    if (!user) return;

    const bgLibraryRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'backgrounds');
    const unsubscribe = onSnapshot(bgLibraryRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().library) {
        const customBackgrounds = docSnap.data().library;
        const filteredCustom = customBackgrounds.filter(
          bg => !DEFAULT_TSHIRT_BACKGROUNDS.find(def => def.id === bg.id)
        );
        setTshirtBackgrounds([...DEFAULT_TSHIRT_BACKGROUNDS, ...filteredCustom]);
      } else {
        setTshirtBackgrounds(DEFAULT_TSHIRT_BACKGROUNDS);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleTshirtBgUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const compressedBase64 = await compressImage(file);
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      
      setBackgroundEditorModal({
        isOpen: true,
        image: compressedBase64,
        imageName: fileName
      });
    } catch (err) {
      console.error("Background upload error", err);
      alert("Failed to upload t-shirt background.");
    }
  };

  const handleSaveBackground = async (data) => {
    const { url, name } = data;
    
    try {
      const newBg = {
        id: `custom-${Date.now()}`,
        name: name,
        url: url
      };
      const updatedBackgrounds = [...tshirtBackgrounds, newBg];
      setTshirtBackgrounds(updatedBackgrounds);
      
      const bgLibraryRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'backgrounds');
      await setDoc(bgLibraryRef, { library: updatedBackgrounds }, { merge: true });
    } catch (err) {
      console.error("Background save error", err);
      throw err;
    }
  };

  const handleCloseBackgroundEditor = () => {
    setBackgroundEditorModal({
      isOpen: false,
      image: null,
      imageName: ''
    });
  };

  const handleDeleteTshirtBg = async (bgId) => {
    if (bgId.startsWith('custom-')) {
      const updatedBackgrounds = tshirtBackgrounds.filter(bg => bg.id !== bgId);
      setTshirtBackgrounds(updatedBackgrounds);
      
      const bgLibraryRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'backgrounds');
      await setDoc(bgLibraryRef, { library: updatedBackgrounds }, { merge: true });
    }
  };

  return {
    tshirtBackgrounds,
    backgroundEditorModal,
    handleTshirtBgUpload,
    handleSaveBackground,
    handleCloseBackgroundEditor,
    handleDeleteTshirtBg
  };
}

// Made with Bob
