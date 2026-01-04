const fs = require('fs');
const path = require('path');

const logFiles = [
  'dev-output.log',
  path.join(process.env.APPDATA, 'VRChat Group Guard', 'logs', 'main.log'),
  path.join(process.env.APPDATA, 'VRChatGroupGuard', 'logs', 'main.log') // Alternative name
];

logFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`\n--- Reading tail of ${file} ---\n`);
    const stats = fs.statSync(file);
    const size = stats.size;
    const buffer = Buffer.alloc(Math.min(size, 4096)); // Read last 4KB
    const fd = fs.openSync(file, 'r');
    fs.readSync(fd, buffer, 0, buffer.length, Math.max(0, size - buffer.length));
    fs.closeSync(fd);
    console.log(buffer.toString('utf8'));
  } else {
    console.log(`File not found: ${file}`);
  }
});
