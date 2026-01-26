const fs = require('fs');

// Simple 10x10 blue PNG image
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNkYPhfz0AEYBxVSF+FAAhKDq0VfXQ3AAAAAElFTkSuQmCC', 'base64');
fs.writeFileSync('test-avatar.png', png);
console.log('Created test-avatar.png');
