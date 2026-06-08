import { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  writeBatch 
} from 'firebase/firestore';
import { db, appId } from '../firebase';

export function useDesigns(user, selectedDesignId, setSelectedDesignId) {
  const [designs, setDesigns] = useState([]);
  const [isLoadingDesigns, setIsLoadingDesigns] = useState(true);
  const [editingDesignId, setEditingDesignId] = useState(null);
  const [designForm, setDesignForm] = useState(null);
  const [collapsedDesigns, setCollapsedDesigns] = useState({});
  const [deleteConfirmDesignId, setDeleteConfirmDesignId] = useState(null);
  const [designEdits, setDesignEdits] = useState({});

  useEffect(() => {
    if (!user) return;

    const designsRef = collection(db, 'artifacts', appId, 'public', 'data', 'items');
    const unsubscribe = onSnapshot(designsRef, (snapshot) => {
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
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      
      setDesigns(fetchedDesigns);
      setIsLoadingDesigns(false);
      
      // Auto-select first design if none selected
      if (!selectedDesignId && fetchedDesigns.length > 0) {
        setSelectedDesignId(fetchedDesigns[0].id);
      }
    });

    return () => unsubscribe();
  }, [user, selectedDesignId, setSelectedDesignId]);

  const selectedDesign = useMemo(() => {
    return designs.find(d => d.id === selectedDesignId) || null;
  }, [designs, selectedDesignId]);

  const handleCreateDesign = async () => {
    try {
      const existingNumbers = designs
        .map(d => {
          const match = d.name.match(/^Item (\d+)$/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(n => n > 0);

      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      const defaultName = `Item ${nextNumber}`;
      const designsRef = collection(db, 'artifacts', appId, 'public', 'data', 'items');
      
      const maxOrder = designs.length > 0
        ? Math.max(...designs.map(d => d.order !== undefined ? d.order : 0))
        : -1;
      
      const newDesign = {
        name: defaultName,
        productHeader: defaultName,
        productDescription: '',
        price: 0,
        frontImage: null,
        backImage: null,
        status: 'open',
        order: maxOrder + 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const docRef = await addDoc(designsRef, newDesign);
      
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
      price: design.price
    });
  };

  const handleSaveDesignEdit = async (designId) => {
    try {
      const designRef = doc(db, 'artifacts', appId, 'public', 'data', 'items', designId);
      await updateDoc(designRef, {
        name: designForm.name,
        productHeader: designForm.productHeader,
        productDescription: designForm.productDescription,
        price: designForm.price,
        updatedAt: Date.now()
      });
      setEditingDesignId(null);
      setDesignForm(null);
    } catch (err) {
      console.error('Error updating design:', err);
      alert('Failed to update design');
    }
  };

  const handleDeleteDesign = async (designId, orders) => {
    const designOrders = orders.filter(o => o.designId === designId);
    const confirmMessage = designOrders.length > 0
      ? `⚠️ WARNING: This design has ${designOrders.length} order(s).\n\nDeleting this design will result in permanent loss of:\n- Design images and settings\n- All ${designOrders.length} associated order(s)\n- Order history and customer data\n\nThis action CANNOT be undone!\n\nAre you absolutely sure you want to delete "${designs.find(d => d.id === designId)?.name}"?`
      : `Are you sure you want to delete "${designs.find(d => d.id === designId)?.name}"?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'items', designId));
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
      
      if (direction === 'up' && currentIndex === 0) return;
      if (direction === 'down' && currentIndex === designs.length - 1) return;
      
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const currentDesign = designs[currentIndex];
      const targetDesign = designs[targetIndex];
      
      const currentOrder = currentDesign.order !== undefined ? currentDesign.order : currentIndex;
      const targetOrder = targetDesign.order !== undefined ? targetDesign.order : targetIndex;
      
      const batch = writeBatch(db);
      
      const currentRef = doc(db, 'artifacts', appId, 'public', 'data', 'items', currentDesign.id);
      batch.update(currentRef, { order: targetOrder, updatedAt: Date.now() });
      
      const targetRef = doc(db, 'artifacts', appId, 'public', 'data', 'items', targetDesign.id);
      batch.update(targetRef, { order: currentOrder, updatedAt: Date.now() });
      
      await batch.commit();
    } catch (err) {
      console.error('Error reordering designs:', err);
      alert('Failed to reorder designs: ' + err.message);
    }
  };

  const handleUpdateDesignField = (designId, field, value) => {
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
      const designRef = doc(db, 'artifacts', appId, 'public', 'data', 'items', designId);
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
      // Filter out design IDs that don't exist in the designs array
      // (they might have been deleted or not yet synced)
      const validDesignIds = editedDesignIds.filter(designId =>
        designs.some(d => d.id === designId)
      );
      
      if (validDesignIds.length === 0) {
        setDesignEdits({});
        return true;
      }
      
      const promises = validDesignIds.map(designId => {
        const designRef = doc(db, 'artifacts', appId, 'public', 'data', 'items', designId);
        return updateDoc(designRef, {
          ...designEdits[designId],
          updatedAt: Date.now()
        });
      });
      
      await Promise.all(promises);
      setDesignEdits({});
      return true;
    } catch (err) {
      console.error('Error saving design edits:', err);
      alert('Failed to save design changes');
      return false;
    }
  };

  const handleSaveImageEditor = async (data, side, designId) => {
    const { previewImage: newPreviewImage } = data;
    
    if (!side || !designId) {
      throw new Error("No side or design specified");
    }
    
    try {
      const designRef = doc(db, 'artifacts', appId, 'public', 'data', 'items', designId);
      await updateDoc(designRef, {
        [side]: newPreviewImage,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error('Error in handleSaveImageEditor:', err);
      throw err;
    }
  };

  return {
    designs,
    isLoadingDesigns,
    selectedDesign,
    editingDesignId,
    setEditingDesignId,
    designForm,
    setDesignForm,
    collapsedDesigns,
    deleteConfirmDesignId,
    setDeleteConfirmDesignId,
    designEdits,
    handleCreateDesign,
    handleStartEditDesign,
    handleSaveDesignEdit,
    handleDeleteDesign,
    toggleDesignCollapse,
    handleMoveDesign,
    handleUpdateDesignField,
    handleChangeDesignStatus,
    saveAllDesignEdits,
    handleSaveImageEditor
  };
}

// Made with Bob
