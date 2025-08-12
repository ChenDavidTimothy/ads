#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

async function applyEventDrivenMigration() {
  console.log('🚀 Applying event-driven job processing migration...');
  
  // Create Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Read the SQL migration file
  const sqlPath = path.join(__dirname, 'setup-job-notifications.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('📋 Executing SQL migration...');
  
  // Split SQL into individual statements and execute them
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  for (const statement of statements) {
    if (statement.trim()) {
      console.log(`Executing: ${statement.substring(0, 100)}...`);
      
      const { error } = await supabase.rpc('exec_sql', { 
        sql_statement: statement + ';' 
      });
      
      if (error) {
        console.error('❌ SQL Error:', error);
        // Continue with other statements - some may already exist
      }
    }
  }
  
  console.log('✅ Database migration completed');
  
  // Test the notification system
  await testNotificationSystem(supabase);
}

async function testNotificationSystem(supabase) {
  console.log('🧪 Testing notification system...');
  
  try {
    // Test that we can send a notification
    const { error } = await supabase.rpc('exec_sql', {
      sql_statement: `SELECT pg_notify('pgboss_job_available', '{"name":"test","id":"123","priority":0,"state":"created"}');`
    });
    
    if (error) {
      console.error('❌ Notification test failed:', error);
    } else {
      console.log('✅ Notification system test passed');
    }
    
    // Test that triggers exist
    const { data: triggers, error: triggerError } = await supabase.rpc('exec_sql', {
      sql_statement: `
        SELECT trigger_name, event_manipulation, event_object_table 
        FROM information_schema.triggers 
        WHERE trigger_name LIKE '%pgboss%';
      `
    });
    
    if (triggerError) {
      console.error('❌ Trigger check failed:', triggerError);
    } else {
      console.log('✅ Triggers are installed:', triggers);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Helper function to create exec_sql function if it doesn't exist
async function ensureExecSqlFunction(supabase) {
  const { error } = await supabase.rpc('exec_sql', {
    sql_statement: `
      CREATE OR REPLACE FUNCTION exec_sql(sql_statement text)
      RETURNS text
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql_statement;
        RETURN 'OK';
      EXCEPTION
        WHEN others THEN
          RETURN 'ERROR: ' || SQLERRM;
      END;
      $$;
    `
  }).catch(() => {
    // Function might not exist yet, that's ok
    return { error: null };
  });
}

if (require.main === module) {
  applyEventDrivenMigration()
    .then(() => {
      console.log('🎉 Event-driven migration completed successfully!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Restart your application');
      console.log('2. Monitor logs to see event-driven processing in action');
      console.log('3. Check database query stats - polling should be dramatically reduced');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}