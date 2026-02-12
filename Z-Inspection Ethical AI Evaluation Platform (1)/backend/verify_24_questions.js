const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function verifyEthicalTechnical() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Question = require('./models/question');

        const ethical = await Question.find({ questionnaireKey: 'ethical-expert-v1' }).lean();
        const technical = await Question.find({ questionnaireKey: 'technical-expert-v1' }).lean();

        console.log('\n=== ETHICAL + TECHNICAL VERIFICATION ===\n');
        console.log(`Ethical Expert (ethical-expert-v1): ${ethical.length} soru`);
        console.log(`  Codes: ${ethical.map(q => q.code).sort().join(', ')}`);

        console.log(`\nTechnical Expert (technical-expert-v1): ${technical.length} soru`);
        console.log(`  Codes: ${technical.map(q => q.code).sort().join(', ')}`);

        console.log(`\n📊 TOPLAM: ${ethical.length + technical.length} soru`);
        console.log(ethical.length + technical.length === 24 ? '✅ Doğru!' : '❌ Hatalı!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Hata:', error);
        process.exit(1);
    }
}

verifyEthicalTechnical();
