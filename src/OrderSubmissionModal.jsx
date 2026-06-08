import React, { useState, useMemo } from 'react';
import { CheckCircle2, RefreshCw, X } from 'lucide-react';
import { SIZES } from './constants';
import SquarePaymentForm from './SquarePaymentForm';
import { calculateProcessingFee } from './feeUtils';
import emailjs from '@emailjs/browser';

const OrderSubmissionModal = ({
  showOrderModal,
  orderSubmitted,
  handleCloseOrderModal,
  sizesByDesign,
  designs,
  totalPrice,
  orderModalName,
  setOrderModalName,
  orderModalNotes,
  setOrderModalNotes,
  handleSubmitMultiDesignOrder,
  isSubmitting,
  globalConfig
}) => {
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  // Calculate processing fee (must be before early return)
  const processingFee = useMemo(() => {
    if (!globalConfig?.processingFee) return 0;
    return calculateProcessingFee(globalConfig.processingFee, totalPrice);
  }, [globalConfig?.processingFee, totalPrice]);

  // Calculate total with processing fee
  const totalWithFee = totalPrice + processingFee;

  if (!showOrderModal) return null;

  const handlePaymentSuccess = async (paymentData) => {
    console.log('Payment successful:', paymentData);
    setIsProcessingOrder(true);
    // Submit the order after successful payment with payment ID
    await handleSubmitMultiDesignOrder(paymentData.id);
    setPaymentCompleted(true);
    setIsProcessingOrder(false);
  };

  const handlePaymentError = async (error) => {
    console.error('Payment error:', error);
    
    // Send notification email about payment failure
    const emailjsServiceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const emailjsTemplateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const emailjsPublicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (emailjsServiceId && emailjsTemplateId && emailjsPublicKey && globalConfig?.notificationEmail) {
      try {
        // Build order details for email
        const orderDetails = Object.entries(sizesByDesign)
          .flatMap(([designId, designSizes]) => {
            const design = designs.find(d => d.id === designId);
            if (!design) return [];
            
            return SIZES
              .filter(size => designSizes[size] > 0)
              .flatMap(size => {
                return Array.from({ length: designSizes[size] }, () =>
                  `${design.name} - ${size}: $${design.pricePerShirt.toFixed(2)}`
                );
              });
          })
          .join('\n');
        
        const processingFee = calculateProcessingFee(globalConfig.processingFee, totalPrice);
        const totalWithFee = totalPrice + processingFee;
        
        const emailParams = {
          to_email: globalConfig.notificationEmail,
          subject: `⚠️ Payment Failed - ${orderModalName}`,
          message: `PAYMENT FAILURE ALERT

Customer Name: ${orderModalName}
Amount Attempted: $${totalWithFee.toFixed(2)}
Error: ${error}

Order Details:
${orderDetails}

Subtotal: $${totalPrice.toFixed(2)}
Processing Fee: $${processingFee.toFixed(2)}
Total: $${totalWithFee.toFixed(2)}

Notes: ${orderModalNotes || 'None'}

Time: ${new Date().toLocaleString()}

Please follow up with the customer.`
        };
        
        await emailjs.send(
          emailjsServiceId,
          emailjsTemplateId,
          emailParams,
          emailjsPublicKey
        );
        
        console.log('Payment failure notification sent');
      } catch (emailError) {
        console.error('Failed to send payment failure notification:', emailError);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {orderSubmitted ? 'Order Confirmed!' : 'Review and Pay'}
            </h2>
            <button
              onClick={handleCloseOrderModal}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-6 space-y-2">
            <h3 className="font-semibold text-gray-700 mb-3">Order Summary:</h3>
            {Object.entries(sizesByDesign).flatMap(([designId, designSizes]) => {
              const design = designs.find(d => d.id === designId);
              if (!design) return [];

              // Create a line item for each size with quantity > 0
              return SIZES
                .filter(size => designSizes[size] > 0)
                .flatMap(size => {
                  // Create multiple line items if quantity > 1
                  return Array.from({ length: designSizes[size] }, (_, index) => ({
                    key: `${designId}-${size}-${index}`,
                    designName: design.name,
                    size: size,
                    price: design.pricePerShirt
                  }));
                });
            }).map(item => (
              <div key={item.key} className="flex justify-between items-center py-1">
                <p className="text-sm text-gray-900">{item.designName} - {item.size}</p>
                <p className="text-sm text-gray-900">${item.price.toFixed(2)}</p>
              </div>
            ))}

            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
              <p className="text-base font-semibold text-gray-700">Subtotal:</p>
              <p className="text-base font-semibold text-gray-900">${totalPrice.toFixed(2)}</p>
            </div>

            {processingFee > 0 && (
              <div className="flex justify-between items-center pt-1">
                <p className="text-base font-semibold text-gray-700">Processing Fee:</p>
                <p className="text-base font-semibold text-gray-900">${processingFee.toFixed(2)}</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
              <p className="text-base font-bold text-gray-900">Total:</p>
              <p className="text-xl font-bold text-indigo-600">${totalWithFee.toFixed(2)}</p>
            </div>
          </div>

          {!orderSubmitted && !isProcessingOrder ? (
            <>
              <div className="mb-4">
                <label className="block text-base font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={orderModalName}
                  onChange={(e) => setOrderModalName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="Enter your name"
                  required
                />
              </div>

              <div className="mb-6">
                <label className="block text-base font-medium text-gray-700 mb-1">
                  Notes <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={orderModalNotes}
                  onChange={(e) => setOrderModalNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y min-h-[80px]"
                  placeholder="Any special requests or notes..."
                />
              </div>

              <SquarePaymentForm
                amount={totalWithFee}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError}
                customerName={orderModalName}
                orderId={`ORDER-${Date.now()}`}
              />
            </>
          ) : (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-900 mb-2">Payment Successful!</p>
                    <p className="text-sm text-green-800">
                      Your payment of ${totalWithFee.toFixed(2)} has been processed and your order has been submitted.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCloseOrderModal}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderSubmissionModal;

// Made with Bob
