const fs = require('fs');

// Simple 10x10 green PNG image
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+H+6noEIwDiqkL4KASDQDq1j8w8IAAAAAElFTkSuQmCC', 'base64');
fs.writeFileSync('test-workspace-logo.png', png);
console.log('Created test-workspace-logo.png');
