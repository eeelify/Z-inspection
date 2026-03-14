const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function countAllQuestions() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Question = require('./models/question');

        const questionnaires = [
            'general-v1',
            'ethical-expert-v1',
            'technical-expert-v1',
            'legal-expert-v1',
            'education-expert-v1',
            'medical-expert-v1'
        ];

        console.log('\n=== UZMAN SORU SAYILARI ===\n');

        for (const key of questionnaires) {
            const questions = await Question.find({ questionnaireKey: key }).lean();
            const quant = questions.filter(q => q.answerType !== 'open_text').length;
            const qual = questions.filter(q => q.answerType === 'open_text').length;

            console.log(`${key.padEnd(25)} | Toplam: ${questions.length.toString().padStart(3)} | Nicel: ${quant.toString().padStart(3)} | Nitel: ${qual.toString().padStart(3)}`);
        }

        console.log('\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Hata:', error);
        process.exit(1);
    }
}

countAllQuestions();
