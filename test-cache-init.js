// Test script to initialize cache manager
import { AssetCacheManager } from './src/server/rendering/asset-cache-manager.js';

async function testCacheInit() {
  console.log('Testing cache manager initialization...\n');

  try {
    const cacheManager = new AssetCacheManager('test-job-id', 'test-user-id', {
      enableJanitor: true,
      sharedCacheDir: 'C:\\render\\shared',
      jobCacheDir: 'C:\\render\\jobs\\test-job-id'
    });

    console.log('Cache manager created successfully');

    // Wait a moment for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Cache manager initialization complete');
  } catch (error) {
    console.error('Error initializing cache manager:', error.message);
  }
}

testCacheInit().catch(console.error);
