
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function verifyQuestionCounts() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in .env');
        }

        await mongoose.connect(process.env.MONGODB_URI);

        const Question = require('./models/question');

        // Get all questions
        const questions = await Question.find({}).lean();

        // Group by questionnaireKey
        const limitToKeys = [
            'general-v1',
            'ethical-expert-v1',
            'technical-expert-v1',
            'legal-expert-v1',
            'tutor-ai-education-expert-v1'
        ];

        const breakdown = {};
        const totalCounts = {
            total: 0,
            quantitative: 0,
            qualitative: 0
        };

        questions.forEach(q => {
            const key = q.questionnaireKey || 'general-v1'; // Default to general if missing

            if (!breakdown[key]) {
                breakdown[key] = {
                    total: 0,
                    quantitative: 0,
                    qualitative: 0
                };
            }

            breakdown[key].total++;

            const isQualitative = q.answerType === 'open_text';
            if (isQualitative) {
                breakdown[key].qualitative++;
                totalCounts.qualitative++;
            } else {
                breakdown[key].quantitative++;
                totalCounts.quantitative++;
            }
            totalCounts.total++;
        });

        // Specific sum requested
        const userGroups = [
            'tutor-ai-education-expert-v1',
            'technical-expert-v1',
            'legal-expert-v1',
            'ethical-expert-v1'
        ];

        let specificSum = 0;
        let specificQuant = 0;
        let specificQual = 0;

        userGroups.forEach(key => {
            if (breakdown[key]) {
                specificSum += breakdown[key].total;
                specificQuant += breakdown[key].quantitative;
                specificQual += breakdown[key].qualitative;
            }
        });

        const output = {
            breakdown,
            totalCounts,
            specificGroupSum: {
                groups: userGroups,
                total: specificSum,
                quantitative: specificQuant,
                qualitative: specificQual
            }
        };

        const outputPath = path.join(process.cwd(), 'backend', 'question_counts.json');
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        console.log(`✅ Wrote counts to ${outputPath}`);
        console.log('JSON_OUTPUT_START');
        console.log(JSON.stringify(output, null, 2));
        console.log('JSON_OUTPUT_END');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

verifyQuestionCounts();
