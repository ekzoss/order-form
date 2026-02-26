import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, 
  ShieldCheck, 
  Lock, 
  LogOut, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle
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
  updateDoc
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

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('store'); // 'store', 'adminLogin', 'adminDashboard'
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

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

  // --- 2. Fetch Orders for Admin ---
  useEffect(() => {
    if (!user || view !== 'adminDashboard') return;

    const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'tshirt_orders');
    const q = query(ordersRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
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

    return () => unsubscribe();
  }, [user, view]);

  // --- Actions ---
  const handleSizeChange = (size, value) => {
    const numValue = parseInt(value, 10) || 0;
    setSizes(prev => ({ ...prev, [size]: Math.max(0, numValue) }));
  };

  const totalItems = useMemo(() => {
    return Object.values(sizes).reduce((acc, curr) => acc + curr, 0);
  }, [sizes]);

  const pricePerShirt = 25;
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
      alert("Failed to update paid status.");
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
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 selection:bg-indigo-100 flex flex-col">
      
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 font-bold text-xl text-indigo-600 cursor-pointer"
            onClick={() => { setView('store'); setOrderSuccess(false); }}
          >
            <ShoppingCart className="w-6 h-6" />
            <span>Campus Threads</span>
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
              <div className="aspect-square bg-gray-100 rounded-xl mb-6 flex items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50"></div>
                <svg className="w-48 h-48 text-indigo-900 relative z-10 drop-shadow-md" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.197,3.649c-0.234-0.198-0.548-0.272-0.849-0.2L16,4L12,2L8,4L4.652,3.449C4.352,3.376,4.038,3.451,3.804,3.649  C3.569,3.847,3.446,4.148,3.481,4.453l1,8.5C4.516,13.25,4.787,13.5,5.1,13.5h1.4V21c0,0.552,0.448,1,1,1h9c0.552,0,1-0.448,1-1v-7.5  h1.4c0.313,0,0.584-0.25,0.619-0.547l1-8.5C20.554,4.148,20.431,3.847,20.197,3.649z M12.5,4.236l2.118-1.059l1.761-0.294L16.5,4h-8  l0.121-1.117l1.761,0.294L12.5,4.236z M8.5,13.5v7h-1v-7H8.5z M16.5,20.5h-7v-7h7V20.5z M18.5,13.5h-1v-7h1V13.5z" />
                </svg>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 mt-4 text-center z-20">
                  <span className="font-bold text-white text-xl tracking-wider block drop-shadow-lg">2026</span>
                  <span className="font-medium text-white/90 text-sm tracking-widest uppercase drop-shadow">Limited Ed.</span>
                </div>
              </div>

              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">"The Classic" Minimalist Tee</h1>
              <p className="text-gray-600 mb-4">Premium heavyweight cotton. Designed for comfort and everyday wear. Features our signature subtle chest embroidery.</p>
              <div className="text-2xl font-bold text-indigo-600">${pricePerShirt} <span className="text-sm font-normal text-gray-500">/ shirt</span></div>
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
                    <p className="text-sm text-gray-600 mb-4">Your order total is <strong>${lastOrder.totalPrice}</strong>. Please pay using one of the methods below. Include your name in the payment note.</p>
                    
                    <div className="space-y-3">
                      <a 
                        href={`https://venmo.com/?txn=pay&audience=private&amount=${lastOrder.totalPrice}&note=T-Shirt%20Order%20-%20${encodeURIComponent(lastOrder.name)}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center w-full py-3 px-4 bg-[#008CFF] hover:bg-[#0074D6] text-white font-medium rounded-lg transition-colors shadow-sm"
                      >
                        Pay with Venmo
                      </a>
                      <a 
                        href={`https://cash.app/$yourcashtag/${lastOrder.totalPrice}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center w-full py-3 px-4 bg-[#00D632] hover:bg-[#00B82A] text-white font-medium rounded-lg transition-colors shadow-sm"
                      >
                        Pay with Cash App
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
                  <div>
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
                  </div>

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
                    <span className="text-gray-600 font-medium">Est. Total: <span className="text-indigo-600 font-bold text-lg">${totalPrice}</span></span>
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
                <h1 className="text-3xl font-bold text-gray-900">Order Dashboard</h1>
                <p className="text-gray-500">Overview of all submitted t-shirt orders.</p>
              </div>
              <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                 <span className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Total Revenue</span>
                 <span className="text-2xl font-bold text-green-600">
                   ${orders.reduce((acc, order) => acc + (order.totalItems * pricePerShirt), 0)}
                 </span>
              </div>
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
                      <th className="px-6 py-4">Brand Req.</th>
                      <th className="px-6 py-4">Notes</th>
                      <th className="px-6 py-4 text-right">Items</th>
                      <th className="px-6 py-4 text-center border-l border-gray-200">Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan="11" className="px-6 py-12 text-center text-gray-500 text-base">
                          No orders have been placed yet.
                        </td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr 
                          key={order.id} 
                          className={`transition-colors ${order.isPaid ? 'bg-green-50/30' : 'hover:bg-gray-50/50'}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                            {new Date(order.timestamp).toLocaleDateString()} <br/>
                            {new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900">{order.name}</td>
                          <td className={`px-4 py-4 text-center border-l border-gray-100 ${order.sizes?.S > 0 ? 'font-bold text-indigo-600 bg-indigo-50/20' : 'text-gray-300'}`}>{order.sizes?.S || 0}</td>
                          <td className={`px-4 py-4 text-center ${order.sizes?.M > 0 ? 'font-bold text-indigo-600 bg-indigo-50/20' : 'text-gray-300'}`}>{order.sizes?.M || 0}</td>
                          <td className={`px-4 py-4 text-center ${order.sizes?.L > 0 ? 'font-bold text-indigo-600 bg-indigo-50/20' : 'text-gray-300'}`}>{order.sizes?.L || 0}</td>
                          <td className={`px-4 py-4 text-center ${order.sizes?.XL > 0 ? 'font-bold text-indigo-600 bg-indigo-50/20' : 'text-gray-300'}`}>{order.sizes?.XL || 0}</td>
                          <td className={`px-4 py-4 text-center border-r border-gray-100 ${order.sizes?.XXL > 0 ? 'font-bold text-indigo-600 bg-indigo-50/20' : 'text-gray-300'}`}>{order.sizes?.XXL || 0}</td>
                          
                          <td className="px-6 py-4 text-gray-500 italic text-xs">{order.brandRequest || '-'}</td>
                          
                          <td className="px-6 py-4 text-gray-600 text-xs max-w-[150px] truncate" title={order.notes}>
                            {order.notes || '-'}
                          </td>
                          
                          <td className="px-6 py-4 text-right font-bold text-gray-900">{order.totalItems}</td>
                          
                          <td className="px-6 py-4 text-center border-l border-gray-100">
                            <input
                              type="checkbox"
                              checked={!!order.isPaid}
                              onChange={() => handleTogglePaid(order.id, !!order.isPaid)}
                              className="w-5 h-5 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                              title={order.isPaid ? "Mark as unpaid" : "Mark as paid"}
                            />
                          </td>
                        </tr>
                      ))
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