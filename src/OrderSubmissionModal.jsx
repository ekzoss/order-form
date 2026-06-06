import React from 'react';
import { CheckCircle2, RefreshCw, X } from 'lucide-react';
import { SIZES } from './constants';

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
  if (!showOrderModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {orderSubmitted ? 'Order Confirmed!' : 'Review Your Order'}
            </h2>
            <button
              onClick={handleCloseOrderModal}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-6 space-y-3">
            <h3 className="font-semibold text-gray-700 mb-3">Order Summary:</h3>
            {Object.entries(sizesByDesign).map(([designId, designSizes]) => {
              const design = designs.find(d => d.id === designId);
              if (!design) return null;

              const totalItemsForDesign = Object.values(designSizes).reduce((sum, qty) => sum + qty, 0);
              if (totalItemsForDesign === 0) return null;

              const sizesText = SIZES
                .filter(size => designSizes[size] > 0)
                .map(size => `${size}: ${designSizes[size]}`)
                .join(', ');

              return (
                <div key={designId} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{design.name}</p>
                    <p className="text-sm text-gray-600">{sizesText}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold text-gray-900">${(totalItemsForDesign * design.pricePerShirt).toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{totalItemsForDesign} × ${design.pricePerShirt.toFixed(2)}</p>
                  </div>
                </div>
              );
            })}

            <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
              <p className="text-lg font-bold text-gray-900">Total:</p>
              <p className="text-xl font-bold text-indigo-600">${totalPrice.toFixed(2)}</p>
            </div>
          </div>

          {!orderSubmitted ? (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={orderModalNotes}
                  onChange={(e) => setOrderModalNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y min-h-[80px]"
                  placeholder="Any special requests or notes..."
                />
              </div>

              <button
                onClick={handleSubmitMultiDesignOrder}
                disabled={isSubmitting || !orderModalName.trim()}
                className={`w-full py-3 rounded-lg font-bold text-white transition-all flex items-center justify-center gap-2 ${
                  isSubmitting || !orderModalName.trim()
                    ? 'bg-indigo-300 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Submit Order
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700">
                  {orderModalName}
                </div>
              </div>

              {orderModalNotes && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 whitespace-pre-wrap">
                    {orderModalNotes}
                  </div>
                </div>
              )}

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-green-900 mb-2">Thank you for your order!</p>
                    <p className="text-sm text-green-800 mb-3">Please submit payment via:</p>
                    <div className="space-y-2 text-sm">
                      {globalConfig.venmoUsername && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-green-900">Venmo:</span>
                          <a
                            href={`https://venmo.com/${globalConfig.venmoUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-800 hover:text-green-600 underline font-medium"
                          >
                            @{globalConfig.venmoUsername}
                          </a>
                        </div>
                      )}
                      {globalConfig.cashappUsername && (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-green-900">Cash App:</span>
                          <a
                            href={`https://cash.app/$${globalConfig.cashappUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-800 hover:text-green-600 underline font-medium"
                          >
                            ${globalConfig.cashappUsername}
                          </a>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-green-900">Cash:</span>
                        <span className="text-green-800">In person</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCloseOrderModal}
                className="w-full py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold transition-colors"
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
