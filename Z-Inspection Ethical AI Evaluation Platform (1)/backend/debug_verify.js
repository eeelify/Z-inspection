
const fs = require('fs');
const path = require('path');

async function debug() {
    try {
        console.log('1. Loading mongoose...');
        require('mongoose');

        console.log('2. Loading models...');
        require('./models/response');
        require('./models/score');
        require('./models/question');
        const User = require('./models/User');
        // require('./models/project'); // REMOVED

        console.log('3. Loading ethicalScoringService...');
        require('./services/ethicalScoringService');

        console.log('4. Loading reportMetricsService...');
        require('./services/reportMetricsService');

        console.log('✅ ALL IMPORTS SUCCESSFUL');
    } catch (e) {
        console.error('❌ CRASH:', e);
        try {
            fs.writeFileSync(path.join(__dirname, 'debug_crash.log'), e.stack || String(e));
            console.log('Logged to debug_crash.log');
        } catch (writeErr) {
            console.error('Failed to write log:', writeErr);
        }
    }
}
debug();
