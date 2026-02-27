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
  Image as ImageIcon
} from 'lucide-react';
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
  setDoc
} from 'firebase/firestore';


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
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality JPEG
      };
    };
  });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('store'); // 'store', 'adminLogin', 'adminDashboard'
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Store Configuration State (Images)
  const [storeConfig, setStoreConfig] = useState({ frontImage: null, backImage: null });
  const [configForm, setConfigForm] = useState({
    pageTitle: 'Austin Velocity 161 Diamond Team Shirt - Order form',
    productHeader: 'Austin Velocity 161 Diamond',
    productDescription: "Team shirt with a small club logo on front and large design with team roster on the back. Click the images above to see more detail.\nThe shirts are Bella+Canvas cotton/polyester blend.  If you have a different brand you'd like to use, I should be able to iron these on to any shirt.",
    venmoUsername: 'ekzoss',
    cashappUsername: 'KandiZoss',
    pricePerShirt: 7.50
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [activeTab, setActiveTab] = useState('front'); // 'front' or 'back' image view
  const [zoomedImage, setZoomedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

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

  // --- 2. Fetch Config & Orders ---
  useEffect(() => {
    if (!user) return;

    // Fetch Store Config (Images & Text)
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_config', 'main');
    const unsubscribeConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStoreConfig(data);
        setConfigForm({
          pageTitle: data.pageTitle || 'Austin Velocity 161 Diamond Team Shirt - Order form',
          productHeader: data.productHeader || 'Austin Velocity 161 Diamond',
          productDescription: data.productDescription || "Team shirt with a small club logo on front and large design with team roster on the back. Click the images above to see more detail.\nThe shirts are Bella+Canvas cotton/polyester blend.  If you have a different brand you'd like to use, I should be able to iron these on to any shirt.",
          venmoUsername: data.venmoUsername || 'ekzoss',
          cashappUsername: data.cashappUsername || 'KandiZoss',
          pricePerShirt: data.pricePerShirt !== undefined ? data.pricePerShirt : 7.50
        });
      }
    });

    return () => unsubscribeConfig();
  }, [user]);

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

    return () => unsubscribeOrders();
  }, [user, view]);

  // --- Actions ---

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_config', 'main');
      await setDoc(configRef, configForm, { merge: true });
      // Temporary alert for admin feedback
      alert("Store settings updated successfully!");
    } catch (err) {
      console.error("Save config error", err);
      alert("Failed to save settings.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleImageUpload = async (e, side) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const compressedBase64 = await compressImage(file);
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_config', 'main');
      
      // Update config document in Firestore
      await setDoc(configRef, { [side]: compressedBase64 }, { merge: true });
    } catch (err) {
      console.error("Upload error", err);
      alert("Failed to compress and upload image. Please try a smaller image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSizeChange = (size, value) => {
    const numValue = parseInt(value, 10) || 0;
    setSizes(prev => ({ ...prev, [size]: Math.max(0, numValue) }));
  };

  const totalItems = useMemo(() => {
    return Object.values(sizes).reduce((acc, curr) => acc + curr, 0);
  }, [sizes]);

  const pricePerShirt = storeConfig.pricePerShirt !== undefined ? storeConfig.pricePerShirt : 7.50;
  const totalPrice = totalItems * pricePerShirt;

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError("Please wait for the system to connect.");
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
        name: name.trim(),
        sizes,
        brandRequest: brandRequest.trim(),
        notes: notes.trim(),
        isPaid: false, // Default to false when order is placed
        totalItems,
        timestamp: Date.now(),
        userId: user.uid
      });
      
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
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 selection:bg-indigo-100 flex flex-col relative">
      
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
            onClick={(e) => e.stopPropagation()} // prevent closing when clicking image directly
          />
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 font-bold text-xl text-indigo-600 cursor-pointer"
            onClick={() => { setView('store'); setOrderSuccess(false); }}
          >
            <span>{storeConfig.pageTitle || 'Austin Velocity 161 Diamond Team Shirt - Order form'}</span>
          </div>
          
          {view === 'adminDashboard' && (
            <button 
              onClick={() => setView('store')}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors bg-gray-100 px-3 py-1.5 rounded-lg"
            >
              <LogOut className="w-4 h-4" />
              Exit Admin
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 w-full flex-grow">
        
        {/* --- VIEW: STOREFRONT --- */}
        {view === 'store' && (
          <div className="grid md:grid-cols-2 gap-8 items-start">
            
            {/* Left Col: Product Info */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              
              {/* Image Display Area */}
              <div className="mb-6">
                <div className="aspect-square bg-gray-50 rounded-xl flex items-center justify-center relative overflow-hidden group border border-gray-200 shadow-inner">
                  {storeConfig[`${activeTab}Image`] ? (
                    <>
                      <img 
                        src={storeConfig[`${activeTab}Image`]} 
                        alt={`T-shirt ${activeTab} view`} 
                        className="w-full h-full object-cover cursor-zoom-in group-hover:scale-[1.02] transition-transform duration-300"
                        onClick={() => setZoomedImage(storeConfig[`${activeTab}Image`])}
                      />
                      <button 
                        onClick={() => setZoomedImage(storeConfig[`${activeTab}Image`])}
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
                
                {/* Front / Back Toggles */}
                <div className="flex gap-2 mt-4 justify-center">
                  <button 
                    onClick={() => setActiveTab('front')}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                      activeTab === 'front' 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Front View
                  </button>
                  <button 
                    onClick={() => setActiveTab('back')}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                      activeTab === 'back' 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Back View
                  </button>
                </div>
              </div>

              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{storeConfig.productHeader || 'Austin Velocity 161 Diamond'}</h1>
              
              {/* Product Description with HTML support */}
              <div 
                className="text-gray-600 mb-4 whitespace-pre-wrap [&_a]:text-indigo-600 [&_a]:underline hover:[&_a]:text-indigo-800"
                dangerouslySetInnerHTML={{ 
                  __html: storeConfig.productDescription || "Team shirt with a small club logo on front and large design with team roster on the back. Click the images above to see more detail.\nThe shirts are Bella+Canvas cotton/polyester blend.  If you have a different brand you'd like to use, I should be able to iron these on to any shirt." 
                }} 
              />
              
              <div className="text-2xl font-bold text-indigo-600">${pricePerShirt.toFixed(2)} <span className="text-sm font-normal text-gray-500">/ shirt</span></div>
            </div>

            {/* Right Col: Order Form */}
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
              {orderSuccess && lastOrder ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Received!</h2>
                  <p className="text-gray-600 mb-8">Thank you, {lastOrder.name}! Your order for {lastOrder.totalItems} shirt(s) has been logged.</p>
                  
                  <div className="bg-gray-50 rounded-xl p-6 mb-8 text-left border border-gray-100">
                    <h3 className="font-semibold text-gray-900 mb-4 border-b pb-2">Complete Your Payment</h3>
                    <p className="text-sm text-gray-600 mb-4">Your order total is <strong>${lastOrder.totalPrice.toFixed(2)}</strong>. Please pay using one of the methods below, or cash, etc... Include your name in the payment note.</p>
                    
                    <div className="space-y-3">
                      <a 
                        href={`https://venmo.com/${storeConfig.venmoUsername || 'ekzoss'}?txn=pay&audience=private&amount=${lastOrder.totalPrice}&note=T-Shirt%20Order%20-%20${encodeURIComponent(lastOrder.name)}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center w-full py-3 px-4 bg-[#008CFF] hover:bg-[#0074D6] text-white font-medium rounded-lg transition-colors shadow-sm"
                      >
                        Pay with Venmo @/${storeConfig.venmoUsername || 'ekzoss'}
                      </a>
                      <a 
                        href={`https://cash.app/$${storeConfig.cashappUsername || 'KandiZoss'}/${lastOrder.totalPrice}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center w-full py-3 px-4 bg-[#00D632] hover:bg-[#00B82A] text-white font-medium rounded-lg transition-colors shadow-sm"
                      >
                        Pay with Cash App $${storeConfig.cashappUsername || 'KandiZoss'}
                      </a>
                    </div>
                  </div>

                  <button 
                    onClick={() => { setOrderSuccess(false); setLastOrder(null); }}
                    className="text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
                  >
                    Place another order
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitOrder} className="space-y-6">
                  <h2 className="text-xl font-bold text-gray-900 border-b pb-4">Place Your Order</h2>
                  
                  {error && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Name Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="name">
                      Full Name *
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      placeholder="John Doe"
                    />
                  </div>

                  {/* Sizes Grid */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Select Quantities *
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {SIZES.map(size => (
                        <div key={size} className="flex flex-col items-center">
                          <label className="text-xs font-bold text-gray-500 mb-1">{size}</label>
                          <input
                            type="number"
                            min="0"
                            value={sizes[size] === 0 ? '' : sizes[size]}
                            onChange={(e) => handleSizeChange(size, e.target.value)}
                            placeholder="0"
                            className="w-full text-center px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Optional Brand Request */}
                  {/* <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="brand">
                      Preferred T-Shirt Brand <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      id="brand"
                      type="text"
                      value={brandRequest}
                      onChange={(e) => setBrandRequest(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      placeholder="e.g., Bella+Canvas, Gildan"
                    />
                  </div> */}

                  {/* Optional Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="notes">
                      Notes <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none h-20"
                      placeholder="Any special requests or notes..."
                    />
                  </div>

                  {/* Order Summary Line */}
                  <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center border border-gray-100">
                    <span className="text-gray-600 font-medium">Total Items: <span className="text-gray-900 font-bold">{totalItems}</span></span>
                    <span className="text-gray-600 font-medium">Total: <span className="text-indigo-600 font-bold text-lg">${totalPrice.toFixed(2)}</span></span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || totalItems === 0}
                    className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all flex justify-center items-center gap-2 ${
                      isSubmitting || totalItems === 0 
                        ? 'bg-indigo-300 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg'
                    }`}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Order'}
                  </button>
                </form>
              )}
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
                onClick={() => setView('store')}
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
              <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                 <span className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Total Revenue</span>
                 <span className="text-2xl font-bold text-green-600">
                   ${orders.reduce((acc, order) => acc + (order.totalItems * pricePerShirt), 0).toFixed(2)}
                 </span>
              </div>
            </div>

            {/* --- NEW: Image Upload Section --- */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Store Settings: Product Images</h2>
              <div className="grid md:grid-cols-2 gap-6">
                
                {/* Front Image Uploader */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Front Image (.jpg)</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-gray-100 rounded border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                      {storeConfig.frontImage ? (
                        <img src={storeConfig.frontImage} alt="front" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-grow">
                      <label className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors text-sm font-medium border border-indigo-200 relative overflow-hidden group">
                        <Upload className="w-4 h-4" />
                        <span>Upload Front</span>
                        <input 
                          type="file" 
                          accept="image/jpeg, image/png" 
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full hidden group-hover:block" 
                          onChange={(e) => handleImageUpload(e, 'frontImage')} 
                          disabled={uploadingImage} 
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Back Image Uploader */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Back Image (.jpg)</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-gray-100 rounded border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                      {storeConfig.backImage ? (
                        <img src={storeConfig.backImage} alt="back" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-grow">
                      <label className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors text-sm font-medium border border-indigo-200 relative overflow-hidden group">
                        <Upload className="w-4 h-4" />
                        <span>Upload Back</span>
                        <input 
                          type="file" 
                          accept="image/jpeg, image/png" 
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full hidden group-hover:block" 
                          onChange={(e) => handleImageUpload(e, 'backImage')} 
                          disabled={uploadingImage} 
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              {uploadingImage && (
                <p className="text-sm text-indigo-600 font-bold mt-4 animate-pulse flex items-center gap-2">
                  <Upload className="w-4 h-4 animate-bounce" /> Compressing and securely uploading image...
                </p>
              )}
            </div>

            {/* --- NEW: Text & Payment Settings --- */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Store Settings: Details & Payment</h2>
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Page Title (Top Bar)</label>
                    <input 
                      type="text" 
                      value={configForm.pageTitle} 
                      onChange={e => setConfigForm({...configForm, pageTitle: e.target.value})} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Header</label>
                    <input 
                      type="text" 
                      value={configForm.productHeader} 
                      onChange={e => setConfigForm({...configForm, productHeader: e.target.value})} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price Per Shirt ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      value={configForm.pricePerShirt} 
                      onChange={e => setConfigForm({...configForm, pricePerShirt: parseFloat(e.target.value) || 0})} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Description <span className="text-gray-400 font-normal">(Accepts basic HTML like &lt;a href="..."&gt;)</span></label>
                  <textarea 
                    value={configForm.productDescription} 
                    onChange={e => setConfigForm({...configForm, productDescription: e.target.value})} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y min-h-[100px]"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isSavingConfig}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSavingConfig ? 'Saving...' : 'Save Text Settings'}
                </button>
              </form>
            </div>

            {/* Totals Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {SIZES.map(size => (
                <div key={size} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                  <span className="text-gray-400 text-sm font-bold mb-1">SIZE {size}</span>
                  <span className="text-3xl font-extrabold text-indigo-600">{sizeTotals[size]}</span>
                </div>
              ))}
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                      {/* <th className="px-6 py-4">Brand Req.</th> */}
                      <th className="px-6 py-4">Notes</th>
                      <th className="px-6 py-4 text-right">Items</th>
                      <th className="px-6 py-4 text-center border-l border-gray-200">Paid</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan="12" className="px-6 py-12 text-center text-gray-500 text-base">
                          No orders have been placed yet.
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => {
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
                          
                          {/* <td className="px-6 py-4 text-gray-500 italic text-xs">
                            {isEditing ? (
                              <input 
                                type="text" 
                                value={editFormData.brandRequest} 
                                onChange={e => setEditFormData({...editFormData, brandRequest: e.target.value})}
                                className="w-full px-2 py-1 border border-indigo-300 rounded text-sm not-italic focus:outline-none"
                              />
                            ) : (order.brandRequest || '-')}
                          </td> */}
                          
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
  );
}
