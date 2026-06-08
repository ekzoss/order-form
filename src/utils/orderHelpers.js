import { collection, addDoc } from 'firebase/firestore';
import { db, appId } from '../firebase';
import { SIZES } from '../constants';
import emailjs from '@emailjs/browser';

export async function submitMultiItemOrder({
  orderModalName,
  orderModalNotes,
  sizesByItem,
  items,
  globalConfig,
  totalItems,
  totalPrice,
  paymentId = null,
  isAdminOrder = false,
  adminUser = null
}) {
  if (!orderModalName.trim()) {
    throw new Error('Please enter your name');
  }

  const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
  const timestamp = Date.now();
  
  // Build items array with item+size quantities
  const orderItems = [];
  const orderDetails = [];
  
  for (const [itemId, itemSizes] of Object.entries(sizesByItem)) {
    const item = items.find(d => d.id === itemId);
    if (!item) continue;
    
    // Add each size with quantity > 0 to items array
    for (const size of SIZES) {
      const quantity = itemSizes[size] || 0;
      if (quantity > 0) {
        orderItems.push({
          itemId: itemId,
          itemName: item.name,
          size: size,
          quantity: quantity,
          subtotal: quantity * item.price
        });
      }
    }
    
    // Build order details for email
    const totalItemsForItem = Object.values(itemSizes).reduce((sum, qty) => sum + qty, 0);
    if (totalItemsForItem > 0) {
      orderDetails.push({
        itemName: item.name,
        sizes: itemSizes,
        totalItems: totalItemsForItem,
        totalPrice: totalItemsForItem * item.price
      });
    }
  }
  
  // Create single order with items array
  const orderData = {
    name: orderModalName.trim(),
    notes: orderModalNotes.trim(),
    items: orderItems,
    totalItems: totalItems,
    totalPrice: totalPrice,
    timestamp: timestamp,
    createdAt: timestamp,
    status: 'open',
    isAdminOrder,
    ...(paymentId && { paymentId: paymentId }),
    ...(isAdminOrder && adminUser ? {
      adminOrderCreatedBy: {
        uid: adminUser.uid,
        email: adminUser.email || '',
        displayName: adminUser.displayName || ''
      }
    } : {})
  };
  
  await addDoc(ordersRef, orderData);
  
  // Send email notification if EmailJS is configured
  const emailjsServiceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const emailjsTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const emailjsPublicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  
  if (emailjsServiceId && emailjsTemplateId && emailjsPublicKey && globalConfig.notificationEmail) {
    try {
      const orderSummary = orderDetails.map(order => {
        const sizesText = SIZES
          .filter(size => order.sizes[size] > 0)
          .map(size => `${size}: ${order.sizes[size]}`)
          .join(', ');
        return `${order.itemName} - ${sizesText} (${order.totalItems} items - $${order.totalPrice.toFixed(2)})`;
      }).join('\n');
      
      const emailBody = `Name: ${orderModalName.trim()}
Order Type: ${isAdminOrder ? 'Admin order (payment bypassed)' : 'Standard order'}
${isAdminOrder && adminUser ? `Created By: ${adminUser.displayName || adminUser.email || adminUser.uid}` : ''}
Total Items: ${totalItems}
Total Price: $${totalPrice.toFixed(2)}
Notes: ${orderModalNotes.trim() || 'None'}

Order Details:
${orderSummary}

Order Date: ${new Date().toLocaleString()}`;
      
      const emailParams = {
        to_email: globalConfig.notificationEmail,
        email: globalConfig.notificationEmail,
        subject: `${isAdminOrder ? 'New Admin Order' : 'New Order'} from ${orderModalName.trim()}`,
        body: emailBody
      };
      
      await emailjs.send(
        emailjsServiceId,
        emailjsTemplateId,
        emailParams,
        emailjsPublicKey
      );
    } catch (emailErr) {
      console.error('Error sending email notification:', emailErr);
      // Don't fail the order if email fails
    }
  }
}

export async function submitFeedback({
  itemId,
  feedback,
  items,
  globalConfig
}) {
  if (!feedback.trim()) {
    throw new Error('Please enter your feedback before submitting.');
  }

  const item = items.find(d => d.id === itemId);
  if (!item) {
    throw new Error('item not found');
  }

  const feedbackRef = collection(db, 'artifacts', appId, 'public', 'data', 'feedback');
  const feedbackDoc = {
    itemId: itemId,
    itemName: item.name,
    feedback: feedback,
    timestamp: Date.now(),
    createdAt: new Date().toISOString()
  };
  
  await addDoc(feedbackRef, feedbackDoc);

  // Send notification email if EmailJS is configured
  const emailjsServiceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const emailjsTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const emailjsPublicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  
  if (emailjsServiceId && emailjsTemplateId && emailjsPublicKey && globalConfig.notificationEmail) {
    const emailBody = `${feedback}

Submitted: ${new Date().toLocaleString()}`;

    const emailParams = {
      to_email: globalConfig.notificationEmail,
      email: globalConfig.notificationEmail,
      subject: `New Feedback for ${item.name}`,
      body: emailBody
    };

    await emailjs.send(
      emailjsServiceId,
      emailjsTemplateId,
      emailParams,
      emailjsPublicKey
    );
  }
}

// Made with Bob
