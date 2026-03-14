const fs = require('fs');
const content = fs.readFileSync('debug_output_logs.txt', 'utf16le'); // PowerShell output is UTF-16LE
const lines = content.split('\n');
const outStream = fs.createWriteStream('debug_logs_final.txt', { encoding: 'utf8' });
lines.forEach(line => {
    if (line.includes('[DEBUG')) {
        outStream.write(line.trim() + '\n');
    }
});
outStream.end();
