-- Setup LISTEN/NOTIFY triggers for pgboss job queue
-- This eliminates the need for polling by sending notifications when jobs are inserted

-- Create function to notify when a job is available
CREATE OR REPLACE FUNCTION notify_job_available()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify with queue name so workers can process specific queues
  PERFORM pg_notify('pgboss_job_available', json_build_object(
    'name', NEW.name,
    'id', NEW.id,
    'priority', NEW.priority,
    'state', NEW.state
  )::text);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to fire when jobs are inserted
DROP TRIGGER IF EXISTS pgboss_job_notification_trigger ON pgboss.job;
CREATE TRIGGER pgboss_job_notification_trigger
  AFTER INSERT ON pgboss.job
  FOR EACH ROW
  EXECUTE FUNCTION notify_job_available();

-- Create function to notify when job state changes (completed, failed, etc.)
CREATE OR REPLACE FUNCTION notify_job_state_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify on state changes that matter (completed, failed)
  IF OLD.state != NEW.state AND NEW.state IN ('completed', 'failed', 'cancelled') THEN
    PERFORM pg_notify('pgboss_job_state_change', json_build_object(
      'name', NEW.name,
      'id', NEW.id,
      'state', NEW.state,
      'output', NEW.output
    )::text);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for state changes
DROP TRIGGER IF EXISTS pgboss_job_state_change_trigger ON pgboss.job;
CREATE TRIGGER pgboss_job_state_change_trigger
  AFTER UPDATE ON pgboss.job
  FOR EACH ROW
  EXECUTE FUNCTION notify_job_state_change();

-- Create indexes to optimize the notification queries if they don't exist
CREATE INDEX IF NOT EXISTS idx_pgboss_job_name_state ON pgboss.job(name, state) WHERE state < 'completed';
CREATE INDEX IF NOT EXISTS idx_pgboss_job_priority ON pgboss.job(priority DESC, created_on, id) WHERE state < 'completed';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA pgboss TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON pgboss.job TO postgres;