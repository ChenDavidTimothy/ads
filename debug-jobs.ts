// debug-jobs.ts - Tool to debug and manage stuck jobs
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

import { getBoss } from './src/server/jobs/pgboss-client';
import { createServiceClient } from './src/utils/supabase/service';

async function debugJobs() {
  console.log('🔍 Debugging job system...\n');
  
  try {
    // Check pgboss jobs
    console.log('📊 Checking pgboss queue...');
    const boss = await getBoss();
    
    // Get queue stats
    const stats = await boss.getQueueSize('render-video');
    console.log('Queue stats:', stats);

    // Check supabase render_jobs table
    console.log('\n💾 Checking Supabase render_jobs...');
    const supabase = createServiceClient();
    const { data: renderJobs, error } = await supabase
      .from('render_jobs')
      .select('id, status, created_at, updated_at, error')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching render jobs:', error);
    } else {
      console.log('\n📋 Recent render jobs in Supabase:');
      for (const job of renderJobs || []) {
        console.log(`- ID: ${job.id}`);
        console.log(`  Status: ${job.status}`);
        console.log(`  Created: ${job.created_at}`);
        console.log(`  Updated: ${job.updated_at}`);
        console.log(`  Error: ${job.error || 'None'}\n`);
      }
    }

    // Check for stuck jobs (queued for more than 5 minutes)
    const { data: stuckJobs } = await supabase
      .from('render_jobs')
      .select('id, status, created_at')
      .eq('status', 'queued')
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (stuckJobs && stuckJobs.length > 0) {
      console.log(`⚠️  Found ${stuckJobs.length} stuck jobs (queued for >5 minutes)`);
      
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question('Do you want to clear stuck jobs? (y/N): ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        console.log('🧹 Clearing stuck jobs...');
        
        // Update supabase jobs to failed
        const { error: updateError } = await supabase
          .from('render_jobs')
          .update({ 
            status: 'failed', 
            error: 'Job cleared due to being stuck in queue',
            updated_at: new Date().toISOString()
          })
          .in('id', stuckJobs.map(j => j.id));

        if (updateError) {
          console.error('❌ Failed to update stuck jobs:', updateError);
        } else {
          console.log(`✅ Cleared ${stuckJobs.length} stuck jobs in Supabase`);
        }
      }
    } else {
      console.log('✅ No stuck jobs found in Supabase');
    }

    // Check for queued/processing jobs
    const { data: activeJobs } = await supabase
      .from('render_jobs')
      .select('id, status')
      .in('status', ['queued', 'processing']);

    console.log(`\n📊 Current active jobs: ${activeJobs?.length || 0}`);
    if (activeJobs && activeJobs.length > 0) {
      console.log('Active job statuses:');
      const statusCounts = activeJobs.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      for (const [status, count] of Object.entries(statusCounts)) {
        console.log(`  ${status}: ${count}`);
      }
    }

  } catch (error) {
    console.error('❌ Error debugging jobs:', error);
  }
  
  process.exit(0);
}

// Alternative: Quick clear all function
async function clearAllJobs() {
  console.log('🧹 Clearing ALL render jobs...\n');
  
  try {
    const supabase = createServiceClient();
    
    // Get current active jobs
    const { data: activeJobs } = await supabase
      .from('render_jobs')
      .select('id, status')
      .in('status', ['queued', 'processing']);

    console.log(`Found ${activeJobs?.length || 0} active jobs to clear`);
    
    // Update all active supabase jobs to failed
    const { error } = await supabase
      .from('render_jobs')
      .update({ 
        status: 'failed', 
        error: 'Job cleared by admin',
        updated_at: new Date().toISOString()
      })
      .in('status', ['queued', 'processing']);

    if (error) {
      console.error('❌ Failed to update jobs:', error);
    } else {
      console.log(`✅ Cleared ${activeJobs?.length || 0} active jobs`);
    }
    
  } catch (error) {
    console.error('❌ Error clearing jobs:', error);
  }
  
  process.exit(0);
}

// Check command line arguments
const command = process.argv[2];

if (command === 'clear-all') {
  clearAllJobs();
} else {
  debugJobs();
}