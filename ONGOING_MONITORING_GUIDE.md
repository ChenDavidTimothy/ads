# ONGOING MONITORING GUIDE

## Storage Cleanup System - Long-term Monitoring and Maintenance

### OVERVIEW

This guide provides comprehensive procedures for ongoing monitoring, maintenance, and optimization of the storage cleanup system after successful production deployment.

---

## STEP 1: DAILY MONITORING PROCEDURES

### 1A. Morning Health Check (Daily at 9 AM)

```bash
# 1. Check application logs for overnight cleanup activity
# Look for these log entries in your application console:

✅ "Starting comprehensive cleanup cycle"
✅ "Cleaning up X orphaned Supabase files"
✅ "Successfully deleted X orphaned files"
✅ "Successfully deleted X orphaned render job records"
✅ "Comprehensive cleanup cycle completed"

# 2. Check for any error messages or warnings
# Look for these concerning log entries:

❌ "Comprehensive cleanup failed:"
❌ "Failed to cleanup orphaned Supabase files:"
❌ "Failed to cleanup orphaned render job records:"
❌ "Database connection error"
❌ "Supabase storage access error"
```

### 1B. Daily Validation Queries

**Run these in Supabase SQL Editor daily:**

```sql
-- 1. Check current orphaned files count
SELECT COUNT(*) as orphaned_files_count
FROM render_jobs rj
LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
WHERE rj.status = 'completed'
  AND rj.output_url IS NOT NULL
  AND ua.id IS NULL;

-- 2. Check recent cleanup activity (last 24 hours)
SELECT
  COUNT(*) as total_completed_jobs,
  COUNT(CASE WHEN ua.id IS NOT NULL THEN 1 END) as saved_jobs,
  COUNT(CASE WHEN ua.id IS NULL THEN 1 END) as orphaned_jobs
FROM render_jobs rj
LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
WHERE rj.status = 'completed'
  AND rj.created_at > NOW() - INTERVAL '24 hours';

-- 3. Verify saved assets integrity
SELECT COUNT(*) as saved_assets_count
FROM user_assets
WHERE asset_type = 'generated_saved'
  AND metadata->>'render_job_id' IS NOT NULL;
```

### 1C. Daily Storage Monitoring

- [ ] **Check Supabase storage dashboard** for usage trends
- [ ] **Monitor bucket usage** (images vs videos)
- [ ] **Check for unexpected file growth** in any bucket
- [ ] **Verify cleanup effectiveness** by comparing daily counts

---

## STEP 2: WEEKLY HEALTH CHECKS

### 2A. Weekly Comprehensive Analysis (Every Monday)

```sql
-- 1. Monitor cleanup effectiveness over the past week
SELECT
  COUNT(*) as orphaned_jobs,
  DATE_TRUNC('day', created_at) as day,
  COUNT(CASE WHEN ua.id IS NOT NULL THEN 1 END) as saved_jobs
FROM render_jobs rj
LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
WHERE rj.status = 'completed'
  AND rj.output_url IS NOT NULL
  AND rj.created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

-- 2. Storage usage trends analysis
SELECT
  COUNT(*) as total_assets,
  SUM(file_size) as total_bytes,
  asset_type,
  DATE_TRUNC('day', created_at) as day
FROM user_assets
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY asset_type, DATE_TRUNC('day', created_at)
ORDER BY day DESC, asset_type;

-- 3. Cleanup system performance metrics
SELECT
  COUNT(*) as total_cleanup_cycles,
  COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_cleanups,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as failed_cleanups,
  DATE_TRUNC('day', created_at) as day
FROM cleanup_logs  -- If you implement cleanup logging
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;
```

### 2B. Weekly Performance Review

- [ ] **Database query performance** during cleanup cycles
- [ ] **Storage operation success rates** (file deletions)
- [ ] **Application performance impact** during cleanup
- [ ] **User operation success rates** during cleanup cycles

### 2C. Weekly Cost Analysis

- [ ] **Storage cost trends** over the past week
- [ ] **Cost savings achieved** from cleanup operations
- [ ] **Projected monthly storage costs** based on trends
- [ ] **Optimization opportunities** identification

---

## STEP 3: MONTHLY PERFORMANCE REVIEW

### 3A. Monthly Comprehensive Assessment (First of each month)

```sql
-- 1. Monthly cleanup effectiveness summary
SELECT
  COUNT(*) as total_orphaned_files_cleaned,
  COUNT(DISTINCT DATE_TRUNC('day', created_at)) as days_with_cleanup,
  AVG(orphaned_files_per_day) as avg_orphaned_files_per_day
FROM (
  SELECT
    COUNT(*) as orphaned_files_per_day,
    DATE_TRUNC('day', created_at) as created_at
  FROM render_jobs rj
  LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
  WHERE rj.status = 'completed'
    AND rj.output_url IS NOT NULL
    AND ua.id IS NULL
    AND rj.created_at > NOW() - INTERVAL '30 days'
  GROUP BY DATE_TRUNC('day', created_at)
) daily_stats;

-- 2. Monthly storage usage analysis
SELECT
  asset_type,
  COUNT(*) as total_assets,
  SUM(file_size) as total_bytes,
  AVG(file_size) as avg_file_size,
  MIN(file_size) as min_file_size,
  MAX(file_size) as max_file_size
FROM user_assets
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY asset_type;

-- 3. Monthly cost savings calculation
SELECT
  'Previous Month' as period,
  SUM(file_size) as total_storage_bytes
FROM render_jobs rj
LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
WHERE rj.status = 'completed'
  AND rj.output_url IS NOT NULL
  AND ua.id IS NULL
  AND rj.created_at BETWEEN
    NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days'
UNION ALL
SELECT
  'Current Month' as period,
  SUM(file_size) as total_storage_bytes
FROM render_jobs rj
LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
WHERE rj.status = 'completed'
  AND rj.output_url IS NOT NULL
  AND ua.id IS NULL
  AND rj.created_at > NOW() - INTERVAL '30 days';
```

### 3B. Monthly System Health Assessment

- [ ] **Cleanup system reliability** over the past month
- [ ] **Error rate analysis** and trend identification
- [ ] **Performance degradation** detection
- [ ] **User impact assessment** and feedback review

### 3C. Monthly Optimization Review

- [ ] **Cleanup timing optimization** (adjust intervals if needed)
- [ ] **Database query optimization** opportunities
- [ ] **Storage strategy optimization** recommendations
- [ ] **Cost optimization** opportunities

---

## STEP 4: ALERT THRESHOLDS AND MONITORING

### 4A. Critical Alert Thresholds

**Set up monitoring for these critical conditions:**

```sql
-- 1. Orphaned files count > 100 (immediate alert)
SELECT COUNT(*) as orphaned_files_count
FROM render_jobs rj
LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
WHERE rj.status = 'completed'
  AND rj.output_url IS NOT NULL
  AND ua.id IS NULL;

-- 2. Cleanup cycle failures > 3 consecutive (alert)
-- Monitor logs for consecutive "Comprehensive cleanup failed" messages

-- 3. Storage usage spike > 20% in 24 hours (alert)
SELECT
  (current_usage - previous_usage) / previous_usage * 100 as usage_growth_percent
FROM (
  SELECT
    SUM(file_size) as current_usage
  FROM user_assets
  WHERE created_at > NOW() - INTERVAL '24 hours'
) current,
(
  SELECT
    SUM(file_size) as previous_usage
  FROM user_assets
  WHERE created_at BETWEEN
    NOW() - INTERVAL '48 hours' AND NOW() - INTERVAL '24 hours'
) previous;
```

### 4B. Warning Alert Thresholds

**Set up monitoring for these warning conditions:**

```sql
-- 1. Orphaned files count > 50 (warning)
-- 2. Cleanup cycle duration > 30 seconds (warning)
-- 3. Database query time > 5 seconds during cleanup (warning)
-- 4. Storage usage growth > 10% in 24 hours (warning)
```

### 4C. Alert Response Procedures

1. **Critical Alerts**: Immediate response required
   - Check system logs
   - Verify database connectivity
   - Test Supabase storage access
   - Implement emergency procedures if needed

2. **Warning Alerts**: Response within 4 hours
   - Investigate root cause
   - Monitor trends
   - Plan optimization if needed

---

## STEP 5: PERFORMANCE OPTIMIZATION

### 5A. Database Performance Monitoring

```sql
-- 1. Monitor query performance during cleanup
EXPLAIN ANALYZE
SELECT COUNT(*) as orphaned_jobs
FROM render_jobs rj
LEFT JOIN user_assets ua ON ua.metadata->>'render_job_id' = rj.id::text
WHERE rj.status = 'completed'
  AND rj.output_url IS NOT NULL
  AND ua.id IS NULL
  AND rj.created_at < NOW() - INTERVAL '3 minutes';

-- 2. Check for missing indexes
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('render_jobs', 'user_assets')
ORDER BY idx_scan DESC;
```

### 5B. Storage Performance Monitoring

- [ ] **Supabase storage API response times** during cleanup
- [ ] **File deletion success rates** and timing
- [ ] **Bucket access performance** analysis
- [ ] **Storage quota utilization** trends

### 5C. Application Performance Monitoring

- [ ] **Cleanup cycle duration** monitoring
- [ ] **Memory usage** during cleanup operations
- [ ] **CPU usage** during cleanup operations
- [ ] **User operation impact** during cleanup

---

## STEP 6: MAINTENANCE PROCEDURES

### 6A. Monthly Maintenance Tasks

1. **Database Maintenance**
   - [ ] **Analyze table statistics** for render_jobs and user_assets
   - [ ] **Update table statistics** if needed
   - [ ] **Check for table fragmentation** and optimize if needed
   - [ ] **Review and optimize indexes** based on usage patterns

2. **Storage Maintenance**
   - [ ] **Review storage bucket policies** and permissions
   - [ ] **Check storage quota limits** and adjust if needed
   - [ ] **Review storage access logs** for anomalies
   - [ ] **Optimize storage bucket organization** if needed

3. **Application Maintenance**
   - [ ] **Review cleanup logs** for patterns and issues
   - [ ] **Update cleanup configuration** if needed
   - [ ] **Review error handling** and improve if needed
   - [ ] **Update monitoring procedures** based on learnings

### 6B. Quarterly Maintenance Tasks

1. **System Review**
   - [ ] **Comprehensive performance review** of cleanup system
   - [ ] **Cost-benefit analysis** of cleanup operations
   - [ ] **User impact assessment** and feedback review
   - [ ] **System optimization** recommendations

2. **Documentation Update**
   - [ ] **Update monitoring procedures** based on learnings
   - [ ] **Update troubleshooting guides** with new issues
   - [ ] **Update optimization recommendations** based on data
   - [ ] **Update emergency procedures** if needed

---

## STEP 7: REPORTING AND ANALYTICS

### 7A. Weekly Reports

**Generate weekly reports including:**

- [ ] **Cleanup effectiveness summary** (files cleaned, records deleted)
- [ ] **Storage usage trends** and cost analysis
- [ ] **System performance metrics** during cleanup
- [ ] **Error summary** and resolution status
- [ ] **Recommendations** for optimization

### 7B. Monthly Reports

**Generate monthly reports including:**

- [ ] **Comprehensive system health assessment**
- [ ] **Cost savings analysis** and projections
- [ ] **Performance trends** and optimization opportunities
- [ ] **User impact assessment** and feedback summary
- [ ] **Strategic recommendations** for system improvement

### 7C. Quarterly Reports

**Generate quarterly reports including:**

- [ ] **Long-term trend analysis** and projections
- [ ] **Cost optimization** opportunities and recommendations
- [ ] **System evolution** recommendations
- [ ] **ROI analysis** of cleanup system implementation
- [ ] **Strategic planning** recommendations

---

## STEP 8: CONTINUOUS IMPROVEMENT

### 8A. Process Optimization

- [ ] **Identify bottlenecks** in cleanup process
- [ ] **Optimize database queries** for better performance
- [ ] **Improve error handling** based on real-world issues
- [ ] **Enhance monitoring** based on operational needs

### 8B. Technology Optimization

- [ ] **Evaluate new technologies** for better performance
- [ ] **Implement automation** for routine maintenance tasks
- [ ] **Enhance alerting** and monitoring capabilities
- [ ] **Improve reporting** and analytics capabilities

### 8C. Operational Optimization

- [ ] **Streamline monitoring procedures** based on learnings
- [ ] **Improve troubleshooting procedures** based on issues
- [ ] **Enhance documentation** based on operational needs
- [ ] **Optimize team procedures** for better efficiency

---

## SUCCESS METRICS AND KPIs

### Daily KPIs

- [ ] **Cleanup cycles completed** successfully
- [ ] **Orphaned files cleaned** successfully
- [ ] **System errors** (target: 0)
- [ ] **User operations** unaffected during cleanup

### Weekly KPIs

- [ ] **Cleanup system uptime** (target: 99.9%)
- [ ] **Storage cost savings** achieved
- [ ] **Performance metrics** maintained
- [ ] **Error resolution time** (target: < 4 hours)

### Monthly KPIs

- [ ] **Total cost savings** achieved
- [ ] **System reliability** maintained
- [ ] **User satisfaction** maintained
- [ ] **Operational efficiency** improved

---

## EMERGENCY PROCEDURES

### 8A. System Failure Response

1. **Immediate Assessment**
   - Check system logs for errors
   - Verify database connectivity
   - Test storage access
   - Assess impact on users

2. **Emergency Response**
   - Implement manual cleanup if needed
   - Restart application if required
   - Contact system administrator
   - Document incident details

3. **Recovery Procedures**
   - Restore system functionality
   - Verify cleanup system working
   - Monitor for stability
   - Document lessons learned

### 8B. Performance Degradation Response

1. **Performance Assessment**
   - Monitor system metrics
   - Identify performance bottlenecks
   - Assess user impact
   - Plan optimization strategy

2. **Optimization Implementation**
   - Implement performance improvements
   - Monitor improvement results
   - Verify user experience
   - Document optimizations

---

**Last Updated:** Implementation Date
**Version:** 1.0
**Status:** Ready for Ongoing Monitoring
