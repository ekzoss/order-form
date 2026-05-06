# Design System Implementation Summary

## Overview
This document outlines the changes needed to implement the multi-design system for the t-shirt order form.

## Files Created
1. ✅ `DESIGN_IMPLEMENTATION_PLAN.md` - Detailed technical plan
2. ✅ `src/migrationUtils.js` - Migration utilities for data conversion

## Changes Needed to App.jsx

### 1. Import Changes
**Add:**
```javascript
import { migrateToDesignStructure, checkMigrationStatus } from './migrationUtils';
```

**Add to lucide-react imports:**
```javascript
Plus, RefreshCw
```

### 2. State Changes

**Remove these states (design-specific, now per-design):**
- `storeConfig` (partially - keep global config only)
- `designImage`
- `previewImage`
- `designPosition`
- `designSize`
- `selectedTshirtBg`

**Add these new states:**
```javascript
// Global config (payment, email settings only)
const [globalConfig, setGlobalConfig] = useState({...});
const [configForm, setConfigForm] = useState({...});

// Design management
const [designs, setDesigns] = useState([]);
const [selectedDesignId, setSelectedDesignId] = useState(null);
const [editingDesignId, setEditingDesignId] = useState(null);
const [designForm, setDesignForm] = useState(null);
const [isCreatingDesign, setIsCreatingDesign] = useState(false);
const [newDesignForm, setNewDesignForm] = useState({...});

// Migration
const [migrationStatus, setMigrationStatus] = useState({ checked: false, migrated: false });
const [isMigrating, setIsMigrating] = useState(false);
```

### 3. Data Fetching Changes

**Update useEffect for config:**
- Fetch from `tshirt_config/main` but only global settings
- Remove frontImage, backImage from config

**Add useEffect for designs:**
```javascript
// Fetch Designs collection
const designsRef = collection(db, 'artifacts', appId, 'public', 'data', 'designs');
const unsubscribeDesigns = onSnapshot(designsRef, (snapshot) => {
  const fetchedDesigns = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  setDesigns(fetchedDesigns);
  // Auto-select first design
  if (!selectedDesignId && fetchedDesigns.length > 0) {
    setSelectedDesignId(fetchedDesigns[0].id);
  }
});
```

### 4. New Functions to Add

```javascript
// Migration
const handleRunMigration = async () => { ... }

// Design CRUD
const handleCreateDesign = async () => { ... }
const handleStartEditDesign = (design) => { ... }
const handleSaveDesignEdit = async (designId) => { ... }
const handleDeleteDesign = async (designId) => { ... }

// Updated image editor
const handleOpenImageEditor = (side, designId) => { ... }
const handleSaveImageEditor = async (data) => {
  // Update design document instead of config
  const designRef = doc(db, 'artifacts', appId, 'public', 'data', 'designs', designId);
  await updateDoc(designRef, { [side]: newPreviewImage, updatedAt: Date.now() });
}
```

### 5. Order Submission Changes

**Update handleSubmitOrder:**
```javascript
await addDoc(ordersRef, {
  designId: selectedDesignId,  // NEW: Associate with design
  name: name.trim(),
  sizes,
  // ... rest of order data
});
```

### 6. Admin Dashboard Changes

**Add Migration Section (if not migrated):**
```jsx
{!migrationStatus.migrated && (
  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-6">
    <h3 className="font-bold text-yellow-800 mb-2">Migration Required</h3>
    <p className="text-sm text-yellow-700 mb-3">
      Your data needs to be migrated to the new design system.
    </p>
    <button onClick={handleRunMigration} disabled={isMigrating}>
      {isMigrating ? 'Migrating...' : 'Run Migration'}
    </button>
  </div>
)}
```

**Add Design Management Section:**
```jsx
<div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-2xl font-bold text-gray-900">Designs</h2>
    <button onClick={() => setIsCreatingDesign(true)}>
      <Plus /> Create New Design
    </button>
  </div>
  
  {/* List of designs with edit/delete buttons */}
  {designs.map(design => (
    <div key={design.id} className="border-b py-4">
      {editingDesignId === design.id ? (
        // Edit form
      ) : (
        // Display with edit/delete buttons
      )}
    </div>
  ))}
</div>
```

**Update Orders Section:**
- Group orders by designId
- Show design name with each order group
- Display design-specific totals

```jsx
{Object.entries(ordersByDesign).map(([designId, designOrders]) => {
  const design = designs.find(d => d.id === designId);
  const totals = calculateDesignTotals(designOrders);
  
  return (
    <div key={designId} className="mb-8">
      <h3>{design?.name || 'Unknown Design'}</h3>
      {/* Design images */}
      {/* Totals for this design */}
      {/* Orders table for this design */}
    </div>
  );
})}
```

### 7. Store View Changes

**Update to use selectedDesign:**
```jsx
{view === 'store' && selectedDesign && (
  <div>
    <h1>{selectedDesign.productHeader}</h1>
    <div dangerouslySetInnerHTML={{ __html: selectedDesign.productDescription }} />
    <img src={selectedDesign[`${activeTab}Image`]} />
    {/* ... rest of store view using selectedDesign */}
  </div>
)}
```

## Testing Checklist

After implementation:

1. ✅ Run migration in admin panel
2. ✅ Verify "Shirt 1" design created with existing images
3. ✅ Verify all 15 orders have designId = "shirt-1"
4. ✅ Create a new design
5. ✅ Upload images to new design
6. ✅ Edit design details
7. ✅ Submit order for new design
8. ✅ Verify orders grouped by design in admin
9. ✅ Verify totals calculated per design
10. ✅ Delete test design (with confirmation)

## Database Schema After Migration

```
artifacts/{appId}/public/data/
  ├── designs/ (NEW COLLECTION)
  │   ├── shirt-1/
  │   │   ├── id: "shirt-1"
  │   │   ├── name: "Shirt 1"
  │   │   ├── frontImage: <base64>
  │   │   ├── backImage: <base64>
  │   │   ├── productHeader: "..."
  │   │   ├── productDescription: "..."
  │   │   ├── pricePerShirt: 7.50
  │   │   ├── status: "open"
  │   │   ├── createdAt: timestamp
  │   │   └── updatedAt: timestamp
  │   └── {other-designs}/
  │
  ├── tshirt_config/
  │   ├── main/ (UPDATED - global settings only)
  │   │   ├── pageTitle
  │   │   ├── venmoUsername
  │   │   ├── cashappUsername
  │   │   ├── notificationEmail
  │   │   ├── emailjsServiceId
  │   │   ├── emailjsTemplateId
  │   │   └── emailjsPublicKey
  │   └── backgrounds/ (unchanged)
  │
  └── tshirt_orders/ (UPDATED - now includes designId)
      └── {orderId}/
          ├── designId: "shirt-1" (NEW FIELD)
          ├── name
          ├── sizes
          ├── notes
          ├── isPaid
          ├── totalItems
          ├── timestamp
          └── userId
```

## Next Steps

1. Review this summary
2. Confirm approach
3. Implement changes in phases:
   - Phase 1: State and data fetching
   - Phase 2: Design management UI
   - Phase 3: Order association
   - Phase 4: Admin dashboard updates
   - Phase 5: Testing and validation