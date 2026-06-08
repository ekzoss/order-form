import React, { useEffect, useState } from 'react';
import { CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react';

const SquarePaymentForm = ({ amount, onPaymentSuccess, onPaymentError, customerName, orderId }) => {
  const [card, setCard] = useState(null);
  const [payments, setPayments] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCardValid, setIsCardValid] = useState(false);

  useEffect(() => {
    let cardInstance = null;
    let mounted = true;

    const loadSquareSDK = () => {
      return new Promise((resolve, reject) => {
        // Check if Square SDK is already loaded
        if (window.Square) {
          resolve();
          return;
        }

        // Get credentials to determine environment
        const appId = import.meta.env.VITE_SQUARE_APPLICATION_ID;
        if (!appId) {
          reject(new Error('Missing Square Application ID'));
          return;
        }

        // Determine environment based on Application ID
        const isSandbox = appId.startsWith('sandbox-');
        const sdkUrl = isSandbox
          ? 'https://sandbox.web.squarecdn.com/v1/square.js'
          : 'https://web.squarecdn.com/v1/square.js';

        console.log('Loading Square SDK:', {
          environment: isSandbox ? 'sandbox' : 'production',
          url: sdkUrl
        });

        // Create and load the script
        const script = document.createElement('script');
        script.src = sdkUrl;
        script.type = 'text/javascript';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Square SDK'));
        document.head.appendChild(script);
      });
    };

    const initializeSquare = async () => {
      try {
        // Load the Square SDK first
        await loadSquareSDK();

        if (!mounted) return;

        if (!window.Square) {
          setError('Square SDK failed to load');
          return;
        }

        // Get credentials
        const appId = import.meta.env.VITE_SQUARE_APPLICATION_ID;
        const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID;
        
        if (!appId || !locationId) {
          throw new Error('Missing Square credentials. Check your .env file.');
        }
        
        // Determine environment based on Application ID
        const isSandbox = appId.startsWith('sandbox-');
        
        // Debug logging
        console.log('Square Initialization:', {
          appId: appId.substring(0, 20) + '...',
          locationId: locationId.substring(0, 10) + '...',
          isSandbox,
          detectedEnvironment: isSandbox ? 'sandbox' : 'production'
        });
        
        // Initialize Square Payments
        const paymentsInstance = window.Square.payments(appId, locationId);
        
        if (!mounted) return; // Don't continue if component unmounted
        
        setPayments(paymentsInstance);

        cardInstance = await paymentsInstance.card();
        
        if (!mounted) {
          // Component unmounted during initialization, clean up
          cardInstance.destroy();
          return;
        }
        
        await cardInstance.attach('#card-container');
        
        // Listen for card input changes to validate
        cardInstance.addEventListener('cardBrandChanged', (event) => {
          // Card brand changed, but not necessarily valid yet
          setIsCardValid(false);
        });
        
        cardInstance.addEventListener('postalCodeChanged', (event) => {
          // Postal code changed, check if complete
          setIsCardValid(false);
        });
        
        // The card is valid when all required fields are filled
        cardInstance.addEventListener('submit', async (event) => {
          // This fires when user presses Enter, but we need to validate on input
          setIsCardValid(true);
        });
        
        // Listen to input events to validate card state
        const checkCardValidity = async () => {
          try {
            // Try to tokenize to check if card is valid
            // We won't actually use this token, just checking validity
            const result = await cardInstance.tokenize();
            if (result.status === 'OK') {
              setIsCardValid(true);
            } else {
              setIsCardValid(false);
            }
          } catch (e) {
            setIsCardValid(false);
          }
        };
        
        // Check validity on any input change
        cardInstance.addEventListener('cardBrandChanged', checkCardValidity);
        cardInstance.addEventListener('postalCodeChanged', checkCardValidity);
        
        setCard(cardInstance);
        setIsInitialized(true);
      } catch (e) {
        console.error('Failed to initialize Square:', e);
        if (mounted) {
          setError('Failed to initialize payment form. Please refresh and try again.');
        }
      }
    };

    initializeSquare();

    return () => {
      mounted = false;
      if (cardInstance) {
        try {
          cardInstance.destroy();
        } catch (e) {
          console.error('Error destroying card instance:', e);
        }
      }
    };
  }, []);

  const handlePayment = async (e) => {
    e.preventDefault();
    
    if (!card) {
      setError('Payment form not initialized');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Step 1: Tokenize the card
      const result = await card.tokenize();
      
      if (result.status === 'OK') {
        console.log('Payment token generated:', result.token);
        
        // Step 2: Send token to backend for payment processing
        const apiUrl = import.meta.env.DEV
          ? 'http://localhost:3000/api/process-payment'
          : '/api/process-payment';

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sourceId: result.token,
            amount: amount,
            currency: 'USD',
            orderId: orderId,
            customerName: customerName,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          console.log('Payment successful:', data.payment);
          onPaymentSuccess(data.payment);
        } else {
          const errorMessage = data.details
            ? data.details.map(e => e.detail).join(', ')
            : data.error || 'Payment failed. Please try again.';
          
          setError(errorMessage);
          onPaymentError(errorMessage);
        }
      } else {
        let errorMessage = 'Payment failed. Please try again.';
        
        if (result.errors) {
          errorMessage = result.errors.map(error => error.message).join(', ');
        }
        
        setError(errorMessage);
        onPaymentError(errorMessage);
      }
    } catch (e) {
      console.error('Payment error:', e);
      const errorMessage = e.message || 'An unexpected error occurred';
      setError(errorMessage);
      onPaymentError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const isFormValid = customerName.trim() !== '' && isInitialized && isCardValid;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900 mb-1">Payment Error</p>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handlePayment} className="space-y-4">
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            Card Information <span className="text-red-500">*</span>
            <span className="text-xs text-gray-500 font-normal ml-2">(secure payment via Square)</span>
          </label>
          <div
            id="card-container"
            className="rounded-lg bg-white min-h-[60px]"
          />
        </div>

        <button
          type="submit"
          disabled={isProcessing || !isFormValid}
          className={`w-full py-3 rounded-lg font-bold text-white transition-all flex items-center justify-center gap-2 ${
            isProcessing || !isFormValid
              ? 'bg-indigo-300 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing Payment...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Pay ${amount.toFixed(2)}
            </>
          )}
        </button>
      </form>

      <p className="text-xs text-gray-500 text-center">
        Your payment information is secure and encrypted
      </p>
    </div>
  );
};

export default SquarePaymentForm;

// Made with Bob
