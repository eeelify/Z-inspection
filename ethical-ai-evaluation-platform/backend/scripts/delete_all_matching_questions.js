const mongoose = require('mongoose');
const http = require('http');
require('dotenv').config({ path: '../.env' });

const QuestionSchema = new mongoose.Schema({}, { strict: false });
const Question = mongoose.model('Question', QuestionSchema);

async function removeAllMatchingQuestions() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.error('MONGO_URI not found');
            return;
        }
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Regex for the question text
        const regex = /ethical tensions or value conflicts/i;

        // Find all matches first to log them
        const questions = await Question.find({
            $or: [
                { questionEn: { $regex: regex } },
                { text: { $regex: regex } },
                { "text.en": { $regex: regex } }
            ]
        });

        console.log(`Found ${questions.length} matching questions.`);
        questions.forEach(q => {
            console.log(`- ID: ${q._id}, Code: ${q.code}, Text: ${q.questionEn || (q.text && q.text.en) || 'N/A'}`);
        });

        if (questions.length > 0) {
            const result = await Question.deleteMany({
                _id: { $in: questions.map(q => q._id) }
            });
            console.log(`✅ Deleted ${result.deletedCount} questions.`);
        } else {
            console.log('ℹ️ No questions found to delete.');
        }

        // Clear Cache
        console.log('\n🔄 Clearing questions cache...');
        const options = {
            hostname: '127.0.0.1',
            port: 5000,
            path: '/api/evaluations/questions/clear-cache',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };

        const req = http.request(options, (res) => {
            console.log(`STATUS: ${res.statusCode}`);
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                console.log(`BODY: ${chunk}`);
            });
            res.on('end', () => {
                console.log('✅ Cache clear request completed.');
                process.exit(0);
            });
        });

        req.on('error', (e) => {
            console.error(`❌ Problem with cache request: ${e.message}`);
            console.log('This is expected if the server is not running directly (but you are running it via npm start).');
            process.exit(0);
        });

        // We assume 'ethical-v1' or generalized clearing
        req.write(JSON.stringify({ questionnaireKey: 'ethical-v1' }));
        req.end();

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

removeAllMatchingQuestions();
