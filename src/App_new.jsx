
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
  RefreshCw
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
  getDoc
} from 'firebase/firestore';
import { 
  migrateToDesignStructure, 
  checkMigrationStatus 
} from './migrationUtils';


// --- Firebase Initialization ---
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
  { id: 'white', name: 'White', color: '#FFFFFF', url: generateSolidColorBackground('#FFFFFF') },
  { id: 'black', name: 'Black', color: '#000000', url: generateSolidColorBackground('#000000') },
  { id: 'gray', name: 'Gray', color: '#808080', url: generateSolidColorBackground('#808080') },
  { id: 'navy', name: 'Navy', color: '#001F3F', url: generateSolidColorBackground('#001F3F') },
  { id: 'red', name: 'Red', color: '#DC143C', url: generateSolidColorBackground('#DC143C') },
  { id: 'maroon', name: 'Maroon', color: '#800000', url: generateSolidColorBackground('#800000') },
  { id: 'green', name: 'Forest Green', color: '#228B22', url: generateSolidColorBackground('#228B22') },
  { id: 'royal', name: 'Royal Blue', color: '#4169E1', url: generateSolidColorBackground('#4169E1') },
  { id: 'purple', name: 'Purple', color: '#800080', url: generateSolidColorBackground('#800080') },
  { id: 'orange', name: 'Orange', color: '#FF8C00', url: generateSolidColorBackground('#FF8C00') },
  { id: 'brown', name: 'Brown', color: '#8B4513', url: generateSolidColorBackground('#8B4513') },
  { id: 'pink', name: 'Pink', color: '#FF69B4', url: generateSolidColorBackground('#FF69B4') },
  { id: 'yellow', name: 'Gold', color: '#FFD700', url: generateSolidColorBackground('#FFD700') },
  { id: 'lightblue', name: 'Light Blue', color: '#87CEEB', url: generateSolidColorBackground('#87CEEB') }
];

// --- Helper: Compress Image to Base64 ---
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
        
        const isPNG = file.type === 'image/png';
        const format = isPNG ? 'image/png' : 'image/jpeg';
        const quality = isPNG ? 0.95 : 0.8;
        
        resolve(canvas.toDataURL(format, quality));
      };
    };
  });
};

// Composite design image on top of t-shirt background
const compositeImageWithTshirt = (designImage, tshirtBackgroundUrl, position = { x: 50, y: 28 }, sizePercent = 45) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false });
    
    const tshirtImg = new window.Image();
    tshirtImg.crossOrigin = 'anonymous';
    tshirtImg.src = tshirtBackgroundUrl;
    
    tshirtImg.onload = () => {
      ctx.drawImage(tshirtImg, 0, 0, canvas.width, canvas.height);
      
      const designImg = new window.Image();
      designImg.crossOrigin = 'anonymous';
      designImg.src = designImage;
      
      designImg.onload = () => {
        const maxDesignWidth = canvas.width * (sizePercent / 100);
        let designWidth = maxDesignWidth;
        let designHeight = (designImg.height / designImg.width) * designWidth;
        
        const x = (canvas.width * (position.x / 100)) - (designWidth / 2);
        const y = (canvas.height * (position.y / 100));
        
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(designImg, x, y, designWidth, designHeight);
        ctx.restore();
        
        try {
          resolve(canvas.toDataURL('image/png', 1.0));
        } catch (err) {
          reject(new Error('Failed to export composite image: ' + err.message));
        }
      };
      
      designImg.onerror = (err) => reject(new Error('Failed to load design image: ' + err));
    };
    
    tshirtImg.onerror = (err) => reject(new Error('Failed to load t-shirt template: ' + err));
  });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('store');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Global Configuration State
  const [globalConfig, setGlobalConfig] = useState({
    pageTitle: 'Austin Velocity 161 Diamond Team Shirt - Order form',
    venmoUsername: 'ekzoss',
    cashappUsername: 'KandiZoss',
    notificationEmail: '',
    emailjsServiceId: '',
    emailjsTemplateId: '',
    emailjsPublicKey: ''
  });
  const [configForm, setConfigForm] = useState({ ...globalConfig });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Design Management State
  const [designs, setDesigns] = useState([]);
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

  // Image Editor State
  const [activeTab, setActiveTab] = useState('front');
  const [zoomedImage, setZoomedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const [imageEditorModal, setImageEditorModal] = useState({
    isOpen: false,
    side: null,
    designId: null
  });
  
  const [backgroundEditorModal, setBackgroundEditorModal] = useState({
    isOpen: false,
    image: null,
    imageName: ''
  });
  
  // T-shirt background state
  const [tshirtBackgrounds, setTshirtBackgrounds] = useState(DEFAULT_TSHIRT_BACKGROUNDS);

  // Form State
  const [name, setName] = useState('');
  const [sizes, setSizes] = useState({ S: 0, M: 0, L: 0, XL: 0, XXL: 0 });
  const [brandRequest, setBrandRequest] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrder, setLastOrder] = useState(null); 
  const [error, setError] = useState('');

  // Admin State
  const [passwordInput, setPasswordInput] = useState('');
  const [adminError, setAdminError] = useState('');
  const [orders, setOrders] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Migration State
  const [migrationStatus, setMigrationStatus] = useState({ checked: false, migrated: false });
  const [isMigrating, setIsMigrating] = useState(false);

  // --- 1. Authentication ---
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

    const checkAndFetchData = async () => {
      const status = await checkMigrationStatus(db, appId);
      setMigrationStatus({ checked: true, migrated: status.migrated });
    };

    checkAndFetchData();

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

    // Fetch Global Config
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_config', 'main');
    const unsubscribeConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const config = {
          pageTitle: data.pageTitle || 'Austin Velocity 161 Diamond Team Shirt - Order form',
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
      fetchedDesigns.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setDesigns(fetchedDesigns);
      
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

  // --- 3. Fetch Orders (Admin Only) ---
  useEffect(() => {
    if (!user || view !== 'adminDashboard') return;

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

    return () => unsubscribeOrders();
  }, [user, view]);

  // --- Get Selected Design ---
  const selectedDesign = useMemo(() => {
    return designs.find(d => d.id === selectedDesignId) || null;
  }, [designs, selectedDesignId]);

  // --- Actions ---

  const normalizedSavedConfig = useMemo(() => ({
    pageTitle: globalConfig.pageTitle,
    venmoUsername: globalConfig.venmoUsername,
    cashappUsername: globalConfig.cashappUsername,
    notificationEmail: globalConfig.notificationEmail,
    emailjsServiceId: globalConfig.emailjsServiceId,
    emailjsTemplateId: globalConfig.emailjsTemplateId,
    emailjsPublicKey: globalConfig.emailjsPublicKey
  }), [globalConfig]);

  const hasUnsavedConfigChanges = JSON.stringify(configForm) !== JSON.stringify(normalizedSavedConfig);

  const saveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_config', 'main');
      await setDoc(configRef, configForm, { merge: true });
      alert("Global settings updated successfully!");
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

  const handleRunMigration = async () => {
    if (!window.confirm('This will migrate your existing data to the new design structure. Continue?')) {
      return;
    }

    setIsMigrating(true);
    try {
      const result = await migrateToDesignStructure(db, appId);
      if (result.success) {
        alert(`Migration successful!\n- Design created: ${result.designCreated}\n- Orders updated: ${result.ordersUpdated}`);
        setMigrationStatus({ checked: true, migrated: true });
      } else {
        alert(`Migration failed: ${result.errors.join(', ')}`);
      }
    } catch (err) {
      console.error('Migration error:', err);
      alert('Migration failed: ' + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleCreateDesign = async () => {
    if (!newDesignForm.name.trim()) {
      alert('Please enter a design name');
      return;
    }

    try {
      const designsRef = collection(db, 'artifacts', appId, 'public', 'data', 'designs');
      const newDesign = {
        name: newDesignForm.name.trim(),
        productHeader: newDesignForm.productHeader.trim() || newDesignForm.name.trim(),
        productDescription: newDesignForm.productDescription.trim(),
        pricePerShirt: newDesignForm.pricePerShirt,
        frontImage: null,
        backImage: null,
        status: 'open',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const docRef = await addDoc(designsRef, newDesign);
      setSelectedDesignId(docRef.id);
      setIsCreatingDesign(false);
      setNewDesignForm({
        name: '',
        productHeader: '',
        productDescription: '',
        pricePerShirt: 7.50
      });
      alert('Design created successfully!');
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
      alert('Design updated successfully!');
    } catch (err) {
      console.error('Error updating design:', err);
      alert('Failed to update design');
    }
  };

  const handleDeleteDesign = async (designId) => {
    const designOrders = orders.filter(o => o.designId === designId);
    if (designOrders.length > 0) {
      if (!window.confirm(`This design has ${designOrders.length} orders. Are you sure you want to delete it?`)) {
        return;
      }
    }

    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'designs', designId));
      if (selectedDesignId === designId) {
        setSelectedDesignId(designs.find(d => d.id !== designId)?.id || null);
      }
      alert('Design deleted successfully!');
    } catch (err) {
      console.error('Error deleting design:', err);
      alert('Failed to delete design');
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
    const { previewImage: newPreviewImage } = data;
    const side = imageEditorModal.side;
    const designId = imageEditorModal.designId;
    
    if (!side || !designId) {
      throw new Error("No side or design specified");
    }
    
    try {
      const designRef = doc(db, 'artifacts', appId, 'public', 'data', 'designs', designId);
      await updateDoc(designRef, { 
        [side]: newPreviewImage,
        updatedAt: Date.now()
      });
      
      console.log('Design image updated successfully');
    } catch (err) {
      console.error('Error in handleSaveImageEditor:', err);
      throw err;
    }
  };
  
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
      
      const bgLibraryRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_config', 'backgrounds');
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
      
      const bgLibraryRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_config', 'backgrounds');
      await setDoc(bgLibraryRef, { library: updatedBackgrounds }, { merge: true });
    }
  };

  // --- Order Actions ---

  const handleSizeChange = (size, value) => {
    const numValue = parseInt(value, 10) || 0;
    setSizes(prev => ({ ...prev, [size]: Math.max(0, numValue) }));
  };

  const totalItems = useMemo(() => {
    return Object.values(sizes).reduce((acc, curr) => acc + curr, 0);
  }, [sizes]);

  const pricePerShirt = selectedDesign?.pricePerShirt || 7.50;
  const totalPrice = totalItems * pricePerShirt;

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError("Please wait for the system to connect.");
      return;
    }

    if (!selectedDesignId) {
      setError("No design selected. Please contact the administrator.");
      return;
    }

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (totalItems === 0) {
      setError("Please select at least one t-shirt.");
      return;
    }

    setIsSubmitting(true);
    try {
      const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'tshirt_orders');
      await addDoc(ordersRef, {
        designId: selectedDesignId,
        name: name.trim(),
        sizes,
        brandRequest: brandRequest.trim(),
        notes: notes.trim(),
        isPaid: false,
        totalItems,
        timestamp: Date.now(),
        userId: user.uid
      });
      
      // Email notification
      if (globalConfig.emailjsServiceId && globalConfig.emailjsTemplateId && globalConfig.emailjsPublicKey) {
        try {
          await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              service_id: globalConfig.emailjsServiceId,
              template_id: globalConfig.emailjsTemplateId,
              user_id: globalConfig.emailjsPublicKey,
              template_params: {
                to_email: globalConfig.notificationEmail,
                customer_name: name.trim(),
                total_items: totalItems,
                total_price: totalPrice.toFixed(2),
                notes: notes.trim() || 'None',
                design_name: selectedDesign?.name || 'Unknown'
              }
            })
          });
        } catch (emailErr) {
          console.error("Failed to send EmailJS notification:", emailErr);
        }
      }
      
      setLastOrder({
        name: name.trim(),
        totalItems,
        totalPrice
      });
      
      setOrderSuccess(true);
      
      // Reset form
      setName('');
      setSizes({ S: 0, M: 0, L: 0, XL: 0, XXL: 0 });
      setBrandRequest('');
      setNotes('');
    } catch (err) {
      console.error("Order error:", err);
      setError("Failed to submit order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // --- Render Helpers ---
  if (isLoadingAuth) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Connecting to secure server...</div>;
  }

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
  const calculateDesignTotals = (designOrders) => {
    const totals = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
    designOrders.forEach(order => {
      SIZES.forEach(size => {
        if (order.sizes && order.sizes[size]) {
          totals[size] += order.sizes[size];
        }
      });
    });
    return totals;
  };

  return (
    <>
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
              onClick={(e) => e.stopPropagation()}
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
          {view === 'store' && selectedDesign && (
            <div className="grid md:grid-cols-2 gap-8 items-start">
              
              {/* Left Col: Product Info */}
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h1 className="text-3xl font-extrabold text-gray-900 mb-4">{selectedDesign.productHeader}</h1>
                  
                  <div
                    className="text-gray-600 whitespace-pre-wrap [&_a]:text-indigo-600 [&_a]:underline hover:[&_a]:text-indigo-800"
                    dangerouslySetInnerHTML={{
                      __html: selectedDesign.productDescription || ""
                    }}
                  />
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Preview</h2>
                  
                  <div className="aspect-[4/5] bg-gray-50 rounded-xl flex items-center justify-center relative overflow-hidden group border border-gray-200 shadow-inner">
                    {selectedDesign[`${activeTab}Image`] ? (
                      <>
                        <img
                          src={selectedDesign[`${activeTab}Image`]}
                          alt={`T-shirt ${activeTab} view`}
                          className="w-full h-full object-cover cursor-zoom-in group-hover:scale-[1.02] transition-transform duration-300"
                          onClick={() => setZoomedImage(selectedDesign[`${activeTab}Image`])}
                        />
                        <button
                          onClick={() => setZoomedImage(selectedDesign[`${activeTab}Image`])}
                          className="absolute bottom-4 right-4 bg-white/90 p-2.5 rounded-full shadow-md hover:bg-white transition-colors text-gray-700 hover:text-indigo-600 opacity-0 group-hover:opacity-100"
                          title="Zoom Image"
                        >
                          <ZoomIn className="w-5 h-5" />
                        </button>
                      </>
                    ) : (
                      <div className="text-gray-400 flex flex-col items-center">
                        <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                        <span className="text-sm">No {activeTab} image uploaded yet</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 mt-4 justify-center">
                    <button
                      onClick={() => setActiveTab('front')}
                      className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'front'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Front
                    </button>
                    <button
                      onClick={() => setActiveTab('back')}
                      className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                        activeTab === 'back'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Back
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Col: Order Form */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                {orderSuccess ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h2>
                    <p className="text-gray-600 mb-6">
                      Thank you, <span className="font-semibold">{lastOrder?.name}</span>!<br />
                      Your order for <span className="font-semibold">{lastOrder?.totalItems} shirt{lastOrder?.totalItems !== 1 ? 's' : ''}</span> has been received.
                    </p>
                    <div className="bg-indigo-50 p-4 rounded-lg mb-6">
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-bold">Total: ${lastOrder?.totalPrice.toFixed(2)}</span>
                      </p>
                      <p className="text-xs text-gray-600">
                        Please send payment via Venmo or Cash App to complete your order.
                      </p>
                    </div>
                    <button
                      onClick={() => setOrderSuccess(false)}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                    >
                      Place Another Order
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitOrder} className="space-y-6">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      <ShoppingCart className="w-6 h-6" />
                      Order Form
                    </h2>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        placeholder="Enter your name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Select Sizes & Quantities</label>
                      <div className="grid grid-cols-5 gap-2">
                        {SIZES.map(size => (
                          <div key={size} className="flex flex-col items-center">
                            <label className="text-xs font-bold text-gray-600 mb-1">{size}</label>
                            <input
                              type="number"
                              min="0"
                              value={sizes[size] === 0 ? '' : sizes[size]}
                              onChange={(e) => handleSizeChange(size, e.target.value)}
                              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                              placeholder="0"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Brand Preference <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={brandRequest}
                        onChange={(e) => setBrandRequest(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        placeholder="e.g., Bella+Canvas, Gildan"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Additional Notes <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y min-h-[80px]"
                        placeholder="Any special requests or notes"
                      />
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{error}</span>
                      </div>
                    )}

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600">Total Items:</span>
                        <span className="font-bold text-lg">{totalItems}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Price:</span>
                        <span className="font-bold text-2xl text-indigo-600">${totalPrice.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-700 mb-2 font-medium">Payment Methods:</p>
                      <div className="space-y-1 text-sm text-gray-600">
                        {globalConfig.venmoUsername && (
                          <p>Venmo: <span className="font-mono font-bold">@{globalConfig.venmoUsername}</span></p>
                        )}
                        {globalConfig.cashappUsername && (
                          <p>Cash App: <span className="font-mono font-bold">${globalConfig.cashappUsername}</span></p>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || totalItems === 0}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-5 h-5" />
                          Place Order
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* --- VIEW: ADMIN LOGIN --- */}
          {view === 'adminLogin' && (
            <div className="max-w-md mx-auto">
