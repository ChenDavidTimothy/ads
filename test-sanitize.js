// Quick test of sanitization
function sanitizeForFilename(input) {
  return input
    .replace(/[\\\/\0\n\r\t\f\v:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

console.log("Test 1:", sanitizeForFilename('file\\with/invalid:chars*"<>|'));
console.log("Test 2:", sanitizeForFilename("file\x00with\ncontrol\rchars\t"));
console.log("Test 3:", sanitizeForFilename('Scene\\:*?"<>|'));
