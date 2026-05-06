# Phase 2: Design Status System - Implementation Plan

## Overview
Implement a three-state status system for designs (preview, open, closed) with different behaviors on the store view.

## Current Status
- ✅ Added `emailjsFeedbackTemplateId` field to global config
- ✅ Added feedback form state (`feedbackByDesign`, `submittingFeedback`)
- ✅ Implemented `handleSubmitFeedback` function
- ✅ Added feedback template ID field to admin settings UI
- ⚠️ **BLOCKED**: Syntax error in store view modifications

## Remaining Tasks

### 1. Fix Store View Syntax Error
**Problem**: Attempting to change from `designs.map(design => (` to `designs.filter().map(design => {` is causing syntax errors.

**Solution**: Need to properly handle the arrow function syntax. Two options:
- Option A: Keep parentheses `()` for implicit return with filter
- Option B: Use curly braces `{}` with explicit `return` statement

**Correct Implementation**:
```javascript
{designs
  .filter(design => design.status !== 'closed')
  .map(design => {
    const isPreview = design.status === 'preview';
    return (
      <div key={design.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        {/* ... rest of JSX ... */}
      </div>
    );
  })}
```

### 2. Update Price Display for Preview Designs
Replace price with "(Preview)" badge for preview designs in the title bar.

### 3. Replace Size Selection with Feedback Form
For preview designs, show feedback textarea and submit button instead of size inputs.

### 4. Test All Three States
- **Closed**: Should not appear on store view at all
- **Open**: Should show normally with pricing and size selection
- **Preview**: Should show with "(Preview)" badge and feedback form

## Files to Modify
- `src/App.jsx` (lines 1278-1410): Store view design rendering

## Testing Checklist
- [ ] Closed designs don't appear on store view
- [ ] Open designs show with normal pricing and ordering
- [ ] Preview designs show "(Preview)" badge instead of price
- [ ] Preview designs show feedback form instead of size inputs
- [ ] Feedback submission works and sends email
- [ ] Admin panel status toggle works correctly
- [ ] Existing designs default to "open" status

## Next Steps After Fix
1. Test the implementation in browser
2. Verify all three states work correctly
3. Test feedback email submission
4. Document the new features
5. Mark Phase 2 as complete