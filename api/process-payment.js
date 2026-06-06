import pkg from 'square';
import { randomUUID } from 'crypto';

const { SquareClient, SquareEnvironment } = pkg;

// Initialize Square client
const getSquareClient = () => {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const envName = process.env.SQUARE_ENVIRONMENT || 'sandbox';
  
  // The Square SDK internally looks for SQUARE_TOKEN environment variable
  // Set it programmatically if not already set
  if (!process.env.SQUARE_TOKEN && accessToken) {
    process.env.SQUARE_TOKEN = accessToken;
  }
  
  // Map environment name to Square environment URL
  const environment = envName.toLowerCase() === 'production'
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;
  
  if (!SquareClient || typeof SquareClient !== 'function') {
    throw new Error('Square Client constructor not available');
  }
  
  // Create client with access token and proper environment URL
  const client = new SquareClient({
    accessToken: accessToken,
    environment: environment
  });
  
  return client;
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sourceId, amount, currency = 'USD', orderId, customerName } = req.body;

    // Validate required fields
    if (!sourceId || !amount) {
      return res.status(400).json({ 
        error: 'Missing required fields: sourceId and amount are required' 
      });
    }

    // Validate amount is positive
    if (amount <= 0) {
      return res.status(400).json({ 
        error: 'Amount must be greater than 0' 
      });
    }

    const squareClient = getSquareClient();

    // Convert amount to cents (Square expects amount in smallest currency unit)
    const amountInCents = Math.round(amount * 100);

    // Create payment request
    const paymentRequest = {
      sourceId: sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: BigInt(amountInCents),
        currency: currency,
      },
      locationId: process.env.SQUARE_LOCATION_ID,
    };

    // Add optional fields if provided
    if (orderId) {
      paymentRequest.referenceId = orderId;
    }

    if (customerName) {
      paymentRequest.note = `Order from: ${customerName}`;
    }

    // Process the payment
    const response = await squareClient.payments.create(paymentRequest);

    // Return success response
    res.status(200).json({
      success: true,
      payment: {
        id: response.payment.id,
        status: response.payment.status,
        receiptUrl: response.payment.receiptUrl,
        amount: amount,
        currency: currency,
        createdAt: response.payment.createdAt,
      }
    });
    
    // Explicitly end the response to prevent Windows assertion error
    res.end();

  } catch (error) {
    console.error('Payment processing error:', error);

    // Handle Square API errors
    if (error.errors) {
      const errorMessages = error.errors.map(e => ({
        category: e.category,
        code: e.code,
        detail: e.detail,
      }));

      return res.status(400).json({
        success: false,
        error: 'Payment failed',
        details: errorMessages,
      });
    }

    // Handle other errors
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

// Made with Bob
