/**
 * Migration utility: Convert operatingHours.closed to operatingHours.isOpen
 * Can be called from anywhere in the app
 */

import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import toast from 'react-hot-toast';

export const migrateBranchOperatingHours = async () => {
  try {
    console.log('🔄 Starting branch migration...');
    toast.loading('Migrating branches...', { id: 'migration' });
    
    const snapshot = await getDocs(collection(db, 'branches'));
    console.log(`📦 Found ${snapshot.size} branch(es)`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const branchDoc of snapshot.docs) {
      const data = branchDoc.data();
      console.log(`\n🏢 Processing: ${data.branchName || branchDoc.id}`);
      
      if (!data.operatingHours) {
        console.log('   ⚠️  No operatingHours, skipping...');
        skippedCount++;
        continue;
      }
      
      // Check if already migrated
      const firstDay = Object.values(data.operatingHours)[0];
      if (firstDay.isOpen !== undefined) {
        console.log('   ✅ Already migrated!');
        skippedCount++;
        continue;
      }
      
      // Check if has closed field
      if (firstDay.closed === undefined) {
        console.log('   ⚠️  No closed field, skipping...');
        skippedCount++;
        continue;
      }
      
      // Convert: closed -> isOpen (inverted logic)
      const newHours = {};
      Object.entries(data.operatingHours).forEach(([day, hours]) => {
        newHours[day] = {
          open: hours.open,
          close: hours.close,
          isOpen: !hours.closed  // Invert: closed: false -> isOpen: true
        };
        console.log(`   📅 ${day}: closed=${hours.closed} → isOpen=${!hours.closed}`);
      });
      
      // Update Firestore
      await updateDoc(doc(db, 'branches', branchDoc.id), {
        operatingHours: newHours
      });
      
      console.log('   ✅ Successfully updated!');
      migratedCount++;
    }
    
    console.log('\n🎉 Migration completed!');
    console.log(`✅ Migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    
    toast.success(
      `Migration complete! ${migratedCount} branch(es) updated, ${skippedCount} skipped.`,
      { id: 'migration', duration: 5000 }
    );
    
    return { success: true, migrated: migratedCount, skipped: skippedCount };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    toast.error(`Migration failed: ${error.message}`, { id: 'migration' });
    return { success: false, error: error.message };
  }
};
