# PRODUCTION DEPLOYMENT GUIDE
## Storage Cleanup System - Production Deployment Procedures

### OVERVIEW
This guide provides step-by-step procedures for deploying the comprehensive storage cleanup system to production after successful testing validation.

---

## STEP 1: PRE-DEPLOYMENT CHECKLIST

### 1A. Testing Validation Complete
- [ ] **Testing completed successfully** in development environment
- [ ] **All validation queries pass** without errors
- [ ] **No errors in cleanup logs** during testing period
- [ ] **Storage cleanup working as expected** (files deleted from Supabase)
- [ ] **Database cleanup working as expected** (orphaned records deleted)
- [ ] **Saved assets remain untouched** during cleanup cycles
- [ ] **Cleanup cycles run every 3 minutes** without interruption

### 1B. Environment Preparation
- [ ] **Backup database** (critical - in case rollback needed)
- [ ] **Staging environment tested** (if available)
- [ ] **Current saved assets properly tracked** in database
- [ ] **No active render jobs** that will be affected
- [ ] **Low-traffic deployment window** identified and scheduled

### 1C. Team Preparation
- [ ] **Operations team notified** of deployment
- [ ] **Monitoring procedures** communicated to team
- [ ] **Rollback procedures** documented and understood
- [ ] **Emergency contacts** identified and available
- [ ] **Deployment checklist** reviewed by team

---

## STEP 2: PRODUCTION DEPLOYMENT PROCESS

### 2A. Pre-Deployment Verification (30 minutes before)
```bash
# 1. Verify current system state
# Run these queries in Supabase SQL Editor:

-- Check current orphaned files count
SELECT COUNT(*) as current_orphaned_count
FROM render_jobs rj
LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
WHERE rj.status = 'completed' 
  AND rj.output_url IS NOT NULL 
  AND ua.id IS NULL;

-- Verify saved assets count
SELECT COUNT(*) as saved_assets_count
FROM user_assets 
WHERE asset_type = 'generated_saved'
  AND metadata->>'render_job_id' IS NOT NULL;

-- Check recent render job activity
SELECT COUNT(*) as recent_jobs
FROM render_jobs 
WHERE created_at > NOW() - INTERVAL '1 hour';
```

### 2B. Deployment Steps (During Low-Traffic Window)

1. **Deploy Application Changes**
   ```bash
   # Deploy the updated code with new cleanup methods
   # Ensure SmartStorageProvider is updated
   # Verify STORAGE_CONFIG changes are applied
   ```

2. **Immediate Post-Deployment Verification**
   - [ ] **Application starts successfully** without errors
   - [ ] **SmartStorageProvider initializes** without issues
   - [ ] **Cleanup interval starts** (check logs for initialization)
   - [ ] **No database connection errors** in logs

3. **First Cleanup Cycle Monitoring (Wait 3-4 minutes)**
   - [ ] **Look for cleanup logs** in application console
   - [ ] **Verify "Starting comprehensive cleanup cycle"** appears
   - [ ] **Check for any error messages** during cleanup
   - [ ] **Confirm "Comprehensive cleanup cycle completed"** appears

### 2C. Post-Deployment Validation (First 30 minutes)

1. **Immediate Validation (5 minutes after deployment)**
   ```sql
   -- Check if cleanup is working
   SELECT COUNT(*) as orphaned_files_after_cleanup
   FROM render_jobs rj
   LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
   WHERE rj.status = 'completed' 
     AND rj.output_url IS NOT NULL 
     AND ua.id IS NULL
     AND rj.created_at < NOW() - INTERVAL '5 minutes';
   ```

2. **Second Cleanup Cycle Verification (6-9 minutes after deployment)**
   - [ ] **Monitor second cleanup cycle** logs
   - [ ] **Verify no errors** in cleanup process
   - [ ] **Check storage usage** in Supabase dashboard
   - [ ] **Confirm files are being deleted** as expected

3. **Third Cleanup Cycle Verification (9-12 minutes after deployment)**
   - [ ] **Monitor third cleanup cycle** logs
   - [ ] **Run validation queries** again
   - [ ] **Check for any issues** or anomalies
   - [ ] **Verify system stability** maintained

---

## STEP 3: PRODUCTION MONITORING

### 3A. First 30 Minutes (Critical Monitoring Period)
- [ ] **Monitor every cleanup cycle** (every 3 minutes)
- [ ] **Check application logs** for errors or warnings
- [ ] **Verify cleanup operations** complete successfully
- [ ] **Monitor database performance** during cleanup
- [ ] **Check Supabase storage** for expected file deletions

### 3B. First 24 Hours (Extended Monitoring)
- [ ] **Run validation queries** every 2 hours
- [ ] **Monitor storage usage trends** in Supabase dashboard
- [ ] **Check application performance** during cleanup cycles
- [ ] **Verify user operations** unaffected by cleanup
- [ ] **Monitor error logs** for any issues

### 3C. First Week (Stability Monitoring)
- [ ] **Daily validation queries** to ensure cleanup effectiveness
- [ ] **Weekly storage usage analysis** to track cost savings
- [ ] **Performance monitoring** to ensure no degradation
- [ ] **User feedback collection** to verify no workflow impact

---

## STEP 4: SUCCESS VALIDATION

### 4A. Immediate Success Indicators (First Day)
- [ ] **Cleanup cycles run every 3 minutes** without errors
- [ ] **Orphaned files reduced** from pre-deployment levels
- [ ] **No saved assets accidentally deleted** or affected
- [ ] **Storage usage growth rate decreases** as expected
- [ ] **Database performance maintained** during cleanup cycles

### 4B. Short-term Success Indicators (First Week)
- [ ] **Consistent cleanup cycles** without interruption
- [ ] **Orphaned file count remains low** (near zero)
- [ ] **Storage costs stabilized** or reduced
- [ ] **No manual cleanup interventions** required
- [ ] **User workflow completely unaffected**

### 4C. Long-term Success Indicators (First Month)
- [ ] **Storage costs significantly reduced** from pre-deployment
- [ ] **Database performance improved** due to reduced orphaned records
- [ ] **Zero system issues** related to cleanup operations
- [ ] **Operational efficiency improved** with automated cleanup
- [ ] **User satisfaction maintained** or improved

---

## STEP 5: REVERT TO PRODUCTION SETTINGS

### 5A. After Testing Validation (Recommended: 1-2 days)

**Update `src/server/storage/config.ts` back to production values:**

```typescript
// Cleanup configuration - PRODUCTION SETTINGS
TEMP_DIR_CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
MAX_TEMP_FILE_AGE_MS: 60 * 60 * 1000, // 1 hour
```

### 5B. Production Deployment of Final Settings

1. **Deploy Production Configuration**
   - Update config.ts with 1-hour intervals
   - Deploy to production
   - Monitor first cleanup cycle with new timing

2. **Verify Production Settings**
   - Cleanup should now run every hour instead of every 3 minutes
   - Files older than 1 hour should be cleaned up
   - System should maintain same cleanup effectiveness

---

## STEP 6: ONGOING PRODUCTION MONITORING

### 6A. Weekly Health Checks
```sql
-- Monitor cleanup effectiveness
SELECT 
  COUNT(*) as orphaned_jobs,
  DATE_TRUNC('day', created_at) as day
FROM render_jobs rj
LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
WHERE rj.status = 'completed' 
  AND rj.output_url IS NOT NULL 
  AND ua.id IS NULL
  AND rj.created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

-- Storage usage trends
SELECT 
  COUNT(*) as total_assets,
  SUM(file_size) as total_bytes,
  asset_type
FROM user_assets 
GROUP BY asset_type;
```

### 6B. Monthly Performance Review
- [ ] **Storage cost analysis** and trend review
- [ ] **Database performance metrics** review
- [ ] **Cleanup system health** assessment
- [ ] **User impact assessment** and feedback review
- [ ] **Optimization opportunities** identification

---

## STEP 7: EMERGENCY PROCEDURES

### 7A. If Cleanup Stops Working
1. **Check server logs** for error messages
2. **Verify database connectivity** and permissions
3. **Test Supabase storage access** and bucket permissions
4. **Restart application** if needed
5. **Contact system administrator** if issues persist

### 7B. If Storage Usage Spikes
```sql
-- Emergency manual cleanup (run with caution)
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
```

### 7C. If Saved Assets Are Affected
1. **Immediate rollback** to previous version
2. **Restore from database backup** if needed
3. **Investigate root cause** of the issue
4. **Fix the problem** before redeployment
5. **Document incident** for future reference

---

## STEP 8: ROLLBACK PLAN

### 8A. Complete Rollback Procedure
1. **Revert config.ts** to original 1-hour intervals
2. **Remove new cleanup methods** from SmartStorageProvider
3. **Restore original startCleanupInterval** method
4. **Redeploy application** with original code
5. **Verify system returns** to pre-deployment state

### 8B. Partial Rollback (If Only Some Issues)
1. **Identify specific problems** and their causes
2. **Fix individual issues** without full rollback
3. **Test fixes** in development environment
4. **Deploy fixes** incrementally
5. **Monitor closely** after each fix

---

## SUCCESS METRICS SUMMARY

### Immediate (First Week)
- [ ] Cleanup cycles run every 3 minutes without errors
- [ ] Orphaned files reduced from current accumulation to near-zero
- [ ] No saved assets accidentally deleted
- [ ] Storage usage growth rate decreases

### Long-term (First Month)  
- [ ] Storage costs stabilized/reduced
- [ ] Database performance maintained
- [ ] Zero manual cleanup interventions needed
- [ ] User workflow unaffected

---

## TECHNICAL SPECIFICATION SUMMARY

**Files Modified:** 2
- `src/server/storage/config.ts` (timing values)
- `src/server/storage/smart-storage-provider.ts` (cleanup methods)

**Database Operations:** Read-only queries + targeted deletes
**Storage Operations:** Individual file deletions from Supabase storage
**Error Handling:** Comprehensive with graceful degradation
**Logging:** Full audit trail for all cleanup operations
**Performance Impact:** Minimal - runs briefly every 3 minutes
**Safety:** Only deletes confirmed orphaned files >3 minutes old

**Production Readiness:** ✅ Complete
- Comprehensive error handling
- Full logging and monitoring
- Rollback procedures documented
- Zero impact on user operations
- Solves confirmed storage leak issue

---

**Last Updated:** Implementation Date
**Version:** 1.0
**Status:** Ready for Production Deployment
