/**
 * Parse and calculate processing fee from a fee string
 * This calculation ensures that after Square takes their fee, you retain the exact subtotal.
 *
 * Formula: If Square charges R% + F (e.g., 2.9% + $0.30), then to net exactly S (subtotal),
 * you need to charge: (S + F) / (1 - R/100)
 *
 * Supports formats like:
 * - "2.90% + $0.30" (percentage + flat fee)
 * - "$1.50" (flat fee only)
 * - "3%" (percentage only)
 * - "2.9% + 0.30" (with or without $ symbol)
 *
 * @param {string} feeString - The fee configuration string
 * @param {number} subtotal - The subtotal amount you want to retain after fees
 * @returns {number} The calculated fee amount to add to subtotal
 */
export function calculateProcessingFee(feeString, subtotal) {
  if (!feeString || typeof feeString !== 'string') {
    return 0;
  }

  const trimmed = feeString.trim();
  if (!trimmed) {
    return 0;
  }

  let percentageRate = 0; // As a decimal (e.g., 2.9% = 0.029)
  let flatFee = 0;

  // Check if it contains a '+' (combination format)
  if (trimmed.includes('+')) {
    const parts = trimmed.split('+').map(p => p.trim());
    
    for (const part of parts) {
      if (part.includes('%')) {
        // Parse percentage
        const percentValue = parseFloat(part.replace('%', '').trim());
        if (!isNaN(percentValue)) {
          percentageRate = percentValue / 100;
        }
      } else {
        // Parse flat fee
        const flatValue = parseFloat(part.replace('$', '').trim());
        if (!isNaN(flatValue)) {
          flatFee = flatValue;
        }
      }
    }
  } else if (trimmed.includes('%')) {
    // Percentage only
    const percentValue = parseFloat(trimmed.replace('%', '').trim());
    if (!isNaN(percentValue)) {
      percentageRate = percentValue / 100;
    }
  } else {
    // Flat fee only
    const flatValue = parseFloat(trimmed.replace('$', '').trim());
    if (!isNaN(flatValue)) {
      flatFee = flatValue;
    }
  }

  // Calculate the total charge needed to net the subtotal after Square's fees
  // Formula: totalCharge = (subtotal + flatFee) / (1 - percentageRate)
  // Then: processingFee = totalCharge - subtotal
  
  if (percentageRate > 0) {
    // With percentage: need to solve for total where (total - flatFee) * (1 - rate) = subtotal
    const totalCharge = (subtotal + flatFee) / (1 - percentageRate);
    return totalCharge - subtotal;
  } else {
    // Flat fee only: just pass through the flat fee
    return flatFee;
  }
}

/**
 * Format the processing fee for display
 * @param {number} fee - The calculated fee amount
 * @returns {string} Formatted fee string
 */
export function formatProcessingFee(fee) {
  return fee.toFixed(2);
}

// Made with Bob
