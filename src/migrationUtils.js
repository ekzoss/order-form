// Migration utilities for converting single-design structure to multi-design structure

import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  updateDoc,
  writeBatch 
} from 'firebase/firestore';

/**
 * Migrate existing single-design data to new multi-design structure
 * This creates a "Shirt 1" design and associates all existing orders with it
 */
export async function migrateToDesignStructure(db, appId) {
  const results = {
    success: false,
    designCreated: false,
    ordersUpdated: 0,
    errors: []
  };

  try {
    console.log('Starting migration to design structure...');

    // Step 1: Get current config
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_config', 'main');
    const configSnap = await getDoc(configRef);
    
    if (!configSnap.exists()) {
      throw new Error('No existing config found');
    }

    const currentConfig = configSnap.data();
    console.log('Current config retrieved');

    // Step 2: Create "Shirt 1" design
    const designId = 'shirt-1';
    const designRef = doc(db, 'artifacts', appId, 'public', 'data', 'designs', designId);
    
    const designData = {
      id: designId,
      name: 'Shirt 1',
      frontImage: currentConfig.frontImage || null,
      backImage: currentConfig.backImage || null,
      productHeader: currentConfig.productHeader || 'Austin Velocity 161 Diamond',
      productDescription: currentConfig.productDescription || '',
      pricePerShirt: currentConfig.pricePerShirt !== undefined ? currentConfig.pricePerShirt : 7.50,
      status: 'open', // Default to open for existing design
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await setDoc(designRef, designData);
    results.designCreated = true;
    console.log('Design "Shirt 1" created successfully');

    // Step 3: Update all existing orders with designId
    const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'tshirt_orders');
    const ordersSnap = await getDocs(ordersRef);
    
    if (!ordersSnap.empty) {
      const batch = writeBatch(db);
      let batchCount = 0;
      
      ordersSnap.docs.forEach((orderDoc) => {
        const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_orders', orderDoc.id);
        batch.update(orderRef, { designId: designId });
        batchCount++;
      });

      await batch.commit();
      results.ordersUpdated = batchCount;
      console.log(`Updated ${batchCount} orders with designId`);
    }

    // Step 4: Update config to remove design-specific fields (keep global settings)
    const updatedConfig = {
      pageTitle: currentConfig.pageTitle,
      venmoUsername: currentConfig.venmoUsername,
      cashappUsername: currentConfig.cashappUsername,
      notificationEmail: currentConfig.notificationEmail,
      emailjsServiceId: currentConfig.emailjsServiceId,
      emailjsTemplateId: currentConfig.emailjsTemplateId,
      emailjsPublicKey: currentConfig.emailjsPublicKey
    };

    await setDoc(configRef, updatedConfig, { merge: false });
    console.log('Config updated to remove design-specific fields');

    results.success = true;
    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration error:', error);
    results.errors.push(error.message);
  }

  return results;
}

/**
 * Check if migration has already been performed
 */
export async function checkMigrationStatus(db, appId) {
  try {
    // Check if "Shirt 1" design exists
    const designRef = doc(db, 'artifacts', appId, 'public', 'data', 'designs', 'shirt-1');
    const designSnap = await getDoc(designRef);
    
    return {
      migrated: designSnap.exists(),
      designExists: designSnap.exists()
    };
  } catch (error) {
    console.error('Error checking migration status:', error);
    return {
      migrated: false,
      designExists: false,
      error: error.message
    };
  }
}

/**
 * Rollback migration (for testing purposes)
 * WARNING: This will delete the designs collection and remove designId from orders
 */
export async function rollbackMigration(db, appId) {
  const results = {
    success: false,
    errors: []
  };

  try {
    console.log('Rolling back migration...');

    // Get the "Shirt 1" design data
    const designRef = doc(db, 'artifacts', appId, 'public', 'data', 'designs', 'shirt-1');
    const designSnap = await getDoc(designRef);
    
    if (designSnap.exists()) {
      const designData = designSnap.data();
      
      // Restore design-specific fields to config
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_config', 'main');
      await setDoc(configRef, {
        frontImage: designData.frontImage,
        backImage: designData.backImage,
        productHeader: designData.productHeader,
        productDescription: designData.productDescription,
        pricePerShirt: designData.pricePerShirt
      }, { merge: true });
      
      console.log('Restored design data to config');
    }

    // Remove designId from all orders
    const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'tshirt_orders');
    const ordersSnap = await getDocs(ordersRef);
    
    if (!ordersSnap.empty) {
      const batch = writeBatch(db);
      
      ordersSnap.docs.forEach((orderDoc) => {
        const orderRef = doc(db, 'artifacts', appId, 'public', 'data', 'tshirt_orders', orderDoc.id);
        const data = orderDoc.data();
        const { designId, ...restData } = data;
        batch.set(orderRef, restData);
      });

      await batch.commit();
      console.log('Removed designId from orders');
    }

    results.success = true;
    console.log('Rollback completed successfully!');

  } catch (error) {
    console.error('Rollback error:', error);
    results.errors.push(error.message);
  }

  return results;
}

// Made with Bob
