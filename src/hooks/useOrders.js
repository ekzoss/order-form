import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, appId } from '../firebase';

export function useOrders(user, view) {
  const [orders, setOrders] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [adminAccessDenied, setAdminAccessDenied] = useState(false);
  const [adminError, setAdminError] = useState('');

  useEffect(() => {
    if (!user || view !== 'adminDashboard') return;

    setAdminAccessDenied(false);
    setAdminError('');

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
      if (err?.code === 'permission-denied') {
        setAdminAccessDenied(true);
        setAdminError('Your account is allowed by the app, but Firestore denied admin access. Check that this UID is included in your Firestore admin rules.');
      } else {
        setAdminError("Failed to load orders.");
      }
    });

    return () => unsubscribe();
  }, [user, view]);

  const handleEditOrder = (order) => {
    setEditingOrderId(order.id);
    setEditFormData({
      name: order.name,
      items: order.items ? [...order.items] : [],
      notes: order.notes || ''
    });
  };

  const handleSaveEdit = async (orderId) => {
    try {
      const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_orders', orderId);
      
      // Calculate totals from items array
      const totalItems = editFormData.items.reduce((sum, item) => sum + item.quantity, 0);
      const totalPrice = editFormData.items.reduce((sum, item) => sum + item.subtotal, 0);
      
      await updateDoc(orderRef, {
        name: editFormData.name,
        items: editFormData.items,
        notes: editFormData.notes,
        totalItems: totalItems,
        totalPrice: totalPrice
      });
      
      setEditingOrderId(null);
      setEditFormData(null);
    } catch (err) {
      console.error('Error updating order:', err);
      alert('Failed to update order');
    }
  };

  const handleCancelEdit = () => {
    setEditingOrderId(null);
    setEditFormData(null);
  };

  const handleDeleteOrder = async (orderId) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_orders', orderId));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Error deleting order:', err);
      alert('Failed to delete order');
    }
  };

  return {
    orders,
    editingOrderId,
    editFormData,
    setEditFormData,
    deleteConfirmId,
    setDeleteConfirmId,
    adminAccessDenied,
    adminError,
    handleEditOrder,
    handleSaveEdit,
    handleCancelEdit,
    handleDeleteOrder
  };
}

// Made with Bob
