import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  ShieldCheck,
  Lock,
  LogOut,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  X,
  Save,
  ZoomIn,
  Upload,
  Image as ImageIcon,
  Printer,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import ImageEditorModal from './ImageEditorModal';
import BackgroundEditorModal from './BackgroundEditorModal';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import emailjs from '@emailjs/browser';


// --- Firebase Initialization ---
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBtdlYss5_ic-pf2uQoXtXNvChYIh20geA",
  authDomain: "order-form-9d6b8.firebaseapp.com",
  projectId: "order-form-9d6b8",
  storageBucket: "order-form-9d6b8.firebasestorage.app",
  messagingSenderId: "765640988540",
  appId: "1:765640988540:web:72b33984957bd2d74476f9"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-tshirt-app';

// --- Constants ---
const ADMIN_PASSWORD = "admin123";
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

// Helper function to generate solid color background as base64
const generateSolidColorBackground = (color, width = 800, height = 1000) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.9);
};

// Default t-shirt backgrounds - solid colors
const DEFAULT_TSHIRT_BACKGROUNDS = [
  {
    id: 'white',
    name: 'White',
    color: '#FFFFFF',
    url: generateSolidColorBackground('#FFFFFF')
  },
  {
    id: 'black',
    name: 'Black',
    color: '#000000',
    url: generateSolidColorBackground('#000000')
  },
  {
    id: 'gray',
    name: 'Gray',
    color: '#808080',
    url: generateSolidColorBackground('#808080')
  },
  {
    id: 'navy',
    name: 'Navy',
    color: '#001F3F',
    url: generateSolidColorBackground('#001F3F')
  },
  {
    id: 'red',
    name: 'Red',
    color: '#DC143C',
    url: generateSolidColorBackground('#DC143C')
  },
  {
    id: 'maroon',
    name: 'Maroon',
    color: '#800000',
    url: generateSolidColorBackground('#800000')
  },
  {
    id: 'green',
    name: 'Forest Green',
    color: '#228B22',
    url: generateSolidColorBackground('#228B22')
  },
  {
    id: 'royal',
    name: 'Royal Blue',
    color: '#4169E1',
    url: generateSolidColorBackground('#4169E1')
  },
  {
    id: 'purple',
    name: 'Purple',
    color: '#800080',
    url: generateSolidColorBackground('#800080')
  },
  {
    id: 'orange',
    name: 'Orange',
    color: '#FF8C00',
    url: generateSolidColorBackground('#FF8C00')
  },
  {
    id: 'brown',
    name: 'Brown',
    color: '#8B4513',
    url: generateSolidColorBackground('#8B4513')
  },
  {
    id: 'pink',
    name: 'Pink',
    color: '#FF69B4',
    url: generateSolidColorBackground('#FF69B4')
  },
  {
    id: 'yellow',
    name: 'Gold',
    color: '#FFD700',
    url: generateSolidColorBackground('#FFD700')
  },
  {
    id: 'lightblue',
    name: 'Light Blue',
    color: '#87CEEB',
    url: generateSolidColorBackground('#87CEEB')
  }
];

// --- Helper: Compress Image to Base64 ---
// Compresses uploaded images so they fit safely within Firestore limits
const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: true });
        ctx.drawImage(img, 0, 0, width, height);
        
        // Use PNG for files with transparency, JPEG for others
        const isPNG = file.type === 'image/png';
        const format = isPNG ? 'image/png' : 'image/jpeg';
        const quality = isPNG ? 0.95 : 0.8;
        
        resolve(canvas.toDataURL(format, quality));
      };
    };
  });
};

// Composite design image on top of t-shirt background with proper PNG transparency handling
const compositeImageWithTshirt = (designImage, tshirtBackgroundUrl, position = { x: 50, y: 28 }, sizePercent = 45) => {
  return new Promise((resolve, reject) => {
    // Create canvas with explicit alpha channel
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d', {
      alpha: true,
      willReadFrequently: false
    });
    
    // Load t-shirt background image
    const tshirtImg = new window.Image();
    tshirtImg.crossOrigin = 'anonymous';
    tshirtImg.src = tshirtBackgroundUrl;
    
    tshirtImg.onload = () => {
      // Draw the t-shirt background (no color tinting, just use the image as-is)
      ctx.drawImage(tshirtImg, 0, 0, canvas.width, canvas.height);
      
      // Now load and composite the design on top
      const designImg = new window.Image();
      designImg.crossOrigin = 'anonymous';
      designImg.src = designImage;
      
      designImg.onload = () => {
        // Calculate design size based on percentage
        const maxDesignWidth = canvas.width * (sizePercent / 100);
        
        let designWidth = maxDesignWidth;
        let designHeight = (designImg.height / designImg.width) * designWidth;
        
        // Position based on percentage (x, y are center points)
        const x = (canvas.width * (position.x / 100)) - (designWidth / 2);
        const y = (canvas.height * (position.y / 100));
        
        // Draw design with full alpha support
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(designImg, x, y, designWidth, designHeight);
        ctx.restore();
        
        // Export as PNG to preserve transparency
        try {
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          resolve(dataUrl);
        } catch (err) {
          reject(new Error('Failed to export composite image: ' + err.message));
        }
      };
      
      designImg.onerror = (err) => {
        reject(new Error('Failed to load design image: ' + err));
      };
    };
    
    tshirtImg.onerror = (err) => {
      reject(new Error('Failed to load t-shirt template: ' + err));
    };
  });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('store'); // 'store', 'adminLogin', 'adminDashboard'
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Global Configuration State (payment info, email settings - NOT design-specific)
  const [globalConfig, setGlobalConfig] = useState({
    pageTitle: 'Austin Velocity 161 Diamond Team Shirt - Order form',
    pageDescription: '',
    venmoUsername: 'ekzoss',
    cashappUsername: 'KandiZoss',
    notificationEmail: '',
    emailjsServiceId: '',
    emailjsTemplateId: '',
    emailjsPublicKey: ''
  });
  const [configForm, setConfigForm] = useState({ ...globalConfig });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  
  // Feedback form state (for preview designs)
  const [feedbackByDesign, setFeedbackByDesign] = useState({});
  const [submittingFeedback, setSubmittingFeedback] = useState({});
  const [submittedFeedback, setSubmittedFeedback] = useState({}); // Track which designs have submitted feedback
  const [feedbackList, setFeedbackList] = useState([]); // All feedback from Firestore

  // Design Management State
  const [designs, setDesigns] = useState([]);
  const [isLoadingDesigns, setIsLoadingDesigns] = useState(true);
  const [selectedDesignId, setSelectedDesignId] = useState(null);
  const [editingDesignId, setEditingDesignId] = useState(null);
  const [designForm, setDesignForm] = useState(null);
  const [isCreatingDesign, setIsCreatingDesign] = useState(false);
  const [newDesignForm, setNewDesignForm] = useState({
    name: '',
    productHeader: '',
    productDescription: '',
    pricePerShirt: 7.50
  });
  const [collapsedDesigns, setCollapsedDesigns] = useState({});
  const [deleteConfirmDesignId, setDeleteConfirmDesignId] = useState(null);
  const [designEdits, setDesignEdits] = useState({}); // Track pending edits per design

  // Legacy Store Configuration State (for backward compatibility during transition)
  const [storeConfig, setStoreConfig] = useState({ frontImage: null, backImage: null });
  const [activeTab, setActiveTab] = useState('front'); // 'front' or 'back' image view
  const [zoomedImage, setZoomedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Image Editor Modal State
  const [imageEditorModal, setImageEditorModal] = useState({
    isOpen: false,
    side: null,
    designId: null
  });
  
  // Background Editor Modal State
  const [backgroundEditorModal, setBackgroundEditorModal] = useState({
    isOpen: false,
    image: null,
    imageName: ''
  });
  
  // T-shirt background state (always enabled now)
  const [selectedTshirtBg, setSelectedTshirtBg] = useState({
    frontImage: DEFAULT_TSHIRT_BACKGROUNDS[0].url,
    backImage: DEFAULT_TSHIRT_BACKGROUNDS[0].url
  });
  const [tshirtBackgrounds, setTshirtBackgrounds] = useState(DEFAULT_TSHIRT_BACKGROUNDS);
  const [designImage, setDesignImage] = useState({ frontImage: null, backImage: null });
  const [previewImage, setPreviewImage] = useState({ frontImage: null, backImage: null });
  
  // Design positioning and sizing state (percentage-based for responsiveness)
  const [designPosition, setDesignPosition] = useState({
    frontImage: { x: 50, y: 28 }, // x, y as percentages
    backImage: { x: 50, y: 28 }
  });
  const [designSize, setDesignSize] = useState({
    frontImage: 45, // width as percentage of canvas
    backImage: 45
  });

  // Form State
  const [sizesByDesign, setSizesByDesign] = useState({}); // { designId: { S: 0, M: 0, ... } }
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Order Modal State
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderModalName, setOrderModalName] = useState('');
  const [orderModalNotes, setOrderModalNotes] = useState('');
  const [orderSubmitted, setOrderSubmitted] = useState(false);

  // Admin State
  const [passwordInput, setPasswordInput] = useState('');
  const [adminError, setAdminError] = useState('');
  const [orders, setOrders] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // --- 1. Update Browser Title ---
  useEffect(() => {
    if (globalConfig.pageTitle) {
      document.title = globalConfig.pageTitle;
    }
  }, [globalConfig.pageTitle]);

  // --- 2. Scroll to top when returning to store view ---
  useEffect(() => {
    if (view === 'store') {
      window.scrollTo(0, 0);
    }
  }, [view]);

  // --- 3. Authentication ---
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
        setError("Failed to connect to the ordering system.");
      }
    };
    
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // --- 2. Check Migration Status & Fetch Data ---
  useEffect(() => {
    if (!user) return;


    // Fetch T-shirt Background Library
    const bgLibraryRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_config', 'backgrounds');
    const unsubscribeBgLibrary = onSnapshot(bgLibraryRef, (docSnap) => {
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

    // Fetch Global Config (payment info, email settings only)
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_config', 'main');
    const unsubscribeConfig = onSnapshot(configRef, (docSnap) => {
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
          emailjsPublicKey: data.emailjsPublicKey || ''
        };
        setGlobalConfig(config);
        setConfigForm(config);
      }
    });

    // Fetch Designs
    const designsRef = collection(db, 'artifacts', appId, 'public', 'data', 'designs');
    const unsubscribeDesigns = onSnapshot(designsRef, (snapshot) => {
      const fetchedDesigns = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by order field (ascending), then by createdAt (descending) as fallback
      fetchedDesigns.sort((a, b) => {
        const aOrder = a.order !== undefined ? a.order : 999999;
        const bOrder = b.order !== undefined ? b.order : 999999;
        
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        // If both have same order (or both undefined), sort by createdAt
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      
      setDesigns(fetchedDesigns);
      setIsLoadingDesigns(false);
      
      // Auto-select first design if none selected
      if (!selectedDesignId && fetchedDesigns.length > 0) {
        setSelectedDesignId(fetchedDesigns[0].id);
      }
    });

    return () => {
      unsubscribeBgLibrary();
      unsubscribeConfig();
      unsubscribeDesigns();
    };
  }, [user, selectedDesignId]);

  useEffect(() => {
    if (!user || view !== 'adminDashboard') return;

    // Fetch Orders
    const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'tshirt_orders');
    const q = query(ordersRef);

    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      fetchedOrders.sort((a, b) => b.timestamp - a.timestamp);
      setOrders(fetchedOrders);
    }, (err) => {
      console.error("Error fetching orders:", err);
      setAdminError("Failed to load orders.");
    });

    // Fetch Feedback
    const feedbackRef = collection(db, 'artifacts', appId, 'public', 'data', 'feedback');
    const unsubscribeFeedback = onSnapshot(feedbackRef, (snapshot) => {
      const fetchedFeedback = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      fetchedFeedback.sort((a, b) => b.timestamp - a.timestamp);
      setFeedbackList(fetchedFeedback);
    }, (err) => {
      console.error("Error fetching feedback:", err);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeFeedback();
    };
  }, [user, view]);

  // --- Get Selected Design ---
  const selectedDesign = useMemo(() => {
    return designs.find(d => d.id === selectedDesignId) || null;
  }, [designs, selectedDesignId]);

  // --- Actions ---

  const normalizedSavedConfig = useMemo(() => ({
    pageTitle: globalConfig.pageTitle || 'Austin Velocity 161 Diamond Team Shirt - Order form',
    pageDescription: globalConfig.pageDescription || '',
    venmoUsername: globalConfig.venmoUsername || 'ekzoss',
    cashappUsername: globalConfig.cashappUsername || 'KandiZoss',
    notificationEmail: globalConfig.notificationEmail || '',
    emailjsServiceId: globalConfig.emailjsServiceId || '',
    emailjsTemplateId: globalConfig.emailjsTemplateId || '',
    emailjsPublicKey: globalConfig.emailjsPublicKey || ''
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

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    await saveConfig();
  };

  // --- Design Management Actions ---


  const handleCreateDesign = async () => {
    try {
      // Generate unique default name
      const existingNumbers = designs
        .map(d => {
          const match = d.name.match(/^New Design (\d+)$/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(n => n > 0);
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      const defaultName = `New Design ${nextNumber}`;

      const designsRef = collection(db, 'artifacts', appId, 'public', 'data', 'designs');
      
      // Calculate order value - place at end
      const maxOrder = designs.length > 0
        ? Math.max(...designs.map(d => d.order !== undefined ? d.order : 0))
        : -1;
      
      const newDesign = {
        name: defaultName,
        productHeader: defaultName,
        productDescription: '',
        pricePerShirt: 7.50,
        frontImage: null,
        backImage: null,
        status: 'preview',
        order: maxOrder + 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const docRef = await addDoc(designsRef, newDesign);
      
      // Auto-expand the new design
      setCollapsedDesigns(prev => ({
        ...prev,
        [docRef.id]: false
      }));
      
      setSelectedDesignId(docRef.id);
    } catch (err) {
      console.error('Error creating design:', err);
      alert('Failed to create design');
    }
  };

  const handleStartEditDesign = (design) => {
    setEditingDesignId(design.id);
    setDesignForm({
      name: design.name,
      productHeader: design.productHeader,
      productDescription: design.productDescription,
      pricePerShirt: design.pricePerShirt
    });
  };

  const handleSaveDesignEdit = async (designId) => {
    try {
      const designRef = doc(db, 'artifacts', appId, 'public', 'data', 'designs', designId);
      await updateDoc(designRef, {
        name: designForm.name,
        productHeader: designForm.productHeader,
        productDescription: designForm.productDescription,
        pricePerShirt: designForm.pricePerShirt,
        updatedAt: Date.now()
      });
      setEditingDesignId(null);
      setDesignForm(null);
    } catch (err) {
      console.error('Error updating design:', err);
      alert('Failed to update design');
    }
  };

  const handleDeleteDesign = async (designId) => {
    const designOrders = orders.filter(o => o.designId === designId);
    const confirmMessage = designOrders.length > 0
      ? `⚠️ WARNING: This design has ${designOrders.length} order(s).\n\nDeleting this design will result in permanent loss of:\n- Design images and settings\n- All ${designOrders.length} associated order(s)\n- Order history and customer data\n\nThis action CANNOT be undone!\n\nAre you absolutely sure you want to delete "${designs.find(d => d.id === designId)?.name}"?`
      : `Are you sure you want to delete "${designs.find(d => d.id === designId)?.name}"?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'designs', designId));
      if (selectedDesignId === designId) {
        setSelectedDesignId(designs.find(d => d.id !== designId)?.id || null);
      }
      setDeleteConfirmDesignId(null);
    } catch (err) {
      console.error('Error deleting design:', err);
      alert('Failed to delete design');
    }
  };

  const toggleDesignCollapse = (designId) => {
    setCollapsedDesigns(prev => ({
      ...prev,
      [designId]: prev[designId] === false ? true : false
    }));
  };

  const handleMoveDesign = async (designId, direction) => {
    try {
      const currentIndex = designs.findIndex(d => d.id === designId);
      if (currentIndex === -1) return;
      
      // Check bounds
      if (direction === 'up' && currentIndex === 0) return;
      if (direction === 'down' && currentIndex === designs.length - 1) return;
      
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const currentDesign = designs[currentIndex];
      const targetDesign = designs[targetIndex];
      
      // If designs don't have order field, initialize them based on current index
      const currentOrder = currentDesign.order !== undefined ? currentDesign.order : currentIndex;
      const targetOrder = targetDesign.order !== undefined ? targetDesign.order : targetIndex;
      
      // Update both designs in Firestore - swap their order values
      const batch = writeBatch(db);
      
      const currentRef = doc(db, 'artifacts', appId, 'public', 'data', 'designs', currentDesign.id);
      batch.update(currentRef, { order: targetOrder, updatedAt: Date.now() });
      
      const targetRef = doc(db, 'artifacts', appId, 'public', 'data', 'designs', targetDesign.id);
      batch.update(targetRef, { order: currentOrder, updatedAt: Date.now() });
      
      await batch.commit();
    } catch (err) {
      console.error('Error reordering designs:', err);
      alert('Failed to reorder designs: ' + err.message);
    }
  };

  const handleUpdateDesignField = (designId, field, value) => {
    // Store edits locally, don't save to Firestore yet
    setDesignEdits(prev => ({
      ...prev,
      [designId]: {
        ...(prev[designId] || {}),
        [field]: value
      }
    }));
  };

  const handleChangeDesignStatus = async (designId, newStatus) => {
    try {
      const designRef = doc(db, 'artifacts', appId, 'public', 'data', 'designs', designId);
      await updateDoc(designRef, {
        status: newStatus,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error('Error updating design status:', err);
      alert('Failed to update design status');
    }
  };

  const saveAllDesignEdits = async () => {
    const editedDesignIds = Object.keys(designEdits);
    if (editedDesignIds.length === 0) return true;

    try {
      // Save all design edits to Firestore
      const promises = editedDesignIds.map(designId => {
        const designRef = doc(db, 'artifacts', appId, 'public', 'data', 'designs', designId);
        return updateDoc(designRef, {
          ...designEdits[designId],
          updatedAt: Date.now()
        });
      });
      
      await Promise.all(promises);
      setDesignEdits({}); // Clear pending edits
      return true;
    } catch (err) {
      console.error('Error saving design edits:', err);
      alert('Failed to save design changes');
      return false;
    }
  };


  // --- Image Editor Actions ---

  const handleOpenImageEditor = (side, designId) => {
    setImageEditorModal({
      isOpen: true,
      side: side,
      designId: designId
    });
  };

  const handleCloseImageEditor = () => {
    setImageEditorModal({
      isOpen: false,
      side: null,
      designId: null
    });
  };
  
  const handleSaveImageEditor = async (data) => {
    console.log('handleSaveImageEditor called with data:', data);
    const { previewImage: newPreviewImage } = data;
    const side = imageEditorModal.side;
    const designId = imageEditorModal.designId;
    
    console.log('Side:', side);
    console.log('Design ID:', designId);
    console.log('Preview image length:', newPreviewImage?.length);
    
    if (!side || !designId) {
      const error = new Error("No side or design specified");
      console.error('Error:', error);
      throw error;
    }
    
    try {
      // Update design document in Firestore
      console.log('Updating Firestore...');
      const designRef = doc(db, 'artifacts', appId, 'public', 'data', 'designs', designId);
      await updateDoc(designRef, {
        [side]: newPreviewImage,
        updatedAt: Date.now()
      });
      
      console.log('Firestore update successful');
      console.log('Save completed successfully');
    } catch (err) {
      console.error('Error in handleSaveImageEditor:', err);
      console.error('Error details:', err.message, err.stack);
      throw err;
    }
  };

  // --- Multi-Design Order Submission ---
  const handleSubmitMultiDesignOrder = async () => {
    if (!orderModalName.trim()) {
      alert('Please enter your name');
      return;
    }

    setIsSubmitting(true);
    try {
      const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'tshirt_orders');
      const timestamp = Date.now();
      
      // Create one order per design that has items
      const orderPromises = [];
      const orderDetails = [];
      
      for (const [designId, designSizes] of Object.entries(sizesByDesign)) {
        const totalItemsForDesign = Object.values(designSizes).reduce((sum, qty) => sum + qty, 0);
        
        if (totalItemsForDesign > 0) {
          const design = designs.find(d => d.id === designId);
          if (!design) continue;
          
          const orderData = {
            name: orderModalName.trim(),
            sizes: designSizes,
            notes: orderModalNotes.trim(),
            designId: designId,
            designName: design.name,
            pricePerShirt: design.pricePerShirt,
            totalItems: totalItemsForDesign,
            totalPrice: totalItemsForDesign * design.pricePerShirt,
            timestamp: timestamp,
            createdAt: timestamp
          };
          
          orderPromises.push(addDoc(ordersRef, orderData));
          
          // Store order details for email
          orderDetails.push({
            designName: design.name,
            sizes: designSizes,
            totalItems: totalItemsForDesign,
            totalPrice: totalItemsForDesign * design.pricePerShirt
          });
        }
      }
      
      await Promise.all(orderPromises);
      
      // Send email notification if EmailJS is configured
      if (globalConfig.emailjsServiceId && globalConfig.emailjsTemplateId && globalConfig.emailjsPublicKey && globalConfig.notificationEmail) {
        try {
          // Format order details for email body
          const orderSummary = orderDetails.map(order => {
            const sizesText = SIZES
              .filter(size => order.sizes[size] > 0)
              .map(size => `${size}: ${order.sizes[size]}`)
              .join(', ');
            return `${order.designName} - ${sizesText} (${order.totalItems} items - $${order.totalPrice.toFixed(2)})`;
          }).join('\n');
          
          // Build email body
          const emailBody = `Name: ${orderModalName.trim()}
Total Items: ${totalItems}
Total Price: $${totalPrice.toFixed(2)}
Notes: ${orderModalNotes.trim() || 'None'}

Order Details:
${orderSummary}

Order Date: ${new Date().toLocaleString()}`;
          
          const emailParams = {
            to_email: globalConfig.notificationEmail,
            email: globalConfig.notificationEmail,
            subject: `New Order from ${orderModalName.trim()}`,
            body: emailBody
          };
          
          await emailjs.send(
            globalConfig.emailjsServiceId,
            globalConfig.emailjsTemplateId,
            emailParams,
            globalConfig.emailjsPublicKey
          );
        } catch (emailErr) {
          console.error('Error sending email notification:', emailErr);
          // Don't fail the order if email fails
        }
      }
      
      setOrderSubmitted(true);
      setIsSubmitting(false);
    } catch (err) {
      console.error('Error submitting orders:', err);
      alert('Failed to submit order: ' + err.message);
      setIsSubmitting(false);
    }
  };

  const handleCloseOrderModal = () => {
    setShowOrderModal(false);
    setOrderSubmitted(false);
    setOrderModalName('');
    setOrderModalNotes('');
    // Clear the cart
    setSizesByDesign({});
  };

  // Handle feedback submission for preview designs
  const handleSubmitFeedback = async (designId) => {
    const feedback = feedbackByDesign[designId] || '';
    if (!feedback.trim()) {
      alert('Please enter your feedback before submitting.');
      return;
    }

    const design = designs.find(d => d.id === designId);
    if (!design) return;

    setSubmittingFeedback(prev => ({ ...prev, [designId]: true }));

    try {
      // Save feedback to Firestore
      const feedbackRef = collection(db, 'artifacts', appId, 'public', 'data', 'feedback');
      const feedbackDoc = {
        designId: designId,
        designName: design.name,
        feedback: feedback,
        timestamp: Date.now(),
        createdAt: new Date().toISOString()
      };
      
      await addDoc(feedbackRef, feedbackDoc);

      // Send notification email if EmailJS is configured
      if (globalConfig.emailjsServiceId && globalConfig.emailjsTemplateId &&
          globalConfig.emailjsPublicKey && globalConfig.notificationEmail) {
        const emailBody = `${feedback}

Submitted: ${new Date().toLocaleString()}`;

        const emailParams = {
          to_email: globalConfig.notificationEmail,
          email: globalConfig.notificationEmail,
          subject: `New Feedback for ${design.name}`,
          body: emailBody
        };

        await emailjs.send(
          globalConfig.emailjsServiceId,
          globalConfig.emailjsTemplateId,
          emailParams,
          globalConfig.emailjsPublicKey
        );
      }

      // Mark as submitted
      setSubmittedFeedback(prev => ({ ...prev, [designId]: true }));
    } catch (err) {
      console.error('Error submitting feedback:', err);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setSubmittingFeedback(prev => ({ ...prev, [designId]: false }));
    }
  };

  // Handle deleting feedback
  const handleDeleteFeedback = async (feedbackId) => {
    try {
      const feedbackRef = doc(db, 'artifacts', appId, 'public', 'data', 'feedback', feedbackId);
      await deleteDoc(feedbackRef);
    } catch (err) {
      console.error('Error deleting feedback:', err);
      alert('Failed to delete feedback');
    }
  };
  
  // Handle uploading a new t-shirt background - opens editor modal
  const handleTshirtBgUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const compressedBase64 = await compressImage(file);
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      
      // Open the background editor modal
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
  
  // Handle saving background from editor modal
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
      
      // Save to Firestore
      const bgLibraryRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_config', 'backgrounds');
      await setDoc(bgLibraryRef, { library: updatedBackgrounds }, { merge: true });
    } catch (err) {
      console.error("Background save error", err);
      throw err; // Re-throw so modal can show error
    }
  };
  
  // Close background editor modal
  const handleCloseBackgroundEditor = () => {
    setBackgroundEditorModal({
      isOpen: false,
      image: null,
      imageName: ''
    });
  };
  
  // Handle deleting a custom t-shirt background
  const handleDeleteTshirtBg = async (bgId) => {
    if (bgId.startsWith('custom-')) {
      const updatedBackgrounds = tshirtBackgrounds.filter(bg => bg.id !== bgId);
      setTshirtBackgrounds(updatedBackgrounds);
      
      // Save to Firestore
      const bgLibraryRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_config', 'backgrounds');
      await setDoc(bgLibraryRef, { library: updatedBackgrounds }, { merge: true });
    }
  };

  const handleSizeChange = (designId, size, value) => {
    const numValue = parseInt(value, 10) || 0;
    setSizesByDesign(prev => ({
      ...prev,
      [designId]: {
        ...(prev[designId] || { S: 0, M: 0, L: 0, XL: 0, XXL: 0 }),
        [size]: Math.max(0, numValue)
      }
    }));
  };

  // Legacy function for old code
  const handleSizeChangeLegacy = (size, value) => {
    const numValue = parseInt(value, 10) || 0;
    setSizes(prev => ({ ...prev, [size]: Math.max(0, numValue) }));
  };

  // Calculate total items across all designs
  const totalItems = useMemo(() => {
    let total = 0;
    Object.values(sizesByDesign).forEach(designSizes => {
      total += Object.values(designSizes).reduce((acc, curr) => acc + curr, 0);
    });
    return total;
  }, [sizesByDesign]);

  // Calculate total price across all designs with their individual prices
  const totalPrice = useMemo(() => {
    let total = 0;
    Object.entries(sizesByDesign).forEach(([designId, designSizes]) => {
      const design = designs.find(d => d.id === designId);
      if (design) {
        const designTotal = Object.values(designSizes).reduce((acc, curr) => acc + curr, 0);
        total += designTotal * design.pricePerShirt;
      }
    });
    return total;
  }, [sizesByDesign, designs]);


  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setView('adminDashboard');
      setPasswordInput('');
      setAdminError('');
    } else {
      setAdminError('Incorrect password.');
    }
  };

  const handleExitAdmin = async () => {
    if (hasUnsavedConfigChanges) {
      const shouldSave = window.confirm('You have unsaved changes. Would you like to save them before exiting admin?');
      if (shouldSave) {
        const saved = await saveConfig();
        if (!saved) return;
      }
    }

    setView('store');
    setOrderSuccess(false);
  };

  // Toggle paid status in Firestore
  const handleTogglePaid = async (orderId, currentPaidStatus) => {
    try {
      const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_orders', orderId);
      await updateDoc(orderRef, {
        isPaid: !currentPaidStatus
      });
    } catch (err) {
      console.error("Error updating paid status:", err);
      setAdminError("Failed to update paid status.");
    }
  };

  const handleDeleteOrder = async (orderId) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_orders', orderId));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Error deleting order:", err);
      setAdminError("Failed to delete order.");
    }
  };

  const handleStartEdit = (order) => {
    setEditingOrderId(order.id);
    setEditFormData({ 
      name: order.name, 
      sizes: { ...order.sizes }, 
      brandRequest: order.brandRequest || '', 
      notes: order.notes || '' 
    });
  };

  const handleSaveEdit = async (orderId) => {
    try {
      const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_orders', orderId);
      const newTotalItems = SIZES.reduce((acc, size) => acc + (parseInt(editFormData.sizes[size]) || 0), 0);
      await updateDoc(orderRef, {
        name: editFormData.name,
        sizes: editFormData.sizes,
        brandRequest: editFormData.brandRequest,
        notes: editFormData.notes,
        totalItems: newTotalItems
      });
      setEditingOrderId(null);
      setEditFormData(null);
    } catch (err) {
      console.error("Error updating order:", err);
      setAdminError("Failed to update order.");
    }
  };

  // --- Admin Calculations ---
  
  // Group orders by design
  const ordersByDesign = useMemo(() => {
    const grouped = {};
    orders.forEach(order => {
      const designId = order.designId || 'unknown';
      if (!grouped[designId]) {
        grouped[designId] = [];
      }
      grouped[designId].push(order);
    });
    return grouped;
  }, [orders]);

  // Calculate totals per design
  const calculateDesignTotals = (designId) => {
    const designOrders = ordersByDesign[designId] || [];
    const totals = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
    let revenue = 0;
    
    designOrders.forEach(order => {
      SIZES.forEach(size => {
        if (order.sizes && order.sizes[size]) {
          totals[size] += order.sizes[size];
        }
      });
      revenue += (order.totalItems || 0) * (designs.find(d => d.id === designId)?.pricePerShirt || 0);
    });
    
    return {
      sizes: totals,
      revenue: revenue
    };
  };

  // Legacy: Overall totals (for backward compatibility)
  const sizeTotals = useMemo(() => {
    const totals = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
    orders.forEach(order => {
      SIZES.forEach(size => {
        if (order.sizes && order.sizes[size]) {
          totals[size] += order.sizes[size];
        }
      });
    });
    return totals;
  }, [orders]);

  // --- Render Helpers ---
  if (isLoadingAuth) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Connecting to secure server...</div>;
  }

  return (
    <>
      {/* MAIN UI CONTAINER
        The 'print:hidden' class guarantees nothing in this container will 
        be visible when the browser's print dialog opens.
      */}
      <div className="min-h-screen bg-gray-50 font-sans text-gray-800 selection:bg-indigo-100 flex flex-col relative print:hidden">
        
        {/* Lightbox Zoom Overlay */}
        {zoomedImage && (
          <div 
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" 
            onClick={() => setZoomedImage(null)}
          >
            <button 
              className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors bg-black/50 p-2 rounded-full"
              onClick={() => setZoomedImage(null)}
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={zoomedImage}
              alt="Zoomed product"
              className="max-w-full max-h-full object-contain cursor-zoom-out shadow-2xl"
              onClick={() => setZoomedImage(null)}
            />
          </div>
        )}

        {/* Image Editor Modal */}
        <ImageEditorModal
          isOpen={imageEditorModal.isOpen}
          onClose={handleCloseImageEditor}
          side={imageEditorModal.side}
          initialDesignImage={imageEditorModal.designId && imageEditorModal.side ?
            designs.find(d => d.id === imageEditorModal.designId)?.[imageEditorModal.side] : null}
          initialBackground={DEFAULT_TSHIRT_BACKGROUNDS[0].url}
          initialPosition={{ x: 50, y: 28 }}
          initialSize={45}
          tshirtBackgrounds={tshirtBackgrounds}
          onSave={handleSaveImageEditor}
          compositeImageWithTshirt={compositeImageWithTshirt}
          compressImage={compressImage}
        />

        {/* Background Editor Modal */}
        <BackgroundEditorModal
          isOpen={backgroundEditorModal.isOpen}
          onClose={handleCloseBackgroundEditor}
          onSave={handleSaveBackground}
          initialImage={backgroundEditorModal.image}
          imageName={backgroundEditorModal.imageName}
        />

        <main className="max-w-5xl mx-auto px-4 py-8 w-full flex-grow">
          
          {/* --- VIEW: STOREFRONT --- */}
          {view === 'store' && !isLoadingDesigns && designs.length === 0 && (
            <div className="max-w-2xl mx-auto text-center py-16">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8">
                <AlertCircle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">No Designs Available</h2>
                <p className="text-gray-600 mb-6">
                  The store is being set up. Please check back soon or contact the administrator.
                </p>
              </div>
            </div>
          )}
          
          {view === 'store' && designs.length > 0 && (
            <div className="space-y-8">
              {/* Page Title and Description */}
              {(globalConfig.pageTitle || globalConfig.pageDescription) && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  {globalConfig.pageTitle && (
                    <h1 className="text-3xl font-bold text-gray-900 mb-3">{globalConfig.pageTitle}</h1>
                  )}
                  {globalConfig.pageDescription && (
                    <div
                      className="text-gray-600 whitespace-pre-wrap [&_a]:text-indigo-600 [&_a]:underline hover:[&_a]:text-indigo-800"
                      dangerouslySetInnerHTML={{
                        __html: globalConfig.pageDescription
                      }}
                    />
                  )}
                </div>
              )}

              {designs.filter(design => design.status !== 'closed').map(design => {
                const isPreview = design.status === 'preview';
                return (
                <div key={design.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  {/* Title and Price */}
                  <div className="mb-4 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">{design.productHeader || design.name}</h1>
                    {isPreview ? (
                      <p className="text-lg text-yellow-600 font-semibold whitespace-nowrap ml-4">(Preview)</p>
                    ) : (
                      <p className="text-lg text-indigo-600 font-semibold whitespace-nowrap ml-4">${design.pricePerShirt.toFixed(2)} per shirt</p>
                    )}
                  </div>

                  {/* Description */}
                  {design.productDescription && (
                    <div className="mb-6">
                      <div
                        className="text-gray-600 whitespace-pre-wrap [&_a]:text-indigo-600 [&_a]:underline hover:[&_a]:text-indigo-800"
                        dangerouslySetInnerHTML={{
                          __html: design.productDescription
                        }}
                      />
                    </div>
                  )}

                  {/* Front and Back Images Side by Side */}
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    {/* Front Image */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Front</h3>
                      <div className="aspect-[4/5] bg-gray-50 rounded-lg flex items-center justify-center relative overflow-hidden group border border-gray-200">
                        {design.frontImage ? (
                          <>
                            <img
                              src={design.frontImage}
                              alt="Front view"
                              className="w-full h-full object-cover cursor-zoom-in group-hover:scale-[1.02] transition-transform duration-300"
                              onClick={() => setZoomedImage(design.frontImage)}
                            />
                            <button
                              onClick={() => setZoomedImage(design.frontImage)}
                              className="absolute bottom-2 right-2 bg-white/90 p-2 rounded-full shadow-md hover:bg-white transition-colors text-gray-700 hover:text-indigo-600 opacity-0 group-hover:opacity-100"
                              title="Zoom Image"
                            >
                              <ZoomIn className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <div className="text-gray-400 flex flex-col items-center">
                            <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
                            <span className="text-xs">No image</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Back Image */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Back</h3>
                      <div className="aspect-[4/5] bg-gray-50 rounded-lg flex items-center justify-center relative overflow-hidden group border border-gray-200">
                        {design.backImage ? (
                          <>
                            <img
                              src={design.backImage}
                              alt="Back view"
                              className="w-full h-full object-cover cursor-zoom-in group-hover:scale-[1.02] transition-transform duration-300"
                              onClick={() => setZoomedImage(design.backImage)}
                            />
                            <button
                              onClick={() => setZoomedImage(design.backImage)}
                              className="absolute bottom-2 right-2 bg-white/90 p-2 rounded-full shadow-md hover:bg-white transition-colors text-gray-700 hover:text-indigo-600 opacity-0 group-hover:opacity-100"
                              title="Zoom Image"
                            >
                              <ZoomIn className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <div className="text-gray-400 flex flex-col items-center">
                            <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
                            <span className="text-xs">No image</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Size Selection or Feedback Form */}
                  <div className="pt-6">
                    {isPreview ? (
                      // Feedback form for preview designs
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Share your feedback on this design:
                        </label>
                        <textarea
                          value={feedbackByDesign[design.id] || ''}
                          onChange={(e) => setFeedbackByDesign(prev => ({ ...prev, [design.id]: e.target.value }))}
                          placeholder="What do you think about this design? Any suggestions?"
                          disabled={submittedFeedback[design.id]}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none resize-y min-h-[100px] ${
                            submittedFeedback[design.id] ? 'bg-gray-50 cursor-not-allowed' : ''
                          }`}
                        />
                        <button
                          onClick={() => handleSubmitFeedback(design.id)}
                          disabled={submittingFeedback[design.id] || submittedFeedback[design.id]}
                          className={`w-full py-3 rounded-lg font-bold text-white transition-all ${
                            submittedFeedback[design.id]
                              ? 'bg-green-500 cursor-not-allowed'
                              : submittingFeedback[design.id]
                              ? 'bg-yellow-300 cursor-not-allowed'
                              : 'bg-yellow-600 hover:bg-yellow-700'
                          }`}
                        >
                          {submittedFeedback[design.id]
                            ? 'Thank you for your feedback!'
                            : submittingFeedback[design.id]
                            ? 'Submitting...'
                            : 'Submit Feedback'}
                        </button>
                      </div>
                    ) : (
                      // Size selection for open designs
                      <div className="grid grid-cols-5 gap-2">
                        {SIZES.map(size => {
                          const designSizes = sizesByDesign[design.id] || { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
                          return (
                            <div key={size} className="flex flex-col items-center">
                              <label className="text-xs font-bold text-gray-500 mb-1">{size}</label>
                              <input
                                type="number"
                                min="0"
                                value={designSizes[size] === 0 ? '' : designSizes[size]}
                                onChange={(e) => handleSizeChange(design.id, size, e.target.value)}
                                placeholder="0"
                                className="w-full text-center px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
              })}

              {/* Single Submit Order Button at Bottom */}
              {totalItems > 0 && (
                <div className="flex justify-center sticky bottom-4">
                  <button
                    onClick={() => {
                      setShowOrderModal(true);
                      setOrderSubmitted(false);
                      setOrderModalName('');
                      setOrderModalNotes('');
                    }}
                    className="py-3 px-6 rounded-lg font-bold text-white transition-all flex items-center gap-2 shadow-lg bg-indigo-600 hover:bg-indigo-700 hover:shadow-xl"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Submit Order ({totalItems} items - ${totalPrice.toFixed(2)})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Old single-design view - keeping for reference, will remove after multi-design ordering works */}
          {view === 'store' && false && selectedDesign && (
            <div className="grid md:grid-cols-2 gap-8 items-start">
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h1 className="text-3xl font-extrabold text-gray-900 mb-4">{selectedDesign.productHeader}</h1>
                  <div
                    className="text-gray-600 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: selectedDesign.productDescription || ""
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* --- VIEW: ADMIN LOGIN --- */}
          {view === 'adminLogin' && (
            <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mt-12">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Admin Access</h2>
                <p className="text-gray-500 text-sm mt-1">Enter the password to view orders.</p>
              </div>
              
              <form onSubmit={handleAdminLogin} className="space-y-4">
                {adminError && <p className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">{adminError}</p>}
                <div>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-center tracking-widest"
                    placeholder="Password"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-medium transition-colors"
                >
                  Access Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView('store');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full py-2 text-gray-500 hover:text-gray-800 text-sm flex items-center justify-center gap-1 mt-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Store
                </button>
              </form>
            </div>
          )}

          {/* --- VIEW: ADMIN DASHBOARD --- */}
          {view === 'adminDashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                  <p className="text-gray-500">Manage your store settings and view orders.</p>
                </div>
              </div>


              {/* --- Global Settings Section --- */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Global Settings</h2>
                <p className="text-sm text-gray-600 mb-4">These settings apply to all designs.</p>
                
                <form onSubmit={handleSaveConfig} className="space-y-4">
                  {/* Page Title and Description */}
                  <div className="pb-4 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Page Information</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Page Title</label>
                        <input
                          type="text"
                          value={configForm.pageTitle}
                          onChange={e => setConfigForm({...configForm, pageTitle: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          placeholder="Enter page title"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Page Description</label>
                        <textarea
                          value={configForm.pageDescription}
                          onChange={e => setConfigForm({...configForm, pageDescription: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          placeholder="Enter page description (optional)"
                          rows="3"
                        />
                      </div>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 mb-3">Payment Information</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Venmo Username <span className="text-gray-400 font-normal">(without @)</span></label>
                        <input
                          type="text"
                          value={configForm.venmoUsername}
                          onChange={e => setConfigForm({...configForm, venmoUsername: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cash App Cashtag <span className="text-gray-400 font-normal">(without $)</span></label>
                        <input
                          type="text"
                          value={configForm.cashappUsername}
                          onChange={e => setConfigForm({...configForm, cashappUsername: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </div>

                    </div>

                    {/* EmailJS Settings */}
                    <div className="pt-4 border-t border-gray-100">
                      <h3 className="text-sm font-bold text-gray-900 mb-3">Email Notifications (EmailJS)</h3>
                                            <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notification Email <span className="text-gray-400 font-normal">(Where alerts go)</span></label>
                        <input
                          type="email"
                          value={configForm.notificationEmail}
                          onChange={e => setConfigForm({...configForm, notificationEmail: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          placeholder="you@example.com"
                        />
                      </div>
                      <div className="grid md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Service ID</label>
                          <input
                            type="text"
                            value={configForm.emailjsServiceId}
                            onChange={e => setConfigForm({...configForm, emailjsServiceId: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            placeholder="service_xxx"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Order Template ID</label>
                          <input
                            type="text"
                            value={configForm.emailjsTemplateId}
                            onChange={e => setConfigForm({...configForm, emailjsTemplateId: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            placeholder="template_xxx"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Public Key</label>
                          <input
                            type="text"
                            value={configForm.emailjsPublicKey}
                            onChange={e => setConfigForm({...configForm, emailjsPublicKey: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            placeholder="Public Key"
                          />
                        </div>
                      </div>
                    </div>

                    {/* T-shirt Background Library Management */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h3 className="text-sm font-bold text-gray-900 mb-3">T-shirt Background Library</h3>
                      <p className="text-xs text-gray-500 mb-3">Upload t-shirt background images to use when compositing designs. These will be available for both front and back images.</p>
                      
                      {/* Solid Color Backgrounds - Quarter Size, Single Row */}
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Solid Colors</p>
                        <div className="flex flex-wrap gap-2">
                          {tshirtBackgrounds.filter(bg => bg.color).map(bg => (
                            <div key={bg.id} className="relative group">
                              <div className="w-12 h-12 rounded border-2 border-gray-300 overflow-hidden">
                                <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                              </div>
                              <p className="text-[10px] text-gray-600 mt-0.5 text-center truncate w-12">{bg.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Custom/Graphical Backgrounds - Half Size Grid */}
                      {tshirtBackgrounds.filter(bg => !bg.color).length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-2">Custom Backgrounds</p>
                          <div className="grid grid-cols-6 md:grid-cols-8 gap-2 mb-3">
                            {tshirtBackgrounds.filter(bg => !bg.color).map(bg => (
                              <div key={bg.id} className="relative group">
                                <div className="aspect-square rounded border-2 border-gray-300 overflow-hidden">
                                  <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                                </div>
                                <p className="text-[10px] text-gray-600 mt-0.5 truncate">{bg.name}</p>
                                {bg.id.startsWith('custom-') && (
                                  <button
                                    onClick={() => handleDeleteTshirtBg(bg.id)}
                                    className="absolute top-0.5 right-0.5 bg-red-500 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors text-sm font-medium border border-gray-300">
                        <Upload className="w-4 h-4" />
                        <span>Add T-shirt Background</span>
                        <input
                          type="file"
                          accept="image/jpeg, image/png"
                          className="hidden"
                          onChange={handleTshirtBgUpload}
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                    >
                      Save Global Settings
                    </button>
                  </form>
              </div>

              {/* Orders & Shirt Designs Section */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Shirt Designs</h2>
                <button
                  onClick={handleCreateDesign}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create New Design
                </button>
              </div>

              {/* Design Cards */}
              {designs.map(design => {
                const designOrders = ordersByDesign[design.id] || [];
                const designTotals = calculateDesignTotals(design.id);
                const isCollapsed = collapsedDesigns[design.id] !== false; // Default to collapsed
                
                return (
                  <div key={design.id} className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
                    {/* Collapsible Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleDesignCollapse(design.id)}
                    >
                      <div className="flex items-center gap-3">
                        {isCollapsed ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronUp className="w-5 h-5 text-gray-400" />}
                        <h3 className="text-lg font-bold text-gray-900">{design.name}</h3>
                        <span className="text-sm text-gray-500">({designOrders.length} orders)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Reorder buttons */}
                        <div className="flex items-center gap-1 mr-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveDesign(design.id, 'up');
                            }}
                            disabled={designs.findIndex(d => d.id === design.id) === 0}
                            className={`p-1.5 rounded transition-colors ${
                              designs.findIndex(d => d.id === design.id) === 0
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                            }`}
                            title="Move Up"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveDesign(design.id, 'down');
                            }}
                            disabled={designs.findIndex(d => d.id === design.id) === designs.length - 1}
                            className={`p-1.5 rounded transition-colors ${
                              designs.findIndex(d => d.id === design.id) === designs.length - 1
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                            }`}
                            title="Move Down"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Status Dropdown */}
                        <select
                          value={design.status || 'open'}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleChangeDesignStatus(design.id, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`px-3 py-1.5 text-sm font-medium rounded-lg border-2 transition-colors cursor-pointer ${
                            design.status === 'preview'
                              ? 'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100'
                              : design.status === 'closed'
                              ? 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                              : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                          }`}
                          title="Change Design Status"
                        >
                          <option value="preview">Preview</option>
                          <option value="open">Open</option>
                          <option value="closed">Closed</option>
                        </select>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDesign(design.id);
                          }}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Design"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {!isCollapsed && (
                      <div className="p-6 pt-0 border-t border-gray-100">
                        {/* Editable Design Fields */}
                        <div className="space-y-4 mb-6">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Design Name</label>
                              <input
                                type="text"
                                value={designEdits[design.id]?.name ?? design.name}
                                onChange={e => {
                                  handleUpdateDesignField(design.id, 'name', e.target.value);
                                  handleUpdateDesignField(design.id, 'productHeader', e.target.value);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Price Per Shirt ($)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={designEdits[design.id]?.pricePerShirt ?? design.pricePerShirt}
                                onChange={e => handleUpdateDesignField(design.id, 'pricePerShirt', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                              value={designEdits[design.id]?.productDescription ?? design.productDescription}
                              onChange={e => handleUpdateDesignField(design.id, 'productDescription', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y min-h-[80px]"
                            />
                          </div>
                        </div>
                    
                    {/* Shirt Design Previews - 50% smaller */}
                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                      {/* Front Image Preview */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Front Image</label>
                        <div className="w-full max-w-[200px] mx-auto">
                          <div className="relative group aspect-[4/5] bg-gray-100 rounded-lg border-2 border-gray-300 flex items-center justify-center overflow-hidden shadow-sm">
                            {design.frontImage ? (
                              <img src={design.frontImage} alt="front" className="w-full h-full object-contain" />
                            ) : (
                              <ImageIcon className="w-12 h-12 text-gray-400" />
                            )}
                            <button
                              onClick={() => handleOpenImageEditor('frontImage', design.id)}
                              className="absolute top-2 right-2 p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100"
                              title="Modify Front Image"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {design.frontImage && (
                              <button
                                onClick={() => setZoomedImage(design.frontImage)}
                                className="absolute bottom-2 right-2 p-1.5 bg-white/90 text-gray-700 rounded-full hover:bg-white hover:text-indigo-600 transition-colors shadow-md opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                title="Zoom Image"
                              >
                                <ZoomIn className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Back Image Preview */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Back Image</label>
                        <div className="w-full max-w-[200px] mx-auto">
                          <div className="relative group aspect-[4/5] bg-gray-100 rounded-lg border-2 border-gray-300 flex items-center justify-center overflow-hidden shadow-sm">
                            {design.backImage ? (
                              <img src={design.backImage} alt="back" className="w-full h-full object-contain" />
                            ) : (
                              <ImageIcon className="w-12 h-12 text-gray-400" />
                            )}
                            <button
                              onClick={() => handleOpenImageEditor('backImage', design.id)}
                              className="absolute top-2 right-2 p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100"
                              title="Modify Back Image"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {design.backImage && (
                              <button
                                onClick={() => setZoomedImage(design.backImage)}
                                className="absolute bottom-2 right-2 p-1.5 bg-white/90 text-gray-700 rounded-full hover:bg-white hover:text-indigo-600 transition-colors shadow-md opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                title="Zoom Image"
                              >
                                <ZoomIn className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Totals Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-6">
                      {SIZES.map(size => (
                        <div key={size} className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex flex-col items-center justify-center">
                          <span className="text-gray-500 text-xs font-bold mb-1">SIZE {size}</span>
                          <span className="text-2xl font-extrabold text-indigo-600">{designTotals.sizes[size]}</span>
                        </div>
                      ))}
                      {/* Total Revenue */}
                      <div className="bg-green-50 p-3 rounded-lg border border-green-200 flex flex-col items-center justify-center">
                        <span className="text-green-700 text-xs font-bold mb-1">REVENUE</span>
                        <span className="text-2xl font-extrabold text-green-600">
                          ${designTotals.revenue.toFixed(2)}
                        </span>
                      </div>
                      {/* Print Labels Button */}
                      <div className="bg-gray-900 p-3 rounded-lg border border-gray-800 flex items-center justify-center">
                        <button
                          onClick={() => window.print()}
                          className="text-white font-medium transition-colors flex items-center gap-2 text-xs hover:text-gray-200"
                          title="Print Packaging Labels"
                        >
                          <Printer className="w-4 h-4" />
                          <span className="hidden lg:inline">Print</span>
                        </button>
                      </div>
                    </div>

                    {/* Orders Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-gray-600">
                        <thead className="bg-gray-50 text-gray-700 border-b border-gray-200 font-semibold uppercase text-xs">
                          <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-4 py-4 text-center border-l border-gray-200 bg-gray-50/50">S</th>
                            <th className="px-4 py-4 text-center bg-gray-50/50">M</th>
                            <th className="px-4 py-4 text-center bg-gray-50/50">L</th>
                            <th className="px-4 py-4 text-center bg-gray-50/50">XL</th>
                            <th className="px-4 py-4 text-center border-r border-gray-200 bg-gray-50/50">XXL</th>
                            <th className="px-6 py-4">Notes</th>
                            <th className="px-6 py-4 text-right">Items</th>
                            <th className="px-6 py-4 text-center border-l border-gray-200">Paid</th>
                            <th className="px-6 py-4 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {designOrders.length === 0 ? (
                            <tr>
                              <td colSpan="12" className="px-6 py-12 text-center text-gray-500 text-base">
                                No orders have been placed for this design yet.
                              </td>
                            </tr>
                          ) : (
                            designOrders.map((order) => {
                          const isEditing = editingOrderId === order.id;
                          return (
                          <tr 
                            key={order.id} 
                            className={`transition-colors ${order.isPaid ? 'bg-green-50/30' : 'hover:bg-gray-50/50'}`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                              {new Date(order.timestamp).toLocaleDateString()} <br/>
                              {new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </td>
                            <td className="px-6 py-4 font-medium text-gray-900">
                              {isEditing ? (
                                <input 
                                  type="text" 
                                  value={editFormData.name} 
                                  onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                                  className="w-full px-2 py-1 border border-indigo-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              ) : order.name}
                            </td>
                            
                            {SIZES.map(size => (
                              <td key={size} className={`px-2 py-4 text-center ${size === 'S' ? 'border-l border-gray-100' : ''} ${size === 'XXL' ? 'border-r border-gray-100' : ''} ${order.sizes?.[size] > 0 ? 'font-bold text-indigo-600 bg-indigo-50/20' : 'text-gray-300'}`}>
                                {isEditing ? (
                                  <input 
                                    type="number" 
                                    min="0"
                                    value={editFormData.sizes[size] === 0 ? '' : editFormData.sizes[size]} 
                                    onChange={e => setEditFormData({
                                      ...editFormData, 
                                      sizes: { ...editFormData.sizes, [size]: Math.max(0, parseInt(e.target.value) || 0) }
                                    })}
                                    className="w-10 px-1 py-1 border border-indigo-300 rounded text-center text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    placeholder="0"
                                  />
                                ) : (order.sizes?.[size] || 0)}
                              </td>
                            ))}
                            
                            <td className="px-6 py-4 text-gray-600 text-xs max-w-[150px]">
                              {isEditing ? (
                                <input 
                                  type="text" 
                                  value={editFormData.notes} 
                                  onChange={e => setEditFormData({...editFormData, notes: e.target.value})}
                                  className="w-full px-2 py-1 border border-indigo-300 rounded text-sm focus:outline-none"
                                />
                              ) : (
                                <div className="truncate" title={order.notes}>{order.notes || '-'}</div>
                              )}
                            </td>
                            
                            <td className="px-6 py-4 text-right font-bold text-gray-900">
                              {isEditing ? SIZES.reduce((acc, size) => acc + (parseInt(editFormData.sizes[size]) || 0), 0) : order.totalItems}
                            </td>
                            
                            <td className="px-6 py-4 text-center border-l border-gray-100">
                              <input
                                type="checkbox"
                                checked={!!order.isPaid}
                                onChange={() => handleTogglePaid(order.id, !!order.isPaid)}
                                disabled={isEditing}
                                className="w-5 h-5 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 cursor-pointer disabled:opacity-50"
                                title={order.isPaid ? "Mark as unpaid" : "Mark as paid"}
                              />
                            </td>

                            <td className="px-6 py-4 text-center">
                              {deleteConfirmId === order.id ? (
                                <div className="flex items-center justify-center gap-2 flex-col">
                                  <span className="text-xs text-red-600 font-bold">Delete?</span>
                                  <div className="flex gap-2">
                                    <button onClick={() => handleDeleteOrder(order.id)} className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors">Yes</button>
                                    <button onClick={() => setDeleteConfirmId(null)} className="px-2 py-1 bg-gray-200 text-gray-800 text-xs rounded hover:bg-gray-300 transition-colors">No</button>
                                  </div>
                                </div>
                              ) : isEditing ? (
                                <div className="flex items-center justify-center gap-3">
                                  <button onClick={() => handleSaveEdit(order.id)} className="text-green-600 hover:text-green-800 transition-colors" title="Save Changes">
                                    <Save className="w-5 h-5" />
                                  </button>
                                  <button onClick={() => { setEditingOrderId(null); setEditFormData(null); }} className="text-gray-400 hover:text-gray-600 transition-colors" title="Cancel">
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-3">
                                  <button onClick={() => handleStartEdit(order)} className="text-indigo-500 hover:text-indigo-800 transition-colors" title="Edit Order">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setDeleteConfirmId(order.id)} className="text-red-400 hover:text-red-600 transition-colors" title="Delete Order">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                            )})
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Feedback Section */}
                    {(() => {
                      const designFeedback = feedbackList.filter(f => f.designId === design.id);
                      if (designFeedback.length === 0) return null;
                      
                      return (
                        <div className="mt-8">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Feedback ({designFeedback.length})
                          </label>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-600">
                              <thead className="bg-gray-50 text-gray-700 border-b border-gray-200 font-semibold uppercase text-xs">
                                <tr>
                                  <th className="px-6 py-4 text-left w-32">Date</th>
                                  <th className="px-6 py-4 text-left">Feedback</th>
                                  <th className="px-6 py-4 text-right w-24">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {designFeedback.map(feedback => (
                                  <tr key={feedback.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 w-32">
                                      {new Date(feedback.timestamp).toLocaleDateString()} <br/>
                                      {new Date(feedback.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </td>
                                    <td className="px-6 py-4 text-gray-700">
                                      <div className="whitespace-pre-wrap">{feedback.feedback}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <button
                                        onClick={() => {
                                          if (window.confirm('Delete this feedback?')) {
                                            handleDeleteFeedback(feedback.id);
                                          }
                                        }}
                                        className="text-red-400 hover:text-red-600 transition-colors inline-block"
                                        title="Delete Feedback"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}

              <div className="flex justify-center gap-4 pt-2">
                <button
                  onClick={async () => {
                    // Discard all pending design edits
                    setDesignEdits({});
                    setView('store');
                    setOrderSuccess(false);
                  }}
                  className="flex-1 max-w-xs py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    // Save global config if changed
                    if (hasUnsavedConfigChanges) {
                      const saved = await saveConfig();
                      if (!saved) return;
                    }
                    // Save all design edits
                    const designsSaved = await saveAllDesignEdits();
                    if (!designsSaved) return;
                    
                    setView('store');
                    setOrderSuccess(false);
                  }}
                  className="flex-1 max-w-xs py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save and Exit
                </button>
              </div>

            </div>
          )}

        </main>

        {/* Footer / Admin Trigger */}
        <footer className="mt-auto py-8 text-center flex justify-center">
          {view === 'store' && (
            <button 
              onClick={() => setView('adminLogin')}
              className="text-gray-300 hover:text-gray-500 transition-colors p-2"
              title="Admin Dashboard Login"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}
        </footer>
      </div>

      {/* PRINT UI CONTAINER
        This entirely separate structure is heavily styled to only show up on printer paper. 
        It divides the items into 48% height blocks so exactly 2 fit per page without overflowing. 
      */}
      <div className="hidden print:block w-full bg-white text-black font-sans">
        {orders.length === 0 ? (
          <div className="p-12 text-center text-xl">No orders to print.</div>
        ) : (
          orders.map((order) => (
            <div 
              key={order.id} 
              className="h-[48vh] w-full border-b-2 border-dashed border-gray-400 flex flex-row items-center p-12 box-border" 
              style={{ pageBreakInside: 'avoid' }}
            >
              {/* Left Side: Name and Total Quantity */}
              <div className="w-1/2 pr-8 flex flex-col justify-center border-r-2 border-gray-200 h-full">
                <h2 className="text-5xl font-extrabold mb-6 text-black leading-tight break-words">{order.name}</h2>
                <div className="text-3xl font-medium text-gray-600">
                  Total Items: <span className="font-bold text-black">{order.totalItems}</span>
                </div>
              </div>

              {/* Right Side: Sizes and Notes */}
              <div className="w-1/2 pl-8 flex flex-col justify-center h-full">
                <div className="flex flex-wrap gap-6">
                  {SIZES.map(size => order.sizes?.[size] > 0 ? (
                    <div key={size} className="flex flex-col items-center border-2 border-black rounded-lg p-4 min-w-[100px]">
                      <span className="text-2xl font-bold text-gray-500 border-b-2 border-black w-full text-center pb-2 mb-2">{size}</span>
                      <span className="text-5xl font-black">{order.sizes[size]}</span>
                    </div>
                  ) : null)}
                </div>
                {order.notes && (
                  <div className="mt-8 text-xl text-gray-700 italic border-l-4 border-gray-400 pl-4 py-2">
                    <span className="font-bold not-italic block mb-1">Notes:</span>
                    "{order.notes}"
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Order Submission Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {orderSubmitted ? 'Order Confirmed!' : 'Review Your Order'}
                </h2>
                <button
                  onClick={handleCloseOrderModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Order Summary */}
              <div className="mb-6 space-y-3">
                <h3 className="font-semibold text-gray-700 mb-3">Order Summary:</h3>
                {Object.entries(sizesByDesign).map(([designId, designSizes]) => {
                  const design = designs.find(d => d.id === designId);
                  if (!design) return null;
                  
                  const totalItemsForDesign = Object.values(designSizes).reduce((sum, qty) => sum + qty, 0);
                  if (totalItemsForDesign === 0) return null;
                  
                  const sizesText = SIZES
                    .filter(size => designSizes[size] > 0)
                    .map(size => `${size}: ${designSizes[size]}`)
                    .join(', ');
                  
                  return (
                    <div key={designId} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{design.name}</p>
                        <p className="text-sm text-gray-600">{sizesText}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-semibold text-gray-900">${(totalItemsForDesign * design.pricePerShirt).toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{totalItemsForDesign} × ${design.pricePerShirt.toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
                
                {/* Total */}
                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
                  <p className="text-lg font-bold text-gray-900">Total:</p>
                  <p className="text-xl font-bold text-indigo-600">${totalPrice.toFixed(2)}</p>
                </div>
              </div>

              {!orderSubmitted ? (
                <>
                  {/* Name Field */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={orderModalName}
                      onChange={(e) => setOrderModalName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="Enter your name"
                      required
                    />
                  </div>

                  {/* Notes Field */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes <span className="text-gray-400">(optional)</span>
                    </label>
                    <textarea
                      value={orderModalNotes}
                      onChange={(e) => setOrderModalNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y min-h-[80px]"
                      placeholder="Any special requests or notes..."
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmitMultiDesignOrder}
                    disabled={isSubmitting || !orderModalName.trim()}
                    className={`w-full py-3 rounded-lg font-bold text-white transition-all flex items-center justify-center gap-2 ${
                      isSubmitting || !orderModalName.trim()
                        ? 'bg-indigo-300 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Submit Order
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  {/* Order Confirmed - Show read-only info */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">
                      {orderModalName}
                    </div>
                  </div>

                  {orderModalNotes && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 whitespace-pre-wrap">
                        {orderModalNotes}
                      </div>
                    </div>
                  )}

                  {/* Payment Instructions */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-green-900 mb-2">Thank you for your order!</p>
                        <p className="text-sm text-green-800 mb-3">Please submit payment via:</p>
                        <div className="space-y-2 text-sm">
                          {globalConfig.venmoUsername && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-green-900">Venmo:</span>
                              <a
                                href={`https://venmo.com/${globalConfig.venmoUsername}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-800 hover:text-green-600 underline font-medium"
                              >
                                @{globalConfig.venmoUsername}
                              </a>
                            </div>
                          )}
                          {globalConfig.cashappUsername && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-green-900">Cash App:</span>
                              <a
                                href={`https://cash.app/$${globalConfig.cashappUsername}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-800 hover:text-green-600 underline font-medium"
                              >
                                ${globalConfig.cashappUsername}
                              </a>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-green-900">Cash:</span>
                            <span className="text-green-800">In person</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={handleCloseOrderModal}
                    className="w-full py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold transition-colors"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}