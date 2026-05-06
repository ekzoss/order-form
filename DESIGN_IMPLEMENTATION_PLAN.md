# Design Implementation Plan

## Current Structure Analysis

### Firebase Schema (Current)
```
artifacts/
  {appId}/
    public/
      data/
        tshirt_config/
          main (document) - Contains frontImage, backImage, and all config
          backgrounds (document) - Contains library of t-shirt backgrounds
        tshirt_orders/ (collection)
          {orderId} (documents) - Individual orders with sizes, name, etc.
```

### Current Data Flow
1. Single shirt design stored in `tshirt_config/main`
2. Orders reference no specific design (implicit "Shirt 1")
3. Admin panel shows all orders together
4. Store view shows single design

## New Design Concept

### Design Data Model
```typescript
Design {
  id: string (auto-generated)
  name: string (e.g., "Shirt 1", "Summer 2024 Design")
  frontImage: string (base64)
  backImage: string (base64)
  productHeader: string
  productDescription: string
  pricePerShirt: number
  status: 'preview' | 'open' | 'closed'
  createdAt: timestamp
  updatedAt: timestamp
}
```

### New Firebase Schema
```
artifacts/
  {appId}/
    public/
      data/
        designs/ (collection)
          {designId} (documents) - Individual designs
        tshirt_config/
          main (document) - Global config (venmo, cashapp, email settings)
          backgrounds (document) - T-shirt background library
        tshirt_orders/ (collection)
          {orderId} (documents) - Orders with designId field added
```

## Implementation Steps

### Phase 1: Database Schema & Migration
1. Create `designs` collection structure
2. Create migration script to:
   - Create "Shirt 1" design from current `tshirt_config/main`
   - Update all existing orders with designId = "shirt-1"
   - Preserve all existing preview images and orders

### Phase 2: Admin Panel - Design Management
1. Add "Designs" section to admin panel
2. Implement design CRUD operations:
   - Create new design
   - Edit existing design
   - Delete design (with confirmation)
3. Move shirt image editors to design-specific context
4. Keep global settings separate (payment info, email config)

### Phase 3: Order Association
1. Update order submission to include designId
2. Modify order display to group by design
3. Show design-specific totals and revenue

### Phase 4: Store View Updates
1. Add design selector (for future multi-design support)
2. Display design-specific information
3. Ensure orders are submitted with correct designId

### Phase 5: Status Management (Future - Phase 2 of user request)
1. Add status field to designs
2. Implement preview mode with feedback features
3. Implement open/closed states
4. Support multiple designs on page simultaneously

## Migration Strategy

### Step 1: Create "Shirt 1" Design
- Extract current frontImage, backImage from tshirt_config/main
- Create design document with id "shirt-1"
- Preserve all current configuration

### Step 2: Update Orders
- Add designId field to all existing orders
- Set designId = "shirt-1" for all existing orders

### Step 3: Update Config
- Remove frontImage, backImage from tshirt_config/main
- Keep global settings (venmo, cashapp, email, etc.)

## Backward Compatibility
- Existing orders will be retrofitted with "shirt-1" designId
- All current functionality preserved
- No data loss during migration