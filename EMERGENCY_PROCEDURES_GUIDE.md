# EMERGENCY PROCEDURES GUIDE

## Storage Cleanup System - Emergency Response and Rollback Procedures

### OVERVIEW

This guide provides comprehensive emergency procedures, troubleshooting steps, and rollback procedures for the storage cleanup system in case of critical issues or failures.

---

## STEP 1: IMMEDIATE EMERGENCY RESPONSE

### 1A. Critical Issue Identification

**Immediate response required for these critical conditions:**

1. **Cleanup System Completely Down**
   - No cleanup logs appearing
   - Orphaned files accumulating rapidly
   - Storage usage spiking

2. **Saved Assets Being Deleted**
   - User reports missing saved content
   - Saved asset count decreasing
   - User complaints about lost work

3. **System Performance Degradation**
   - Cleanup cycles taking >30 seconds
   - Database queries timing out
   - User operations failing during cleanup

4. **Storage Access Failures**
   - Supabase storage API errors
   - File deletion failures
   - Bucket access denied errors

### 1B. Emergency Contact Escalation

**Immediate escalation procedure:**

1. **First Level (0-15 minutes)**
   - Check application logs
   - Verify system status
   - Attempt basic troubleshooting

2. **Second Level (15-30 minutes)**
   - Contact system administrator
   - Implement emergency procedures
   - Notify operations team

3. **Third Level (30+ minutes)**
   - Contact development team lead
   - Consider system rollback
   - Notify stakeholders

---

## STEP 2: EMERGENCY TROUBLESHOOTING

### 2A. Cleanup System Not Running

**Symptoms:** No cleanup logs every 3 minutes

**Immediate Actions:**

```bash
# 1. Check application status
# Look for these log entries:
✅ "SmartStorageProvider initialized successfully"
✅ "Starting comprehensive cleanup cycle"

# 2. Check for JavaScript errors in console
# Look for:
❌ "Comprehensive cleanup failed:"
❌ "Failed to initialize SmartStorageProvider"
❌ "Database connection error"

# 3. Verify STORAGE_CONFIG values
# Check if these are set correctly:
TEMP_DIR_CLEANUP_INTERVAL_MS: 3 * 60 * 1000, // 3 minutes
MAX_TEMP_FILE_AGE_MS: 3 * 60 * 1000, // 3 minutes
```

**Troubleshooting Steps:**

1. **Check Application Logs**
   - Look for initialization errors
   - Check for database connection issues
   - Verify Supabase client initialization

2. **Verify Environment Variables**
   - Check SUPABASE_SERVICE_ROLE_KEY
   - Verify SUPABASE_IMAGES_BUCKET
   - Confirm SUPABASE_VIDEOS_BUCKET

3. **Test Database Connectivity**

   ```sql
   -- Test basic database access
   SELECT COUNT(*) FROM render_jobs LIMIT 1;
   SELECT COUNT(*) FROM user_assets LIMIT 1;
   ```

4. **Test Storage Access**
   ```bash
   # Test Supabase storage access
   # Check if buckets are accessible
   # Verify service role permissions
   ```

### 2B. Files Not Being Deleted

**Symptoms:** Orphaned files remain in Supabase storage

**Immediate Actions:**

```sql
-- 1. Check current orphaned files count
SELECT COUNT(*) as orphaned_files_count
FROM render_jobs rj
LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
WHERE rj.status = 'completed'
  AND rj.output_url IS NOT NULL
  AND ua.id IS NULL;

-- 2. Check for recent cleanup attempts
-- Look for cleanup logs in application console
```

**Troubleshooting Steps:**

1. **Check Supabase Permissions**
   - Verify service role has delete permissions
   - Check bucket policies and access rules
   - Test manual file deletion

2. **Verify parseStorageUrl Logic**

   ```typescript
   // Test URL parsing with actual URLs from database
   const testUrl =
     "https://example.supabase.co/storage/v1/object/sign/images/path/file.png";
   const result = parseStorageUrl(testUrl);
   console.log("Parsed result:", result);
   ```

3. **Check output_url Format**

   ```sql
   -- Check if URLs are in expected format
   SELECT output_url,
          CASE
            WHEN output_url LIKE '%/storage/v1/object/sign/%' THEN 'Valid'
            ELSE 'Invalid'
          END as url_format
   FROM render_jobs
   WHERE status = 'completed'
     AND output_url IS NOT NULL
   LIMIT 10;
   ```

4. **Test Manual File Deletion**

   ```typescript
   // Test manual deletion of a single file
   const { error } = await supabase.storage
     .from("images")
     .remove(["test/path/file.png"]);

   if (error) {
     console.error("Manual deletion failed:", error);
   }
   ```

### 2C. Database Errors During Cleanup

**Symptoms:** Cleanup logs show database errors

**Immediate Actions:**

```sql
-- 1. Check database connectivity
SELECT NOW() as current_time,
       version() as postgres_version;

-- 2. Check table permissions
SELECT table_name,
       privilege_type
FROM information_schema.role_table_grants
WHERE grantee = current_user
  AND table_name IN ('render_jobs', 'user_assets');

-- 3. Check for table locks
SELECT pid,
       mode,
       granted,
       query
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.relation::regclass::text IN ('render_jobs', 'user_assets');
```

**Troubleshooting Steps:**

1. **Check Database Connection**
   - Verify connection string
   - Check network connectivity
   - Test with different client

2. **Verify Table Structure**

   ```sql
   -- Check if tables exist and have expected structure
   \d render_jobs
   \d user_assets

   -- Check for missing columns
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'render_jobs';
   ```

3. **Check for Data Corruption**

   ```sql
   -- Check for invalid data types
   SELECT id, output_url, created_at
   FROM render_jobs
   WHERE status = 'completed'
     AND output_url IS NOT NULL
   LIMIT 5;
   ```

4. **Test Individual Queries**

   ```sql
   -- Test each cleanup query individually
   -- 1. Test orphaned jobs query
   SELECT id, output_url, created_at
   FROM render_jobs
   WHERE status = 'completed'
     AND output_url IS NOT NULL
     AND created_at < NOW() - INTERVAL '3 minutes';

   -- 2. Test saved assets query
   SELECT metadata
   FROM user_assets
   WHERE metadata->>'render_job_id' IS NOT NULL;
   ```

### 2D. Saved Assets Being Affected

**Symptoms:** Saved assets being deleted or modified

**Immediate Actions:**

```sql
-- 1. Check saved assets count
SELECT COUNT(*) as saved_assets_count
FROM user_assets
WHERE asset_type = 'generated_saved'
  AND metadata->>'render_job_id' IS NOT NULL;

-- 2. Check for recent asset deletions
SELECT COUNT(*) as deleted_assets
FROM user_assets
WHERE deleted_at IS NOT NULL  -- If you have soft deletes
  AND deleted_at > NOW() - INTERVAL '1 hour';

-- 3. Verify asset-render job relationships
SELECT COUNT(*) as orphaned_assets
FROM user_assets ua
LEFT JOIN render_jobs rj ON ua.metadata->>'render_job_id' = rj.id::text
WHERE ua.asset_type = 'generated_saved'
  AND rj.id IS NULL;
```

**Troubleshooting Steps:**

1. **Check Cleanup Filtering Logic**

   ```typescript
   // Verify the filtering logic is correct
   const savedJobIds = new Set(
     (savedAssets || [])
       .map((asset) => asset.metadata?.render_job_id as string)
       .filter(Boolean),
   );

   console.log("Saved job IDs:", Array.from(savedJobIds));
   console.log(
     "Jobs to delete:",
     jobsToDelete.map((j) => j.id),
   );
   ```

2. **Verify Foreign Key Relationships**

   ```sql
   -- Check if all saved assets have valid render job references
   SELECT ua.id, ua.metadata->>'render_job_id' as render_job_id
   FROM user_assets ua
   WHERE ua.asset_type = 'generated_saved'
     AND ua.metadata->>'render_job_id' IS NOT NULL
     AND ua.metadata->>'render_job_id' NOT IN (
       SELECT id::text FROM render_jobs
     );
   ```

3. **Check Metadata Structure**
   ```sql
   -- Verify metadata structure is correct
   SELECT id,
          metadata->>'render_job_id' as render_job_id,
          metadata->>'source' as source
   FROM user_assets
   WHERE asset_type = 'generated_saved'
   LIMIT 5;
   ```

---

## STEP 3: EMERGENCY CLEANUP PROCEDURES

### 3A. Manual Emergency Cleanup

**If automated cleanup is not working, use manual procedures:**

```sql
-- Emergency manual cleanup (run with extreme caution)
-- 1. First, identify orphaned files
SELECT rj.id, rj.output_url, rj.created_at
FROM render_jobs rj
LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
WHERE rj.status = 'completed'
  AND rj.output_url IS NOT NULL
  AND ua.id IS NULL
  AND rj.created_at < NOW() - INTERVAL '1 hour'
ORDER BY rj.created_at DESC
LIMIT 100;

-- 2. Delete orphaned render job records (BATCH DELETE)
DELETE FROM render_jobs
WHERE id IN (
  SELECT rj.id
  FROM render_jobs rj
  LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
  WHERE rj.status = 'completed'
    AND rj.output_url IS NOT NULL
    AND ua.id IS NULL
    AND rj.created_at < NOW() - INTERVAL '1 hour'
  LIMIT 100
);

-- 3. Verify deletion
SELECT COUNT(*) as remaining_orphaned_jobs
FROM render_jobs rj
LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
WHERE rj.status = 'completed'
  AND rj.output_url IS NOT NULL
  AND ua.id IS NULL;
```

### 3B. Storage Emergency Cleanup

**Manual file deletion from Supabase storage:**

```typescript
// Emergency storage cleanup script
// Run this only if automated cleanup is completely broken

import { createServiceClient } from "@/utils/supabase/service";

async function emergencyStorageCleanup() {
  const supabase = createServiceClient();

  // Get orphaned files
  const { data: orphanedJobs, error } = await supabase
    .from("render_jobs")
    .select("id, output_url, created_at")
    .eq("status", "completed")
    .not("output_url", "is", null)
    .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if (error) {
    console.error("Failed to fetch orphaned jobs:", error);
    return;
  }

  // Get saved assets to filter out
  const { data: savedAssets } = await supabase
    .from("user_assets")
    .select("metadata")
    .not("metadata->render_job_id", "is", null);

  const savedJobIds = new Set(
    (savedAssets || [])
      .map((asset) => asset.metadata?.render_job_id as string)
      .filter(Boolean),
  );

  const filesToDelete = orphanedJobs.filter((job) => !savedJobIds.has(job.id));

  console.log(`Found ${filesToDelete.length} orphaned files to delete`);

  // Delete files in batches
  for (const job of filesToDelete) {
    try {
      const fileInfo = parseStorageUrl(job.output_url);
      if (fileInfo) {
        const { error: deleteError } = await supabase.storage
          .from(fileInfo.bucket)
          .remove([fileInfo.path]);

        if (!deleteError) {
          console.log(`Deleted: ${fileInfo.bucket}/${fileInfo.path}`);
        } else {
          console.error(
            `Failed to delete ${fileInfo.path}:`,
            deleteError.message,
          );
        }
      }
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);
    }
  }
}

// Helper function for URL parsing
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");

    const signIndex = pathParts.indexOf("sign");
    if (signIndex === -1 || signIndex + 2 >= pathParts.length) {
      return null;
    }

    const bucket = pathParts[signIndex + 1];
    const path = pathParts.slice(signIndex + 2).join("/");

    return { bucket, path };
  } catch {
    return null;
  }
}
```

---

## STEP 4: COMPLETE ROLLBACK PROCEDURES

### 4A. Immediate Rollback (If Critical Issues)

**Complete system rollback to pre-deployment state:**

1. **Revert Configuration Changes**

   ```typescript
   // src/server/storage/config.ts
   // Revert to original values:
   export const STORAGE_CONFIG = {
     // ... other config unchanged ...

     // Cleanup configuration - ORIGINAL VALUES
     TEMP_DIR_CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
     MAX_TEMP_FILE_AGE_MS: 60 * 60 * 1000, // 1 hour

     // ... rest of config unchanged ...
   } as const;
   ```

2. **Remove New Cleanup Methods**

   ```typescript
   // src/server/storage/smart-storage-provider.ts
   // Remove these methods:
   // - performComprehensiveCleanup
   // - cleanupOrphanedSupabaseFiles
   // - cleanupOrphanedRenderJobs
   // - parseStorageUrl
   ```

3. **Restore Original startCleanupInterval**

   ```typescript
   // src/server/storage/smart-storage-provider.ts
   // Restore original method:
   private startCleanupInterval(): void {
     this.cleanupInterval = setInterval(() => {
       // Use void to explicitly ignore the promise
       void this.cleanupOldTempFiles().catch((error) => {
         this.logger.error('Temp file cleanup failed:', error);
       });
     }, STORAGE_CONFIG.TEMP_DIR_CLEANUP_INTERVAL_MS);
   }
   ```

4. **Redeploy Application**
   ```bash
   # Deploy the rolled-back version
   # Verify system returns to pre-deployment state
   # Confirm only local temp file cleanup is working
   ```

### 4B. Partial Rollback (If Only Some Issues)

**Selective rollback for specific problems:**

1. **If Only Storage Cleanup Failing**

   ```typescript
   // Disable only the storage cleanup part
   private async performComprehensiveCleanup(): Promise<void> {
     try {
       this.logger.info('Starting comprehensive cleanup cycle');

       // 1. Clean local temp files (existing functionality)
       await this.cleanupOldTempFiles();

       // 2. DISABLE: Clean orphaned Supabase storage files
       // await this.cleanupOrphanedSupabaseFiles();

       // 3. DISABLE: Clean orphaned render job records
       // await this.cleanupOrphanedRenderJobs();

       this.logger.debug('Comprehensive cleanup cycle completed (storage cleanup disabled)');

     } catch (error) {
       this.logger.error('Comprehensive cleanup cycle failed:', error);
     }
   }
   ```

2. **If Only Database Cleanup Failing**

   ```typescript
   // Disable only the database cleanup part
   private async performComprehensiveCleanup(): Promise<void> {
     try {
       this.logger.info('Starting comprehensive cleanup cycle');

       // 1. Clean local temp files (existing functionality)
       await this.cleanupOldTempFiles();

       // 2. Clean orphaned Supabase storage files
       await this.cleanupOrphanedSupabaseFiles();

       // 3. DISABLE: Clean orphaned render job records
       // await this.cleanupOrphanedRenderJobs();

       this.logger.debug('Comprehensive cleanup cycle completed (database cleanup disabled)');

     } catch (error) {
       this.logger.error('Comprehensive cleanup cycle failed:', error);
     }
   }
   ```

---

## STEP 5: POST-EMERGENCY PROCEDURES

### 5A. Incident Documentation

**Document the emergency for future reference:**

1. **Incident Summary**
   - Date and time of incident
   - Nature of the problem
   - Impact on users and system
   - Actions taken to resolve

2. **Root Cause Analysis**
   - What caused the problem
   - Why it wasn't caught earlier
   - What can be improved

3. **Resolution Steps**
   - Steps taken to fix the problem
   - Time to resolution
   - Effectiveness of emergency procedures

4. **Lessons Learned**
   - What worked well
   - What could be improved
   - Recommendations for future

### 5B. System Recovery Verification

**Verify system is fully recovered:**

1. **Functionality Verification**
   - [ ] Local temp file cleanup working
   - [ ] No orphaned files accumulating
   - [ ] User operations unaffected
   - [ ] System performance normal

2. **Data Integrity Verification**
   - [ ] Saved assets intact
   - [ ] No data corruption
   - [ ] Database consistency maintained
   - [ ] Storage usage stable

3. **Performance Verification**
   - [ ] Cleanup cycles running normally
   - [ ] No performance degradation
   - [ ] Database queries performing well
   - [ ] Storage operations successful

### 5C. Prevention Measures

**Implement measures to prevent future incidents:**

1. **Enhanced Monitoring**
   - Add more comprehensive alerting
   - Implement automated health checks
   - Add performance monitoring

2. **Improved Error Handling**
   - Better error recovery mechanisms
   - Graceful degradation procedures
   - Automatic retry mechanisms

3. **Testing Improvements**
   - More comprehensive testing procedures
   - Stress testing of cleanup system
   - Failure scenario testing

---

## STEP 6: COMMUNICATION PROCEDURES

### 6A. Internal Communication

**Team communication during emergencies:**

1. **Immediate Notification**
   - Alert operations team
   - Notify development team
   - Inform system administrators

2. **Status Updates**
   - Regular status updates every 30 minutes
   - Progress on resolution
   - Expected time to resolution

3. **Escalation Procedures**
   - When to escalate to management
   - Contact information for escalation
   - Escalation criteria

### 6B. External Communication

**User and stakeholder communication:**

1. **User Notifications**
   - Clear explanation of the issue
   - Expected impact on users
   - Timeline for resolution
   - Alternative solutions if available

2. **Stakeholder Updates**
   - Business impact assessment
   - Cost implications
   - Risk assessment
   - Mitigation strategies

---

## SUPPORT AND CONTACTS

### For Technical Emergencies

- **System Administrator**: [Contact Information]
- **Development Team Lead**: [Contact Information]
- **Operations Team**: [Contact Information]

### For Business Impact Assessment

- **Product Manager**: [Contact Information]
- **Business Operations**: [Contact Information]
- **Customer Support**: [Contact Information]

---

**Last Updated:** Implementation Date
**Version:** 1.0
**Status:** Ready for Emergency Response
