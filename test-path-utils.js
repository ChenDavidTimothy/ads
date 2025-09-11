// Test script for path utilities
const { normalizeDir, ensureDir, getDefaultCacheDirs } = require('./src/server/rendering/path-utils.ts');
const path = require('path');
const fs = require('fs/promises');

async function testPathUtils() {
  console.log('Testing path utilities...\n');

  // Test default cache directories
  const defaults = getDefaultCacheDirs();
  console.log('Default cache directories:', defaults);

  // Test path normalization
  const testPaths = [
    '/var/cache/render/shared',
    'C:\\var\\cache\\render\\shared',
    './relative/path',
    process.platform === 'win32' ? 'C:/mixed/slashes' : '/unix/path'
  ];

  console.log('\nTesting path normalization:');
  testPaths.forEach(p => {
    const normalized = normalizeDir(p);
    console.log(`  ${p} -> ${normalized}`);
  });

  // Test directory creation
  console.log('\nTesting directory creation:');
  const testDir = path.join(process.cwd(), 'test-cache-dir');
  try {
    await ensureDir(testDir);
    console.log(`  ✅ Created directory: ${testDir}`);

    // Verify it exists
    const stat = await fs.stat(testDir);
    console.log(`  ✅ Directory exists and is accessible`);

    // Clean up
    await fs.rmdir(testDir);
    console.log(`  ✅ Cleaned up test directory`);
  } catch (error) {
    console.error(`  ❌ Directory creation test failed:`, error.message);
  }

  console.log('\n✅ Path utilities test completed');
}

testPathUtils().catch(console.error);
