import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  Lock,
  LogOut,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
} from 'firebase/firestore';
import './index.css';

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

const ADMIN_PASSWORD = 'admin123';

const createEmptyShirt = (index = 1) => ({
  id: `shirt-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
  title: '',
  frontImage: null,
  backImage: null,
});

const DEFAULT_CONFIG = {
  pageTitle: 'Shirt Design Preview & Feedback',
  productHeader: 'New Shirt Design Preview',
  productDescription: 'Preview the proposed shirt designs below, then share any feedback you have in the feedback box.',
  shirts: [createEmptyShirt(1)],
};

const normalizeConfig = (data = {}) => {
  const merged = {
    ...DEFAULT_CONFIG,
    ...data,
  };

  const shirts = Array.isArray(data.shirts) && data.shirts.length > 0
    ? data.shirts.map((shirt, index) => ({
        id: shirt.id || createEmptyShirt(index + 1).id,
        title: shirt.title || '',
        frontImage: shirt.frontImage || null,
        backImage: shirt.backImage || null,
      }))
    : [createEmptyShirt(1)];

  return {
    pageTitle: merged.pageTitle || DEFAULT_CONFIG.pageTitle,
    productHeader: merged.productHeader || DEFAULT_CONFIG.productHeader,
    productDescription: merged.productDescription || DEFAULT_CONFIG.productDescription,
    shirts,
  };
};

const compressImage = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (event) => {
    const img = new window.Image();
    img.src = event.target.result;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1000;
      const MAX_HEIGHT = 1000;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else if (height > MAX_HEIGHT) {
        width *= MAX_HEIGHT / height;
        height = MAX_HEIGHT;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
  };
});

function PreviewApp() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('preview');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const [previewConfig, setPreviewConfig] = useState(DEFAULT_CONFIG);
  const [configForm, setConfigForm] = useState(DEFAULT_CONFIG);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [uploadingImageKey, setUploadingImageKey] = useState(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [passwordInput, setPasswordInput] = useState('');
  const [adminError, setAdminError] = useState('');
  const [feedbackEntries, setFeedbackEntries] = useState([]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Auth error:', err);
        setError('Failed to connect to the feedback system.');
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'shirt_feedback_config', 'main');
    const unsubscribeConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const normalized = normalizeConfig(docSnap.data());
        setPreviewConfig(normalized);
        setConfigForm(normalized);
      } else {
        setPreviewConfig(DEFAULT_CONFIG);
        setConfigForm(DEFAULT_CONFIG);
      }
    });

    return () => unsubscribeConfig();
  }, [user]);

  useEffect(() => {
    if (!user || view !== 'adminDashboard') return;

    const feedbackRef = collection(db, 'artifacts', appId, 'public', 'data', 'shirt_feedback_entries');
    const q = query(feedbackRef);

    const unsubscribeFeedback = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map((entryDoc) => ({
        id: entryDoc.id,
        ...entryDoc.data(),
      }));
      entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setFeedbackEntries(entries);
    }, (err) => {
      console.error('Error fetching feedback:', err);
      setAdminError('Failed to load feedback.');
    });

    return () => unsubscribeFeedback();
  }, [user, view]);

  const feedbackCount = useMemo(() => feedbackEntries.length, [feedbackEntries]);

  const updateShirtInConfigForm = (shirtId, updater) => {
    setConfigForm((prev) => ({
      ...prev,
      shirts: prev.shirts.map((shirt) => (
        shirt.id === shirtId ? updater(shirt) : shirt
      )),
    }));
  };

  const handleImageUpload = async (e, shirtId, side) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadKey = `${shirtId}-${side}`;
    setUploadingImageKey(uploadKey);

    try {
      const compressedBase64 = await compressImage(file);
      setConfigForm((prev) => ({
        ...prev,
        shirts: prev.shirts.map((shirt) => (
          shirt.id === shirtId ? { ...shirt, [side]: compressedBase64 } : shirt
        )),
      }));
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to compress and upload image. Please try a smaller image.');
    } finally {
      setUploadingImageKey(null);
      e.target.value = '';
    }
  };

  const handleAddShirt = () => {
    setConfigForm((prev) => ({
      ...prev,
      shirts: [...prev.shirts, createEmptyShirt(prev.shirts.length + 1)],
    }));
  };

  const handleDeleteShirt = (shirtId) => {
    if (configForm.shirts.length <= 1) {
      alert('At least one preview shirt is required.');
      return;
    }

    const confirmed = window.confirm('Delete this preview shirt?');
    if (!confirmed) return;

    setConfigForm((prev) => ({
      ...prev,
      shirts: prev.shirts.filter((shirt) => shirt.id !== shirtId),
    }));
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'shirt_feedback_config', 'main');
      await setDoc(configRef, normalizeConfig(configForm), { merge: true });
      alert('Preview settings updated successfully.');
    } catch (err) {
      console.error('Save config error:', err);
      alert('Failed to save preview settings.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedFeedback = feedbackText.trim();
    if (!trimmedFeedback) {
      setError('Please enter feedback before submitting.');
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const feedbackRef = collection(db, 'artifacts', appId, 'public', 'data', 'shirt_feedback_entries');
      await addDoc(feedbackRef, {
        message: trimmedFeedback,
        timestamp: Date.now(),
      });

      setFeedbackText('');
      setFeedbackSubmitted(true);
    } catch (err) {
      console.error('Submit feedback error:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setView('adminDashboard');
      setPasswordInput('');
      setAdminError('');
      return;
    }

    setAdminError('Incorrect password.');
  };

  const handleDeleteFeedback = async (id) => {
    const confirmed = window.confirm('Delete this feedback entry?');
    if (!confirmed) return;

    try {
      const entryRef = doc(db, 'artifacts', appId, 'public', 'data', 'shirt_feedback_entries', id);
      await deleteDoc(entryRef);
    } catch (err) {
      console.error('Delete feedback error:', err);
      alert('Failed to delete feedback entry.');
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
        Loading feedback page...
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 font-sans text-gray-800 selection:bg-indigo-100 flex flex-col relative">
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
              alt="Zoomed shirt design preview"
              className="max-w-full max-h-full object-contain cursor-zoom-out shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <div
              className="flex items-center gap-2 font-bold text-xl text-indigo-600 cursor-pointer"
              onClick={() => {
                setView('preview');
                setFeedbackSubmitted(false);
                setError('');
              }}
            >
              <span>{previewConfig.pageTitle || DEFAULT_CONFIG.pageTitle}</span>
            </div>

            {view === 'adminDashboard' && (
              <button
                onClick={() => setView('preview')}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors bg-gray-100 px-3 py-1.5 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                Exit Admin
              </button>
            )}
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-8 w-full flex-grow">
          {view === 'preview' && (
            <div className="space-y-8">
              <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
                  {previewConfig.productHeader || DEFAULT_CONFIG.productHeader}
                </h1>
                <div
                  className="text-gray-600 whitespace-pre-wrap [&_a]:text-indigo-600 [&_a]:underline hover:[&_a]:text-indigo-800"
                  dangerouslySetInnerHTML={{
                    __html: previewConfig.productDescription || DEFAULT_CONFIG.productDescription,
                  }}
                />
              </section>

              <section className="space-y-8">
                {previewConfig.shirts.map((shirt, index) => (
                  <div key={shirt.id} className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                    <div className="mb-6">
                      <div className="text-sm font-semibold uppercase tracking-wider text-indigo-600 mb-1">
                        Shirt {index + 1}
                      </div>
                      {shirt.title?.trim() && (
                        <h2 className="text-2xl font-bold text-gray-900">{shirt.title}</h2>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      {['front', 'back'].map((side) => (
                        <div key={side}>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                              {side === 'front' ? 'Front View' : 'Back View'}
                            </h3>
                          </div>
                          <div className="aspect-square bg-gray-50 rounded-xl flex items-center justify-center relative overflow-hidden group border border-gray-200 shadow-inner">
                            {shirt[`${side}Image`] ? (
                              <>
                                <img
                                  src={shirt[`${side}Image`]}
                                  alt={`${shirt.title?.trim() || `Shirt ${index + 1}`} ${side} preview`}
                                  className="w-full h-full object-cover cursor-zoom-in group-hover:scale-[1.02] transition-transform duration-300"
                                  onClick={() => setZoomedImage(shirt[`${side}Image`])}
                                />
                                <button
                                  onClick={() => setZoomedImage(shirt[`${side}Image`])}
                                  className="absolute bottom-4 right-4 bg-white/90 p-2.5 rounded-full shadow-md hover:bg-white transition-colors text-gray-700 hover:text-indigo-600 opacity-0 group-hover:opacity-100"
                                  title="Zoom Image"
                                >
                                  <ZoomIn className="w-5 h-5" />
                                </button>
                              </>
                            ) : (
                              <div className="text-gray-400 flex flex-col items-center">
                                <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                                <span className="text-sm">No {side} preview uploaded yet</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>

              <section className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
                {feedbackSubmitted ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Feedback Submitted</h2>
                    <p className="text-gray-600 mb-8">
                      Thank you for sharing your thoughts on the new shirt designs.
                    </p>
                    <button
                      onClick={() => {
                        setFeedbackSubmitted(false);
                        setError('');
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
                    >
                      Submit more feedback
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitFeedback} className="space-y-6">
                    {error && (
                      <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="feedback">
                        Feedback *
                      </label>
                      <textarea
                        id="feedback"
                        required
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-y min-h-[180px]"
                        placeholder="Share your feedback about any of the shirt previews above..."
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingFeedback}
                      className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-all flex justify-center items-center gap-2 ${
                        isSubmittingFeedback
                          ? 'bg-indigo-300 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg'
                      }`}
                    >
                      <Send className="w-4 h-4" />
                      {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                    </button>
                  </form>
                )}
              </section>
            </div>
          )}

          {view === 'adminLogin' && (
            <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mt-12">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Admin Access</h2>
                <p className="text-gray-500 text-sm mt-1">Enter the password to manage previews and read feedback.</p>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-4">
                {adminError && (
                  <p className="text-red-600 text-sm text-center bg-red-50 p-2 rounded">{adminError}</p>
                )}
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
                  onClick={() => setView('preview')}
                  className="w-full py-2 text-gray-500 hover:text-gray-800 text-sm flex items-center justify-center gap-1 mt-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Preview
                </button>
              </form>
            </div>
          )}

          {view === 'adminDashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Preview Admin Dashboard</h1>
                  <p className="text-gray-500">Manage design previews and review submitted feedback.</p>
                </div>
                <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                  <span className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Feedback Count</span>
                  <span className="text-2xl font-bold text-indigo-600">{feedbackCount}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <form onSubmit={handleSaveConfig} className="space-y-8">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Preview Page Settings</h2>
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Page Title</label>
                          <input
                            type="text"
                            value={configForm.pageTitle}
                            onChange={(e) => setConfigForm({ ...configForm, pageTitle: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Header</label>
                          <input
                            type="text"
                            value={configForm.productHeader}
                            onChange={(e) => setConfigForm({ ...configForm, productHeader: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={configForm.productDescription}
                          onChange={(e) => setConfigForm({ ...configForm, productDescription: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y min-h-[110px]"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 border-b pb-4">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">Preview Shirts</h2>
                        <p className="text-sm text-gray-500">Add, remove, and upload front/back images for each preview shirt.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddShirt}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Preview Shirt
                      </button>
                    </div>

                    <div className="space-y-6">
                      {configForm.shirts.map((shirt, index) => (
                        <div key={shirt.id} className="rounded-xl border border-gray-200 p-5 bg-gray-50">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                            <div className="flex-1">
                              <div className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-2">
                                Shirt {index + 1}
                              </div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Shirt Title <span className="text-gray-400 font-normal">(Optional)</span>
                              </label>
                              <input
                                type="text"
                                value={shirt.title}
                                onChange={(e) => updateShirtInConfigForm(shirt.id, (current) => ({ ...current, title: e.target.value }))}
                                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                                placeholder=""
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteShirt(shirt.id)}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg transition-colors border border-red-200"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Shirt
                            </button>
                          </div>

                          <div className="grid md:grid-cols-2 gap-6">
                            {[
                              { side: 'frontImage', label: 'Front Preview' },
                              { side: 'backImage', label: 'Back Preview' },
                            ].map(({ side, label }) => (
                              <div key={side}>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
                                <div className="flex items-center gap-4">
                                  <div className="w-20 h-20 bg-white rounded border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                    {shirt[side] ? (
                                      <img src={shirt[side]} alt={label} className="w-full h-full object-cover" />
                                    ) : (
                                      <ImageIcon className="w-6 h-6 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="flex-grow">
                                    <label className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors text-sm font-medium border border-indigo-200">
                                      <Upload className="w-4 h-4" />
                                      <span>{label === 'Front Preview' ? 'Upload Front' : 'Upload Back'}</span>
                                      <input
                                        type="file"
                                        accept="image/jpeg, image/png"
                                        className="hidden"
                                        onChange={(e) => handleImageUpload(e, shirt.id, side)}
                                        disabled={uploadingImageKey === `${shirt.id}-${side}`}
                                      />
                                    </label>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {uploadingImageKey && (
                      <p className="text-sm text-indigo-600 font-bold mt-4 animate-pulse flex items-center gap-2">
                        <Upload className="w-4 h-4 animate-bounce" /> Compressing and preparing preview image...
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingConfig ? 'Saving...' : 'Save Settings'}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Submitted Feedback</h2>
                    <p className="text-sm text-gray-500">Newest submissions appear first.</p>
                  </div>
                </div>

                {feedbackEntries.length === 0 ? (
                  <div className="px-6 py-10 text-center text-gray-500">No feedback has been submitted yet.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {feedbackEntries.map((entry) => (
                      <div key={entry.id} className="px-6 py-5 flex flex-col md:flex-row md:items-start gap-4 md:justify-between">
                        <div className="min-w-0">
                          <p className="text-gray-900 whitespace-pre-wrap break-words">{entry.message}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Unknown time'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteFeedback(entry.id)}
                          className="shrink-0 px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        <footer className="mt-auto py-8 text-center flex justify-center">
          {view === 'preview' && (
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
    </>
  );
}

export default PreviewApp;

// Made with Bob
