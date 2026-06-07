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
      sizes: { ...order.sizes },
      notes: order.notes || ''
    });
  };

  const handleSaveEdit = async (orderId) => {
    try {
      const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_orders', orderId);
      const totalItems = Object.values(editFormData.sizes).reduce((sum, qty) => sum + qty, 0);
      
      // Get the order to find its price per shirt
      const order = orders.find(o => o.id === orderId);
      const pricePerShirt = order?.pricePerShirt || 0;
      
      await updateDoc(orderRef, {
        name: editFormData.name,
        sizes: editFormData.sizes,
        notes: editFormData.notes,
        totalItems: totalItems,
        totalPrice: totalItems * pricePerShirt
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

  const handleTogglePaid = async (orderId, currentPaidStatus) => {
    try {
      const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_orders', orderId);
      await updateDoc(orderRef, {
        isPaid: !currentPaidStatus
      });
    } catch (err) {
      console.error('Error updating payment status:', err);
      alert('Failed to update payment status');
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
    handleDeleteOrder,
    handleTogglePaid
  };
}

// Made with Bob
