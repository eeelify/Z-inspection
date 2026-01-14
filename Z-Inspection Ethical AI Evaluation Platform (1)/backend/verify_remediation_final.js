const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PROJECT_ID = '6964d4e9d7a6755353c39e4b';

async function verify() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/z-inspection';
        await mongoose.connect(mongoUri.replace(/&appName=[^&]*/i, ''));

        const { validateProjectForReporting } = require('./services/reportValidationService');
        const validation = await validateProjectForReporting(PROJECT_ID);

        const result = {
            timestamp: new Date().toISOString(),
            projectId: PROJECT_ID,
            isValid: validation.isValid,
            validityStatus: validation.validityStatus,
            errors: validation.errors,
            warnings: validation.warnings,
            metadata: validation.metadata
        };

        console.log(JSON.stringify(result, null, 2));
        fs.writeFileSync('final_validation.json', JSON.stringify(result, null, 2));

        await mongoose.disconnect();
        process.exit(validation.isValid ? 0 : 1);

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

verify();
