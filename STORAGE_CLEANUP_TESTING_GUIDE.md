# STORAGE CLEANUP TESTING GUIDE

## Immediate Testing Protocol for 3-Minute Cleanup Implementation

### OVERVIEW

This guide provides step-by-step testing procedures to validate the new comprehensive storage cleanup system before production deployment.

---

## STEP 1: IMMEDIATE TESTING PROTOCOL

### 1A. Deploy and Test

1. **Deploy changes** to your development environment
2. **Generate test content:**
   - Create 3-4 images/videos
   - **Do NOT save them to assets**
   - Note the render job IDs
3. **Wait 4 minutes**
4. **Verify cleanup:**
   - Check server logs for cleanup messages
   - Verify files deleted from Supabase storage
   - Confirm render job records removed

### 1B. Validation Queries

**Run these in Supabase SQL Editor after 4+ minutes:**

```sql
-- Should return 0 after cleanup
SELECT COUNT(*) as orphaned_files_count
FROM render_jobs rj
LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
WHERE rj.status = 'completed'
  AND rj.output_url IS NOT NULL
  AND ua.id IS NULL
  AND rj.created_at < NOW() - INTERVAL '4 minutes';

-- Check recent cleanup activity
SELECT COUNT(*) as total_completed_jobs
FROM render_jobs
WHERE status = 'completed'
  AND created_at > NOW() - INTERVAL '10 minutes';

-- Verify saved assets still exist
SELECT COUNT(*) as saved_assets_count
FROM user_assets
WHERE asset_type = 'generated_saved'
  AND metadata->>'render_job_id' IS NOT NULL;
```

### 1C. Log Monitoring

**Look for these log entries every 3 minutes:**

```
✅ "Starting comprehensive cleanup cycle"
✅ "Cleaning up X orphaned Supabase files"
✅ "Successfully deleted X orphaned files"
✅ "Successfully deleted X orphaned render job records"
✅ "Comprehensive cleanup cycle completed"
```

---

## STEP 2: TESTING TIMELINE

### Phase 1: Immediate Validation (First 30 minutes)

- [ ] Deploy changes
- [ ] Generate 3-4 test renders (don't save)
- [ ] Wait 4 minutes
- [ ] Verify cleanup logs appear
- [ ] Run validation queries
- [ ] Check Supabase storage for deleted files

### Phase 2: Extended Testing (1-2 days)

- [ ] Monitor cleanup cycles every 3 minutes
- [ ] Generate additional test content
- [ ] Verify no saved assets are affected
- [ ] Check storage usage trends
- [ ] Monitor error logs

### Phase 3: Production Preparation

- [ ] Revert to 1-hour intervals
- [ ] Deploy to staging
- [ ] Final validation
- [ ] Production deployment

---

## STEP 3: VALIDATION CHECKLIST

### ✅ Cleanup Cycle Verification

- [ ] Cleanup runs every 3 minutes
- [ ] Logs show "Starting comprehensive cleanup cycle"
- [ ] No errors in cleanup process
- [ ] "Comprehensive cleanup cycle completed" appears

### ✅ File Cleanup Verification

- [ ] Orphaned files deleted from Supabase storage
- [ ] Local temp files cleaned up
- [ ] Saved assets remain untouched
- [ ] Storage usage decreases

### ✅ Database Cleanup Verification

- [ ] Orphaned render job records deleted
- [ ] Saved asset records preserved
- [ ] Foreign key relationships intact
- [ ] No orphaned references

### ✅ Performance Verification

- [ ] Cleanup completes within reasonable time
- [ ] No impact on user operations
- [ ] Database queries perform well
- [ ] Storage operations complete successfully

---

## STEP 4: TROUBLESHOOTING

### Common Issues and Solutions

#### Issue: Cleanup not running

**Symptoms:** No cleanup logs every 3 minutes
**Solutions:**

1. Check if SmartStorageProvider is initialized
2. Verify STORAGE_CONFIG values
3. Check for JavaScript errors in console
4. Restart application

#### Issue: Files not being deleted

**Symptoms:** Orphaned files remain in storage
**Solutions:**

1. Check Supabase permissions
2. Verify parseStorageUrl logic
3. Check output_url format in database
4. Verify bucket access

#### Issue: Database errors

**Symptoms:** Cleanup logs show database errors
**Solutions:**

1. Check database connectivity
2. Verify table permissions
3. Check SQL query syntax
4. Verify table structure

#### Issue: Saved assets affected

**Symptoms:** Saved assets being deleted
**Solutions:**

1. Check metadata->render_job_id logic
2. Verify foreign key relationships
3. Check cleanup filtering logic
4. Review saved asset queries

---

## STEP 5: SUCCESS METRICS

### Immediate Success Indicators (First Week)

- [ ] Cleanup cycles run every 3 minutes without errors
- [ ] Orphaned files reduced from current accumulation to near-zero
- [ ] No saved assets accidentally deleted
- [ ] Storage usage growth rate decreases

### Long-term Success Indicators (First Month)

- [ ] Storage costs stabilized/reduced
- [ ] Database performance maintained
- [ ] Zero manual cleanup interventions needed
- [ ] User workflow unaffected

---

## STEP 6: PRODUCTION DEPLOYMENT CHECKLIST

### Pre-Deployment

- [ ] Testing completed successfully
- [ ] All validation queries pass
- [ ] No errors in cleanup logs
- [ ] Storage cleanup working as expected
- [ ] Database cleanup working as expected

### Deployment

- [ ] Deploy during low-traffic period
- [ ] Monitor logs immediately after deployment
- [ ] Verify cleanup runs as expected
- [ ] Run validation queries after first cleanup cycle

### Post-Deployment

- [ ] Monitor first 30 minutes closely
- [ ] Verify saved assets remain untouched
- [ ] Confirm temporary files are being cleaned
- [ ] Check storage usage trends

---

## STEP 7: ROLLBACK PROCEDURES

### If Issues Arise

1. **Immediate Rollback:**
   - Revert config.ts to 1-hour intervals
   - Remove new cleanup methods
   - Restore original startCleanupInterval
   - Redeploy application

2. **Emergency Cleanup:**
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

---

## STEP 8: ONGOING MONITORING

### Daily Monitoring

- [ ] Check cleanup logs for errors
- [ ] Monitor storage usage trends
- [ ] Verify cleanup cycles running
- [ ] Check for orphaned files

### Weekly Monitoring

- [ ] Run health check queries
- [ ] Review storage cost trends
- [ ] Check database performance
- [ ] Verify saved asset integrity

### Monthly Monitoring

- [ ] Comprehensive system review
- [ ] Storage usage analysis
- [ ] Performance metrics review
- [ ] Cost optimization review

---

## SUPPORT AND CONTACTS

### For Technical Issues

- Check application logs first
- Review this testing guide
- Check Supabase dashboard
- Review database queries

### For Emergency Situations

- Use rollback procedures
- Run emergency cleanup queries
- Contact system administrator
- Document incident for review

---

**Last Updated:** Implementation Date
**Version:** 1.0
**Status:** Ready for Testing
