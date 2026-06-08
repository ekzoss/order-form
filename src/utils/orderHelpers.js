import { collection, addDoc } from 'firebase/firestore';
import { db, appId } from '../firebase';
import { SIZES } from '../constants';
import emailjs from '@emailjs/browser';

export async function submitMultiDesignOrder({
  orderModalName,
  orderModalNotes,
  sizesByDesign,
  designs,
  globalConfig,
  totalItems,
  totalPrice,
  paymentId = null
}) {
  if (!orderModalName.trim()) {
    throw new Error('Please enter your name');
  }

  const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
  const timestamp = Date.now();
  
  // Build items array with design+size quantities
  const items = [];
  const orderDetails = [];
  
  for (const [designId, designSizes] of Object.entries(sizesByDesign)) {
    const design = designs.find(d => d.id === designId);
    if (!design) continue;
    
    // Add each size with quantity > 0 to items array
    for (const size of SIZES) {
      const quantity = designSizes[size] || 0;
      if (quantity > 0) {
        items.push({
          designId: designId,
          designName: design.name,
          size: size,
          quantity: quantity,
          subtotal: quantity * design.price
        });
      }
    }
    
    // Build order details for email
    const totalItemsForDesign = Object.values(designSizes).reduce((sum, qty) => sum + qty, 0);
    if (totalItemsForDesign > 0) {
      orderDetails.push({
        designName: design.name,
        sizes: designSizes,
        totalItems: totalItemsForDesign,
        totalPrice: totalItemsForDesign * design.price
      });
    }
  }
  
  // Create single order with items array
  const orderData = {
    name: orderModalName.trim(),
    notes: orderModalNotes.trim(),
    items: items,
    totalItems: totalItems,
    totalPrice: totalPrice,
    timestamp: timestamp,
    createdAt: timestamp,
    ...(paymentId && { paymentId: paymentId })
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
        return `${order.designName} - ${sizesText} (${order.totalItems} items - $${order.totalPrice.toFixed(2)})`;
      }).join('\n');
      
      const emailBody = `Name: ${orderModalName.trim()}
Total Items: ${totalItems}
Total Price: $${totalPrice.toFixed(2)}
Notes: ${orderModalNotes.trim() || 'None'}

Order Details:
${orderSummary}

Order Date: ${new Date().toLocaleString()}`;
      
      const emailParams = {
        to_email: globalConfig.notificationEmail,
        email: globalConfig.notificationEmail,
        subject: `New Order from ${orderModalName.trim()}`,
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
  designId,
  feedback,
  designs,
  globalConfig
}) {
  if (!feedback.trim()) {
    throw new Error('Please enter your feedback before submitting.');
  }

  const design = designs.find(d => d.id === designId);
  if (!design) {
    throw new Error('Design not found');
  }

  const feedbackRef = collection(db, 'artifacts', appId, 'public', 'data', 'feedback');
  const feedbackDoc = {
    designId: designId,
    designName: design.name,
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
      subject: `New Feedback for ${design.name}`,
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
