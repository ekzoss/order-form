# T-Shirt Image Editor - Composition Persistence Implementation

## Overview
This implementation allows users to reopen and edit t-shirt compositions with the same foreground image, scale, positioning, and background that was initially created.

## Changes Made

### 1. Data Structure Enhancement (`src/hooks/useItems.js`)
- **Modified `handleSaveImageEditor` function** to store composition metadata alongside the composite image
- **New fields stored in Firestore:**
  - `frontImageMeta` - Metadata for front image composition
  - `backImageMeta` - Metadata for back image composition
  
- **Metadata structure:**
  ```javascript
  {
    itemImage: string,          // Base64 foreground image
    selectedBackground: string, // Base64 or URL of background
    position: { x: number, y: number }, // Position percentages
    size: number                // Size percentage
  }
  ```

### 2. Modal Props Enhancement (`src/App.jsx`)
- **Updated ImageEditorModal props** to retrieve and pass stored metadata:
  - `initialItemImage` - Now retrieves from `frontImageMeta.itemImage` or `backImageMeta.itemImage`
  - `initialBackground` - Now retrieves from metadata or defaults to first background
  - `initialPosition` - Now retrieves from metadata or defaults to `{ x: 50, y: 28 }`
  - `initialSize` - Now retrieves from metadata or defaults to `45`

### 3. ImageEditorModal Behavior
The modal already had the correct behavior:
- Accepts initial values for all composition parameters
- Allows independent changes to:
  - Foreground image (upload new)
  - Background selection
  - Position (drag and drop)
  - Size (slider)
- Returns all composition data on save

## User Experience

### First Time Creating an Image:
1. User clicks "Edit" button on front or back image placeholder
2. Modal opens with default values
3. User uploads foreground image
4. User positions and scales the image
5. User selects background
6. User clicks "Save"
7. System stores both the composite preview AND the composition metadata

### Editing an Existing Image:
1. User clicks "Edit" button on existing front or back image
2. Modal opens with **previously saved composition**:
   - Same foreground image
   - Same background
   - Same position
   - Same scale
3. User can now:
   - Upload a NEW foreground image (replaces old one)
   - Change background independently
   - Reposition the image
   - Rescale the image
   - Or keep everything the same and just tweak one aspect
4. User clicks "Save"
5. System updates both the composite preview AND the composition metadata

## Benefits
- **No need to re-upload** the foreground image every time
- **Independent editing** of each composition aspect
- **Preserves user work** - all settings are remembered
- **Flexible workflow** - can change just one thing without redoing everything

## Backward Compatibility
- Items created before this update will not have metadata
- When editing these items, the modal will use default values
- Once saved with the new system, metadata will be stored for future edits