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

export function useItems(user, selectedItemId, setSelectedItemId) {
  const [items, setItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemForm, setItemForm] = useState(null);
  const [collapsedItems, setCollapsedItems] = useState({});
  const [deleteConfirmItemId, setDeleteConfirmItemId] = useState(null);
  const [itemEdits, setItemEdits] = useState({});

  useEffect(() => {
    if (!user) return;

    const itemsRef = collection(db, 'artifacts', appId, 'public', 'data', 'items');
    const unsubscribe = onSnapshot(itemsRef, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by order field (ascending), then by createdAt (descending) as fallback
      fetchedItems.sort((a, b) => {
        const aOrder = a.order !== undefined ? a.order : 999999;
        const bOrder = b.order !== undefined ? b.order : 999999;
        
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      
      setItems(fetchedItems);
      setIsLoadingItems(false);
      
      // Auto-select first item if none selected
      if (!selectedItemId && fetchedItems.length > 0) {
        setSelectedItemId(fetchedItems[0].id);
      }
    });

    return () => unsubscribe();
  }, [user, selectedItemId, setSelectedItemId]);

  const selectedItem = useMemo(() => {
    return items.find(d => d.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  const handleCreateItem = async () => {
    try {
      const existingNumbers = items
        .map(d => {
          const match = d.name.match(/^Item (\d+)$/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(n => n > 0);

      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      const defaultName = `Item ${nextNumber}`;
      const itemsRef = collection(db, 'artifacts', appId, 'public', 'data', 'items');
      
      const maxOrder = items.length > 0
        ? Math.max(...items.map(d => d.order !== undefined ? d.order : 0))
        : -1;
      
      const newItem = {
        name: defaultName,
        productHeader: defaultName,
        productDescription: '',
        price: 0,
        previewImage: null,
        status: 'open',
        order: maxOrder + 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const docRef = await addDoc(itemsRef, newItem);
      
      setCollapsedItems(prev => ({
        ...prev,
        [docRef.id]: false
      }));
      
      setSelectedItemId(docRef.id);
    } catch (err) {
      console.error('Error creating item:', err);
      alert('Failed to create item');
    }
  };

  const handleStartEditItem = (item) => {
    setEditingItemId(item.id);
    setItemForm({
      name: item.name,
      productHeader: item.productHeader,
      productDescription: item.productDescription,
      price: item.price
    });
  };

  const handleSaveItemEdit = async (itemId) => {
    try {
      const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'items', itemId);
      await updateDoc(itemRef, {
        name: itemForm.name,
        productHeader: itemForm.productHeader,
        productDescription: itemForm.productDescription,
        price: itemForm.price,
        updatedAt: Date.now()
      });
      setEditingItemId(null);
      setItemForm(null);
    } catch (err) {
      console.error('Error updating item:', err);
      alert('Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId, orders) => {
    const itemOrders = orders.filter(o => o.itemId === itemId);
    const confirmMessage = itemOrders.length > 0
      ? `⚠️ WARNING: This item has ${itemOrders.length} order(s).\n\nDeleting this item will result in permanent loss of:\n- item images and settings\n- All ${itemOrders.length} associated order(s)\n- Order history and customer data\n\nThis action CANNOT be undone!\n\nAre you absolutely sure you want to delete "${items.find(d => d.id === itemId)?.name}"?`
      : `Are you sure you want to delete "${items.find(d => d.id === itemId)?.name}"?`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'items', itemId));
      if (selectedItemId === itemId) {
        setSelectedItemId(items.find(d => d.id !== itemId)?.id || null);
      }
      setDeleteConfirmItemId(null);
    } catch (err) {
      console.error('Error deleting item:', err);
      alert('Failed to delete item');
    }
  };

  const toggleItemCollapse = (itemId) => {
    setCollapsedItems(prev => ({
      ...prev,
      [itemId]: prev[itemId] === false ? true : false
    }));
  };

  const handleMoveItem = async (itemId, direction) => {
    try {
      const currentIndex = items.findIndex(d => d.id === itemId);
      if (currentIndex === -1) return;
      
      if (direction === 'up' && currentIndex === 0) return;
      if (direction === 'down' && currentIndex === items.length - 1) return;
      
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const currentItem = items[currentIndex];
      const targetItem = items[targetIndex];
      
      const currentOrder = currentItem.order !== undefined ? currentItem.order : currentIndex;
      const targetOrder = targetItem.order !== undefined ? targetItem.order : targetIndex;
      
      const batch = writeBatch(db);
      
      const currentRef = doc(db, 'artifacts', appId, 'public', 'data', 'items', currentItem.id);
      batch.update(currentRef, { order: targetOrder, updatedAt: Date.now() });
      
      const targetRef = doc(db, 'artifacts', appId, 'public', 'data', 'items', targetItem.id);
      batch.update(targetRef, { order: currentOrder, updatedAt: Date.now() });
      
      await batch.commit();
    } catch (err) {
      console.error('Error reordering items:', err);
      alert('Failed to reorder items: ' + err.message);
    }
  };

  const handleUpdateItemField = (itemId, field, value) => {
    setItemEdits(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [field]: value
      }
    }));
  };

  const handleChangeItemStatus = async (itemId, newStatus) => {
    try {
      const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'items', itemId);
      await updateDoc(itemRef, {
        status: newStatus,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error('Error updating item status:', err);
      alert('Failed to update item status');
    }
  };

  const saveAllItemEdits = async () => {
    const editedItemIds = Object.keys(itemEdits);
    if (editedItemIds.length === 0) return true;

    try {
      // Filter out item IDs that don't exist in the items array
      // (they might have been deleted or not yet synced)
      const validItemIds = editedItemIds.filter(itemId =>
        items.some(d => d.id === itemId)
      );
      
      if (validItemIds.length === 0) {
        setItemEdits({});
        return true;
      }
      
      const promises = validItemIds.map(itemId => {
        const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'items', itemId);
        return updateDoc(itemRef, {
          ...itemEdits[itemId],
          updatedAt: Date.now()
        });
      });
      
      await Promise.all(promises);
      setItemEdits({});
      return true;
    } catch (err) {
      console.error('Error saving item edits:', err);
      alert('Failed to save item changes');
      return false;
    }
  };

  const handleSaveImageEditor = async (data, itemId) => {
    const {
      selectedBackground,
      foregroundImages,
      backgroundType,
      backgroundColor,
      customBackgroundImage
    } = data;
    
    if (!itemId) {
      throw new Error("No item specified");
    }
    
    try {
      // Helper function to aggressively compress base64 images for Firestore storage
      const compressBase64ForStorage = (base64String, maxWidth = 500, maxHeight = 500, quality = 0.7, preserveTransparency = true) => {
        return new Promise((resolve, reject) => {
          const img = new window.Image();
          img.src = base64String;
          
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions while maintaining aspect ratio
            if (width > maxWidth || height > maxHeight) {
              const widthRatio = maxWidth / width;
              const heightRatio = maxHeight / height;
              const ratio = Math.min(widthRatio, heightRatio);
              
              width = width * ratio;
              height = height * ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d', { alpha: true });
            ctx.drawImage(img, 0, 0, width, height);
            
            // Use PNG for transparency support, JPEG only for solid backgrounds
            const format = preserveTransparency ? 'image/png' : 'image/jpeg';
            const compressed = canvas.toDataURL(format, quality);
            resolve(compressed);
          };
          
          img.onerror = (err) => {
            reject(new Error('Failed to load image for compression: ' + err));
          };
        });
      };
      
      const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'items', itemId);
      
      // Compress all images before storing to avoid Firestore size limits
      // Background: Use PNG with transparency for SVG t-shirts, JPEG for solid colors
      const backgroundNeedsTransparency = backgroundType === 'svg';
      const compressedBackground = await compressBase64ForStorage(
        selectedBackground,
        500,
        500,
        0.7,
        backgroundNeedsTransparency
      );
      
      // Compress foreground images only if they exist - always preserve transparency
      // Use smaller size for foreground images to reduce total document size
      const compressedForegroundImages = foregroundImages && foregroundImages.length > 0
        ? await Promise.all(
            foregroundImages.map(async (img) => ({
              ...img,
              image: await compressBase64ForStorage(img.image, 400, 400, 0.65, true)
            }))
          )
        : [];
      
      // Compress custom background if present - may need transparency
      const compressedCustomBackground = customBackgroundImage
        ? await compressBase64ForStorage(customBackgroundImage, 500, 500, 0.7, true)
        : null;
      
      // Store only the composition metadata - preview will be rendered dynamically
      const metaData = {
        selectedBackground: compressedBackground,
        foregroundImages: compressedForegroundImages,
        backgroundType,
        backgroundColor
      };
      
      // Only include customBackgroundImage if it exists
      if (compressedCustomBackground) {
        metaData.customBackgroundImage = compressedCustomBackground;
      }
      
      await updateDoc(itemRef, {
        previewImageMeta: metaData,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error('Error in handleSaveImageEditor:', err);
      throw err;
    }
  };

  return {
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
    handleSaveImageEditor
  };
}

// Made with Bob
