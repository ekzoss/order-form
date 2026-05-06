# Quick Start Guide - Testing the Migration

## Current Status
✅ All backend code implemented
✅ Migration system ready
✅ Store view shows "No Designs" message
✅ Admin panel shows migration banner

## Steps to Test

### 1. View the Main Page
- You should see: "No Designs Available" message
- Click "Go to Admin Panel" button

### 2. Login to Admin
- Password: `admin123`
- You'll see a yellow banner: "Migration Required"

### 3. Run the Migration
- Click "Run Migration Now" button
- Wait for success message
- Should show: "Migration successful! Design created: true, Orders updated: 15"

### 4. After Migration
- Refresh the page
- Main page should now show "Shirt 1" design with your images
- Orders should work normally
- Admin panel will show the design

## What the Migration Does

1. **Creates "Shirt 1" Design**
   - Copies frontImage and backImage from old config
   - Copies productHeader and productDescription
   - Sets pricePerShirt
   - Creates in: `designs/shirt-1`

2. **Updates All Orders**
   - Adds `designId: "shirt-1"` to all 15 existing orders
   - Orders remain unchanged otherwise

3. **Updates Config**
   - Removes frontImage and backImage from config
   - Keeps payment settings (Venmo, Cash App, Email)

## Troubleshooting

### Main page is blank
- Migration hasn't been run yet
- No designs exist in database
- Solution: Run migration from admin panel

### Migration button doesn't appear
- Check browser console for errors
- Verify you're logged into admin panel
- Check that migration hasn't already run

### After migration, still no design
- Check browser console for errors
- Check Firestore console: `designs/shirt-1` should exist
- Try refreshing the page

## Next Steps After Migration

Once migration is successful, you can:

1. **Test Creating New Design**
   - (UI not built yet, but backend ready)
   
2. **Test Ordering**
   - Place a test order
   - Verify it has designId in Firestore

3. **View Orders in Admin**
   - Orders should be grouped by design
   - (Full UI not built yet)

## Database Structure After Migration

```
Firestore:
└── artifacts/{appId}/public/data/
    ├── designs/
    │   └── shirt-1/
    │       ├── name: "Shirt 1"
    │       ├── frontImage: <your image>
    │       ├── backImage: <your image>
    │       ├── productHeader: "Austin Velocity..."
    │       ├── productDescription: "..."
    │       ├── pricePerShirt: 7.50
    │       └── status: "open"
    │
    ├── tshirt_config/main/
    │   ├── pageTitle
    │   ├── venmoUsername
    │   ├── cashappUsername
    │   └── (no more frontImage/backImage)
    │
    └── tshirt_orders/
        └── {each order now has designId: "shirt-1"}
```

## Support

If something goes wrong:
1. Check browser console (F12)
2. Check Firestore console
3. Review PHASE_1_COMPLETE.md
4. Migration can be rolled back for testing (see migrationUtils.js)