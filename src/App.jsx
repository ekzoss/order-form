import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  ShieldCheck,
  Lock,
  ArrowLeft,
  AlertCircle,
  Edit2,
  Trash2,
  X,
  Save,
  ZoomIn,
  Image as ImageIcon,
  Printer,
  Plus,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import ImageEditorModal from './ImageEditorModal';
import BackgroundEditorModal from './BackgroundEditorModal';
import OrderSubmissionModal from './OrderSubmissionModal';
import AdminLogin from './components/AdminLogin';
import GlobalSettingsForm from './components/GlobalSettingsForm';
import { DEFAULT_TSHIRT_BACKGROUNDS, SIZES } from './constants';
import { compressImage, compositeImageWithTshirt } from './imageUtils';
import { db, appId } from './firebase';
import PreviewRenderer from './components/PreviewRenderer';
import { useAuth } from './hooks/useAuth';
import { useGlobalConfig } from './hooks/useGlobalConfig';
import { useItems } from './hooks/useItems';
import { useOrders } from './hooks/useOrders';
import { useTshirtBackgrounds } from './hooks/useTshirtBackgrounds';
import { useFeedback } from './hooks/useFeedback';
import { submitMultiItemOrder } from './utils/orderHelpers';
import { calculateProcessingFee } from './feeUtils';

export default function App() {
  const [view, setView] = useState('store'); // 'store', 'adminLogin', 'adminDashboard'
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Use custom hooks
  const { user, isLoadingAuth, adminError, setAdminError, handleAdminLogin, handleAdminLogout, isAdmin } = useAuth();
  const {
    globalConfig,
    configForm,
    setConfigForm,
    isSavingConfig,
    storeConfig,
    hasUnsavedConfigChanges,
    saveConfig
  } = useGlobalConfig(user);
  
  const {
    items,
    isLoadingItems,
    selectedItem,
    editingItemId,
    setEditingItemId,
    itemForm,
    setItemForm,
    collapsedItems,
    deleteConfirmItemId,
    setDeleteConfirmItemId,
    itemEdits,
    handleCreateItem,
    handleStartEditItem,
    handleSaveItemEdit,
    handleDeleteItem,
    toggleItemCollapse,
    handleMoveItem,
    handleUpdateItemField,
    handleChangeItemStatus,
    saveAllItemEdits,
    handleSaveImageEditor: handleSaveImageEditorFromHook
  } = useItems(user, selectedItemId, setSelectedItemId);
  
  const {
    orders,
    editingOrderId,
    editFormData,
    setEditFormData,
    deleteConfirmId,
    setDeleteConfirmId,
    adminAccessDenied,
    adminError: ordersAdminError,
    handleEditOrder,
    handleSaveEdit,
    handleCancelEdit,
    handleDeleteOrder
  } = useOrders(user, view);

  const {
    tshirtBackgrounds,
    backgroundEditorModal,
    handleTshirtBgUpload,
    handleSaveBackground,
    handleCloseBackgroundEditor,
    handleDeleteTshirtBg
  } = useTshirtBackgrounds(user);

  // State for expandable orders in the All Orders section
  const [expandedOrderIds, setExpandedOrderIds] = useState({});
  
  // State for collapsible item orders sections
  const [itemOrdersExpanded, setItemOrdersExpanded] = useState({});

  const {
    feedbackByItem,
    setFeedbackByItem,
    submittingFeedback,
    submittedFeedback,
    feedbackList,
    handleSubmitFeedback,
    handleDeleteFeedback
  } = useFeedback(user, view);

  // UI State
  const [tshirtBgLibraryExpanded, setTshirtBgLibraryExpanded] = useState(false);
  const [pageInfoExpanded, setPageInfoExpanded] = useState(true);
  const [zoomedImage, setZoomedImage] = useState(null);
  
  // Image Editor Modal State
  const [imageEditorModal, setImageEditorModal] = useState({
    isOpen: false,
    itemId: null
  });

  // Form State
  const [sizesByItem, setSizesByItem] = useState({}); // { itemId: { S: 0, M: 0, ... } }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdminOrderSubmitting, setIsAdminOrderSubmitting] = useState(false);
  
  // Order Modal State
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderModalName, setOrderModalName] = useState('');
  const [orderModalNotes, setOrderModalNotes] = useState('');
  const [orderSubmitted, setOrderSubmitted] = useState(false);

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

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    await saveConfig();
  };

  // --- Image Editor Actions ---
  const handleOpenImageEditor = (itemId) => {
    setImageEditorModal({
      isOpen: true,
      itemId: itemId
    });
  };

  const handleCloseImageEditor = () => {
    setImageEditorModal({
      isOpen: false,
      itemId: null
    });
  };
  
  const handleSaveImageEditor = async (data) => {
    const itemId = imageEditorModal.itemId;
    await handleSaveImageEditorFromHook(data, itemId);
  };

  // --- Multi-item Order Submission ---
  const handleSubmitMultiItemOrder = async (paymentId = null, options = {}) => {
    const { isAdminOrder = false } = options;
    const setSubmittingState = isAdminOrder ? setIsAdminOrderSubmitting : setIsSubmitting;

    setSubmittingState(true);
    try {
      await submitMultiItemOrder({
        orderModalName,
        orderModalNotes,
        sizesByItem,
        items,
        globalConfig,
        totalItems,
        totalPrice,
        paymentId,
        isAdminOrder,
        adminUser: isAdminOrder ? user : null
      });
      
      setOrderSubmitted(true);
      setSubmittingState(false);
      return true;
    } catch (err) {
      console.error('Error submitting orders:', err);
      alert(err.message || 'Failed to submit order');
      setSubmittingState(false);
      return false;
    }
  };

  const handleCloseOrderModal = () => {
    setShowOrderModal(false);
    setAdminError('');
    if (orderSubmitted) {
      setOrderSubmitted(false);
      setOrderModalName('');
      setOrderModalNotes('');
      setSizesByItem({});
    }
  };

  const handleSizeChange = (itemId, size, value) => {
    const numValue = parseInt(value, 10) || 0;
    setSizesByItem(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { S: 0, M: 0, L: 0, XL: 0, XXL: 0 }),
        [size]: Math.max(0, numValue)
      }
    }));
  };

  // Legacy function for old code
  const handleSizeChangeLegacy = (size, value) => {
    const numValue = parseInt(value, 10) || 0;
    setSizes(prev => ({ ...prev, [size]: Math.max(0, numValue) }));
  };

  // Calculate total items across all items
  const totalItems = useMemo(() => {
    let total = 0;
    Object.values(sizesByItem).forEach(itemSizes => {
      total += Object.values(itemSizes).reduce((acc, curr) => acc + curr, 0);
    });
    return total;
  }, [sizesByItem]);

  // Calculate total price across all items with their individual prices
  const totalPrice = useMemo(() => {
    let total = 0;
    Object.entries(sizesByItem).forEach(([itemId, itemSizes]) => {
      const item = items.find(d => d.id === itemId);
      if (item) {
        const itemTotal = Object.values(itemSizes).reduce((acc, curr) => acc + curr, 0);
        total += itemTotal * item.price;
      }
    });
    return total;
  }, [sizesByItem, items]);


  const handleAdminLoginWrapper = async () => {
    const success = await handleAdminLogin();
    if (success) {
      setView('adminDashboard');
    }
  };

  const handleAdminOrderLogin = async () => {
    if (isAdmin) {
      setAdminError('');
      return true;
    }

    return handleAdminLogin();
  };

  const handleExitAdmin = async () => {
    if (hasUnsavedConfigChanges) {
      const shouldSave = window.confirm('You have unsaved changes. Would you like to save them before exiting admin?');
      if (shouldSave) {
        const saved = await saveConfig();
        if (!saved) return;
      }
    }

    await handleAdminLogout();
    setView('store');
  };

  // --- Admin Calculations ---
  
  // Group orders by item (from items array)
  const ordersByItem = useMemo(() => {
    const grouped = {};
    orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        // New structure: items array
        order.items.forEach(item => {
          const itemId = item.itemId || 'unknown';
          if (!grouped[itemId]) {
            grouped[itemId] = [];
          }
          // Check if this order is already in the item's list
          if (!grouped[itemId].find(o => o.id === order.id)) {
            grouped[itemId].push(order);
          }
        });
      } else if (order.itemId) {
        // Legacy structure: single itemId
        const itemId = order.itemId;
        if (!grouped[itemId]) {
          grouped[itemId] = [];
        }
        grouped[itemId].push(order);
      }
    });
    return grouped;
  }, [orders]);

  // Helper function to toggle order expansion in All Orders section
  const toggleOrderExpansion = (orderId) => {
    setExpandedOrderIds(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  // Calculate total revenue across all orders
  const totalRevenue = useMemo(() => {
    return orders.reduce((sum, order) => {
      return sum + (order.totalPrice || 0);
    }, 0);
  }, [orders]);

  // Calculate totals per item
  const calculateItemTotals = (itemId) => {
    const itemOrders = ordersByItem[itemId] || [];
    const totals = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
    let revenue = 0;
    
    itemOrders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        // New structure: items array
        order.items.forEach(item => {
          if (item.itemId === itemId) {
            totals[item.size] = (totals[item.size] || 0) + item.quantity;
            revenue += item.subtotal || 0;
          }
        });
      } else if (order.sizes && order.itemId === itemId) {
        // Legacy structure
        SIZES.forEach(size => {
          if (order.sizes[size]) {
            totals[size] += order.sizes[size];
          }
        });
        revenue += (order.totalItems || 0) * (items.find(d => d.id === itemId)?.price || 0);
      }
    });
    
    return {
      sizes: totals,
      revenue: revenue
    };
  };

  // Overall totals (supports both new and legacy structure)
  const sizeTotals = useMemo(() => {
    const totals = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
    orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        // New structure: items array
        order.items.forEach(item => {
          totals[item.size] = (totals[item.size] || 0) + item.quantity;
        });
      } else if (order.sizes) {
        // Legacy structure
        SIZES.forEach(size => {
          if (order.sizes[size]) {
            totals[size] += order.sizes[size];
          }
        });
      }
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
        {zoomedImage && (() => {
          const item = items.find(i => i.id === zoomedImage);
          return item?.previewImageMeta ? (
            <div
              className="fixed inset-0 z-50 bg-white flex items-center justify-center p-4"
              onClick={() => setZoomedImage(null)}
            >
              <button
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors bg-white/90 p-2 rounded-full shadow-lg"
                onClick={() => setZoomedImage(null)}
              >
                <X className="w-8 h-8" />
              </button>
              <div
                className="w-full max-w-6xl cursor-zoom-out"
                style={{ aspectRatio: '4/3' }}
                onClick={() => setZoomedImage(null)}
              >
                <PreviewRenderer
                  previewImageMeta={item.previewImageMeta}
                  className="w-full h-full shadow-2xl rounded-lg"
                  alt="Zoomed product"
                />
              </div>
            </div>
          ) : null;
        })()}

        {/* Image Editor Modal */}
        <ImageEditorModal
          isOpen={imageEditorModal.isOpen}
          onClose={handleCloseImageEditor}
          initialForegroundImages={(() => {
            if (!imageEditorModal.itemId) return null;
            const item = items.find(d => d.id === imageEditorModal.itemId);
            return item?.previewImageMeta?.foregroundImages || null;
          })()}
          initialBackground={(() => {
            if (!imageEditorModal.itemId) return DEFAULT_TSHIRT_BACKGROUNDS[0].url;
            const item = items.find(d => d.id === imageEditorModal.itemId);
            return item?.previewImageMeta?.selectedBackground || DEFAULT_TSHIRT_BACKGROUNDS[0].url;
          })()}
          initialBackgroundType={(() => {
            if (!imageEditorModal.itemId) return 'solid';
            const item = items.find(d => d.id === imageEditorModal.itemId);
            return item?.previewImageMeta?.backgroundType || 'solid';
          })()}
          initialBackgroundColor={(() => {
            if (!imageEditorModal.itemId) return '#FFFFFF';
            const item = items.find(d => d.id === imageEditorModal.itemId);
            return item?.previewImageMeta?.backgroundColor || '#FFFFFF';
          })()}
          initialCustomBackgroundImage={(() => {
            if (!imageEditorModal.itemId) return null;
            const item = items.find(d => d.id === imageEditorModal.itemId);
            return item?.previewImageMeta?.customBackgroundImage || null;
          })()}
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
          <OrderSubmissionModal
            showOrderModal={showOrderModal}
            orderSubmitted={orderSubmitted}
            handleCloseOrderModal={handleCloseOrderModal}
            sizesByItem={sizesByItem}
            items={items}
            totalPrice={totalPrice}
            orderModalName={orderModalName}
            setOrderModalName={setOrderModalName}
            orderModalNotes={orderModalNotes}
            setOrderModalNotes={setOrderModalNotes}
            handleSubmitMultiItemOrder={handleSubmitMultiItemOrder}
            isSubmitting={isSubmitting}
            globalConfig={globalConfig}
            isAdmin={isAdmin}
            adminError={adminError}
            onAdminOrderLogin={handleAdminOrderLogin}
            isAdminOrderSubmitting={isAdminOrderSubmitting}
          />
          
          {/* --- VIEW: STOREFRONT --- */}
          {view === 'store' && !isLoadingItems && items.length === 0 && (
            <div className="max-w-2xl mx-auto text-center py-16">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8">
                <AlertCircle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">No Items Available</h2>
                <p className="text-gray-600 mb-6">
                  The store is being set up. Please check back soon or contact the administrator.
                </p>
              </div>
            </div>
          )}
          
          {view === 'store' && items.length > 0 && (
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

              {items.filter(item => item.status !== 'closed').map(item => {
                const isPreview = item.status === 'preview';
                return (
                <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  {/* Title and Price */}
                  <div className="mb-4 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">{item.productHeader || item.name}</h1>
                    {isPreview ? (
                      <p className="text-lg text-yellow-600 font-semibold whitespace-nowrap ml-4">(Preview)</p>
                    ) : (
                      <p className="text-lg text-indigo-600 font-semibold whitespace-nowrap ml-4">${item.price.toFixed(2)}</p>
                    )}
                  </div>

                  {/* Description */}
                  {item.productDescription && (
                    <div className="mb-6">
                      <div
                        className="text-gray-600 whitespace-pre-wrap [&_a]:text-indigo-600 [&_a]:underline hover:[&_a]:text-indigo-800"
                        dangerouslySetInnerHTML={{
                          __html: item.productDescription
                        }}
                      />
                    </div>
                  )}

                  {/* Front and Back Images Side by Side */}
                  <div className="mb-6">
                    {/* Preview Image */}
                    <div className="max-w-2xl mx-auto">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 text-center">Preview</h3>
                      <div className="aspect-[4/3] bg-gray-50 rounded-lg flex items-center justify-center relative overflow-hidden group border border-gray-200">
                        {item.previewImageMeta?.foregroundImages?.length > 0 ? (
                          <>
                            <PreviewRenderer
                              previewImageMeta={item.previewImageMeta}
                              className="w-full h-full cursor-zoom-in group-hover:scale-[1.02] transition-transform duration-300"
                              onClick={() => setZoomedImage(item.id)}
                              alt="Item preview"
                            />
                            <button
                              onClick={() => setZoomedImage(item.id)}
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
                      // Feedback form for preview items
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Share your feedback on this item:
                        </label>
                        <textarea
                          value={feedbackByItem[item.id] || ''}
                          onChange={(e) => setFeedbackByItem(prev => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="What do you think about this item? Any suggestions?"
                          disabled={submittedFeedback[item.id]}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none resize-y min-h-[100px] ${
                            submittedFeedback[item.id] ? 'bg-gray-50 cursor-not-allowed' : ''
                          }`}
                        />
                        <button
                          onClick={() => handleSubmitFeedback(item.id)}
                          disabled={submittingFeedback[item.id] || submittedFeedback[item.id]}
                          className={`w-full py-3 rounded-lg font-bold text-white transition-all ${
                            submittedFeedback[item.id]
                              ? 'bg-green-500 cursor-not-allowed'
                              : submittingFeedback[item.id]
                              ? 'bg-yellow-300 cursor-not-allowed'
                              : 'bg-yellow-600 hover:bg-yellow-700'
                          }`}
                        >
                          {submittedFeedback[item.id]
                            ? 'Thank you for your feedback!'
                            : submittingFeedback[item.id]
                            ? 'Submitting...'
                            : 'Submit Feedback'}
                        </button>
                      </div>
                    ) : (
                      // Size selection for open items
                      <div className="grid grid-cols-5 gap-2">
                        {SIZES.map(size => {
                          const itemSizes = sizesByItem[item.id] || { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
                          return (
                            <div key={size} className="flex flex-col items-center">
                              <label className="text-xs font-bold text-gray-500 mb-1">{size}</label>
                              <input
                                type="number"
                                min="0"
                                value={itemSizes[size] === 0 ? '' : itemSizes[size]}
                                onChange={(e) => handleSizeChange(item.id, size, e.target.value)}
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

              {/* Single Place Order Button at Bottom */}
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
                    Place Order ({totalItems} items - ${totalPrice.toFixed(2)})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Old single-item view - keeping for reference, will remove after multi-item ordering works */}
          {view === 'store' && false && selectedItem && (
            <div className="grid md:grid-cols-2 gap-8 items-start">
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h1 className="text-3xl font-extrabold text-gray-900 mb-4">{selectedItem.productHeader}</h1>
                  <div
                    className="text-gray-600 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: selectedItem.productDescription || ""
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
                <p className="text-gray-500 text-sm mt-1">Sign in with your authorized Google account to view orders.</p>
              </div>
              
              <div className="space-y-4">
                {adminError && <p className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">{adminError}</p>}
                <button
                  type="button"
                  onClick={handleAdminLoginWrapper}
                  className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-medium transition-colors"
                >
                  Sign in with Google
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
              </div>
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

              {adminAccessDenied && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                  <h2 className="text-lg font-bold text-red-900 mb-2">Admin Firestore Access Denied</h2>
                  <p className="text-sm text-red-800 mb-3">
                    This Google account passed the app admin allowlist, but Firestore rules denied access to admin data.
                  </p>
                  <p className="text-sm text-red-800">
                    Make sure this UID is included in your Firestore <code>isAdmin()</code> rule, not just in <code>VITE_ADMIN_UIDS</code>.
                  </p>
                </div>
              )}

              {!adminAccessDenied && (
              <>
              {/* --- Global Settings Section --- */}
              <GlobalSettingsForm
                configForm={configForm}
                setConfigForm={setConfigForm}
                handleSaveConfig={handleSaveConfig}
                pageInfoExpanded={pageInfoExpanded}
                setPageInfoExpanded={setPageInfoExpanded}
                tshirtBgLibraryExpanded={tshirtBgLibraryExpanded}
                setTshirtBgLibraryExpanded={setTshirtBgLibraryExpanded}
                tshirtBackgrounds={tshirtBackgrounds}
                handleTshirtBgUpload={handleTshirtBgUpload}
                handleDeleteTshirtBg={handleDeleteTshirtBg}
              />

              {/* Items Section */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Items</h2>
                <button
                  onClick={handleCreateItem}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Create New Item
                </button>
              </div>

              {/* item Cards */}
              {items.map(item => {
                const itemOrders = ordersByItem[item.id] || [];
                const itemTotals = calculateItemTotals(item.id);
                const isCollapsed = collapsedItems[item.id] !== false; // Default to collapsed
                
                return (
                  <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
                    {/* Collapsible Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleItemCollapse(item.id)}
                    >
                      <div className="flex items-center gap-3">
                        {isCollapsed ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronUp className="w-5 h-5 text-gray-400" />}
                        <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Reorder buttons */}
                        <div className="flex items-center gap-1 mr-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveItem(item.id, 'up');
                            }}
                            disabled={items.findIndex(d => d.id === item.id) === 0}
                            className={`p-1.5 rounded transition-colors ${
                              items.findIndex(d => d.id === item.id) === 0
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
                              handleMoveItem(item.id, 'down');
                            }}
                            disabled={items.findIndex(d => d.id === item.id) === items.length - 1}
                            className={`p-1.5 rounded transition-colors ${
                              items.findIndex(d => d.id === item.id) === items.length - 1
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
                          value={item.status || 'open'}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleChangeItemStatus(item.id, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`px-3 py-1.5 text-sm font-medium rounded-lg border-2 transition-colors cursor-pointer ${
                            item.status === 'closed'
                              ? 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                              : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                          }`}
                          title="Change item Status"
                        >
                          <option value="open">Open</option>
                          <option value="closed">Closed</option>
                        </select>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item.id, orders);
                          }}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {!isCollapsed && (
                      <div className="p-6 pt-0 border-t border-gray-100">
                        {/* Editable item Fields */}
                        <div className="space-y-4 mb-6">
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                              <input
                                type="text"
                                value={itemEdits[item.id]?.name ?? item.name}
                                onChange={e => {
                                  handleUpdateItemField(item.id, 'name', e.target.value);
                                  handleUpdateItemField(item.id, 'productHeader', e.target.value);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={itemEdits[item.id]?.price ?? item.price}
                                onChange={e => handleUpdateItemField(item.id, 'price', parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                              value={itemEdits[item.id]?.productDescription ?? item.productDescription}
                              onChange={e => handleUpdateItemField(item.id, 'productDescription', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y min-h-[80px]"
                            />
                          </div>
                        </div>
                    
                    {/* Preview Image */}
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Preview Image</label>
                      <div className="w-full max-w-[500px] mx-auto">
                        <div className="relative group aspect-[4/3] bg-gray-100 rounded-lg border-2 border-gray-300 flex items-center justify-center overflow-hidden shadow-sm">
                          {item.previewImageMeta?.foregroundImages?.length > 0 ? (
                            <PreviewRenderer
                              previewImageMeta={item.previewImageMeta}
                              className="w-full h-full"
                              alt="preview"
                            />
                          ) : (
                            <ImageIcon className="w-12 h-12 text-gray-400" />
                          )}
                          <button
                            onClick={() => handleOpenImageEditor(item.id)}
                            className="absolute top-2 right-2 p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            title="Modify Preview Image"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          {item.previewImageMeta?.foregroundImages?.length > 0 && (
                            <button
                              onClick={() => setZoomedImage(item.id)}
                              className="absolute bottom-2 right-2 p-2 bg-white/90 text-gray-700 rounded-full hover:bg-white hover:text-indigo-600 transition-colors shadow-md opacity-100 md:opacity-0 md:group-hover:opacity-100"
                              title="Zoom Image"
                            >
                              <ZoomIn className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Totals Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-6">
                      {SIZES.map(size => (
                        <div key={size} className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex flex-col items-center justify-center">
                          <span className="text-gray-500 text-xs font-bold mb-1">SIZE {size}</span>
                          <span className="text-2xl font-extrabold text-indigo-600">{itemTotals.sizes[size]}</span>
                        </div>
                      ))}
                      {/* Total Revenue */}
                      <div className="bg-green-50 p-3 rounded-lg border border-green-200 flex flex-col items-center justify-center">
                        <span className="text-green-700 text-xs font-bold mb-1">REVENUE</span>
                        <span className="text-2xl font-extrabold text-green-600">
                          ${itemTotals.revenue.toFixed(2)}
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

                    {/* Orders Details - Collapsible */}
                    {itemOrders.length > 0 && (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setItemOrdersExpanded(prev => ({
                            ...prev,
                            [item.id]: !prev[item.id]
                          }))}
                          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <span className="text-sm font-semibold text-gray-700">Details</span>
                          {itemOrdersExpanded[item.id] ?
                            <ChevronUp className="w-5 h-5 text-gray-400" /> :
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          }
                        </button>
                        
                        {itemOrdersExpanded[item.id] && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Name</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Notes</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Sizes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {itemOrders.map((order) => {
                                  // Build sizes string from items array for this item
                                  let sizesStr = '';
                                  if (order.items && Array.isArray(order.items)) {
                                    const itemItems = order.items.filter(orderItem => orderItem.itemId === item.id);
                                    sizesStr = itemItems
                                      .map(orderItem => `${orderItem.size}: ${orderItem.quantity}`)
                                      .join(', ');
                                  } else if (order.sizes) {
                                    // Legacy structure
                                    sizesStr = SIZES
                                      .filter(size => order.sizes?.[size] > 0)
                                      .map(size => `${size}: ${order.sizes[size]}`)
                                      .join(', ');
                                  }
                                  
                                  return (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                      <td className="px-4 py-2 text-gray-900">{order.name}</td>
                                      <td className="px-4 py-2 text-gray-600">{order.notes || '-'}</td>
                                      <td className="px-4 py-2 text-gray-900">{sizesStr}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Feedback Section */}
                    {(() => {
                      const itemFeedback = feedbackList.filter(f => f.itemId === item.id);
                      if (itemFeedback.length === 0) return null;
                      
                      return (
                        <div className="mt-8">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Feedback ({itemFeedback.length})
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
                                {itemFeedback.map(feedback => (
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

              {/* All Orders Section */}
              <div className="mt-12 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">All Orders</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {orders.length} total orders • ${totalRevenue.toFixed(2)} paid
                    </p>
                  </div>
                </div>

                {orders.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No orders have been placed yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orders
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .map((order) => {
                        const isExpanded = expandedOrderIds[order.id];
                        
                        return (
                          <div
                            key={order.id}
                            className="border border-gray-200 rounded-lg overflow-hidden transition-colors bg-white"
                          >
                            {/* Order Summary Row */}
                            <div
                              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => toggleOrderExpansion(order.id)}
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <button className="text-gray-400 hover:text-gray-600">
                                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </button>
                                
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                                  <div className="text-xs text-gray-500">
                                    {new Date(order.timestamp).toLocaleDateString()}<br/>
                                    {new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </div>
                                  
                                  <div className="font-medium text-gray-900">
                                    {order.name}
                                  </div>
                                  
                                  <div className="text-sm text-gray-600 truncate" title={order.notes}>
                                    {order.notes || '-'}
                                  </div>
                                  
                                  <div className="flex items-center justify-end gap-4">
                                    <span className="font-bold text-gray-900">
                                      ${(order.totalPrice || 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Expanded Order Details */}
                            {isExpanded && (
                              <div className="border-t border-gray-200 bg-gray-50/50 p-4">
                                <div className="space-y-2 mb-4">
                                  <h4 className="font-semibold text-gray-700 text-sm mb-2">Order Details:</h4>
                                  
                                  {/* Line items */}
                                  {order.items && Array.isArray(order.items) ? (
                                    // New structure: items array
                                    order.items.map((item, index) => (
                                      <div key={index} className="flex justify-between items-center py-1 text-sm">
                                        <span className="text-gray-900">{item.itemName} - {item.size} (x{item.quantity})</span>
                                        <span className="text-gray-900">${item.subtotal?.toFixed(2) || '0.00'}</span>
                                      </div>
                                    ))
                                  ) : (
                                    // Legacy structure: single item with sizes
                                    SIZES.map(size => {
                                      if (!order.sizes?.[size] || order.sizes[size] === 0) return null;
                                      const item = items.find(d => d.id === order.itemId);
                                      const itemName = item?.name || 'Unknown item';
                                      const price = item?.price || 0;
                                      
                                      return Array.from({ length: order.sizes[size] }, (_, index) => (
                                        <div key={`${size}-${index}`} className="flex justify-between items-center py-1 text-sm">
                                          <span className="text-gray-900">{itemName} - {size}</span>
                                          <span className="text-gray-900">${price.toFixed(2)}</span>
                                        </div>
                                      ));
                                    })
                                  )}
                                  
                                  {/* Subtotal */}
                                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                    <span className="text-sm font-semibold text-gray-700">Total:</span>
                                    <span className="text-sm font-semibold text-gray-900">${(order.totalPrice || 0).toFixed(2)}</span>
                                  </div>
                                  
                                  {/* Processing Fee */}
                                  {globalConfig?.processingFee && (
                                    <div className="flex justify-between items-center pt-1">
                                      <span className="text-sm font-semibold text-gray-700">Processing Fee:</span>
                                      <span className="text-sm font-semibold text-gray-900">
                                        ${calculateProcessingFee(globalConfig.processingFee, order.totalPrice || 0).toFixed(2)}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* Total Charged */}
                                  <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300">
                                    <span className="text-base font-bold text-gray-900">Total Charged:</span>
                                    <span className="text-lg font-bold text-indigo-600">
                                      ${(
                                        (order.totalPrice || 0) +
                                        (globalConfig?.processingFee ? calculateProcessingFee(globalConfig.processingFee, order.totalPrice || 0) : 0)
                                      ).toFixed(2)}
                                    </span>
                                  </div>
                                  
                                  {/* Payment/Transaction details */}
                                  {order.paymentId ? (
                                    <div className="flex justify-between items-center pt-2">
                                      <span className="text-sm text-gray-600">Square Transaction ID:</span>
                                      <span className="text-sm text-gray-900 font-mono">{order.paymentId}</span>
                                    </div>
                                  ) : order.isAdminOrder ? (
                                    <div className="flex justify-between items-center pt-2">
                                      <span className="text-sm text-gray-600">Payment:</span>
                                      <span className="text-sm text-gray-900">Admin order — no payment processed</span>
                                    </div>
                                  ) : null}
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                                  <div className="text-sm text-gray-600">
                                    <span className="font-semibold">Total Items:</span> {order.totalItems}
                                  </div>
                                  
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm('Delete this order?')) {
                                          handleDeleteOrder(order.id);
                                        }
                                      }}
                                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Delete Order"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-4 pt-2">
                <button
                  onClick={async () => {
                    // Cancel and return to store
                    setAdminError('');
                    setView('store');
                    setOrderSubmitted(false);
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
                    // Save all item edits
                    const itemsSaved = await saveAllItemEdits();
                    if (!itemsSaved) return;
                    
                    setAdminError('');
                    setView('store');
                    setOrderSubmitted(false);
                  }}
                  className="flex-1 max-w-xs py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save and Exit
                </button>
              </div>
              </>
              )}

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
                  {(() => {
                    // Calculate size totals from items array or use legacy sizes
                    const sizeTotals = { S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
                    if (order.items && Array.isArray(order.items)) {
                      order.items.forEach(item => {
                        sizeTotals[item.size] = (sizeTotals[item.size] || 0) + item.quantity;
                      });
                    } else if (order.sizes) {
                      Object.assign(sizeTotals, order.sizes);
                    }
                    
                    return SIZES.map(size => sizeTotals[size] > 0 ? (
                      <div key={size} className="flex flex-col items-center border-2 border-black rounded-lg p-4 min-w-[100px]">
                        <span className="text-2xl font-bold text-gray-500 border-b-2 border-black w-full text-center pb-2 mb-2">{size}</span>
                        <span className="text-5xl font-black">{sizeTotals[size]}</span>
                      </div>
                    ) : null);
                  })()}
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

    </>
  );
}