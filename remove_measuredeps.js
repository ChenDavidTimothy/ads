const fs = require('fs');
const path = require('path');

// Function to remove measureDeps from a file
function removeMeasureDeps(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    // Remove measureDeps lines with various patterns
    content = content.replace(/,\s*measureDeps=\{[^}]*\}/g, '');
    content = content.replace(/measureDeps=\{[^}]*\},\s*/g, '');
    content = content.replace(/measureDeps=\{[^}]*\}/g, '');
    fs.writeFileSync(filePath, content);
    console.log(`Updated: ${filePath}`);
  } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
  }
}

// Find all tsx files in nodes directory
const nodesDir = './src/components/workspace/nodes';
const files = fs.readdirSync(nodesDir).filter(file => file.endsWith('.tsx'));

files.forEach(file => {
  removeMeasureDeps(path.join(nodesDir, file));
});

console.log('Done removing measureDeps from all node files!');
