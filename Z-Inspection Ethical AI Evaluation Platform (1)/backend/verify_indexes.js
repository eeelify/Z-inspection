const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load env
const envPath = path.resolve(__dirname, '../.env');
const result = dotenv.config({ path: envPath });
if (result.error) {
    console.warn("Dotenv error:", result.error.message);
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/z-inspection';

async function verifyIndexes() {
    try {
        console.log('🔌 Connecting to MongoDB...', MONGODB_URI);
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        // Force load models
        require('./models/response');
        try { require('./models/evaluation'); } catch (e) { console.warn('⚠️ Evaluation model file not found, skipping'); }
        require('./models/projectAssignment');
        require('./models/question');
        try { require('./models/report'); } catch (e) { console.warn('⚠️ Report model file not found'); }

        const checkList = [
            { name: 'Response', indexes: [{ projectId: 1, userId: 1 }, { projectId: 1 }] },
            { name: 'ProjectAssignment', indexes: [{ projectId: 1 }] },
            { name: 'Question', indexes: [{ questionnaireKey: 1 }] },
            { name: 'Report', indexes: [{ projectId: 1 }] }
        ];

        for (const item of checkList) {
            console.log(`\n🔍 Checking indexes for ${item.name}...`);
            const Model = mongoose.model(item.name);

            const existingIndexes = await Model.collection.indexes();
            console.log('Existing indexes:', existingIndexes.map(i => i.name));

            for (const idxDef of item.indexes) {
                console.log(`  👉 Ensuring index: ${JSON.stringify(idxDef)}`);
                // createIndex is idempotent
                await Model.collection.createIndex(idxDef);
                console.log(`     ✅ Index ensured.`);
            }
        }

        console.log('\n✨ Index verification complete.');

    } catch (error) {
        console.error('❌ Error checking indexes:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected.');
    }
}

verifyIndexes();
