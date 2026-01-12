const path = require('path');
const dotenv = require('dotenv');
// Try loading .env from current dir
const envPathDot = path.resolve(__dirname, '.env');
dotenv.config({ path: envPathDot });
// Also try loading from parent dir just in case
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
    console.error("❌ No Mongo URI found in .env or environment");
    console.log("Examined paths:", envPathDot, path.resolve(__dirname, '../.env'));
    process.exit(1);
}

// Define schema loosely to catch everything
const ScoreSchema = new mongoose.Schema({}, { strict: false });
const Score = mongoose.model('Score', ScoreSchema, 'scores');

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected.");

        // Find a few scores
        const scores = await Score.find({}).limit(3).lean();
        console.log(`Found ${scores.length} scores.`);

        scores.forEach((s, i) => {
            console.log(`\nScore [${i}] Role: ${s.role}`);
            console.log(`  _id: ${s._id}`);
            console.log(`  Has questionBreakdown? ${!!s.questionBreakdown}`);
            if (s.questionBreakdown) {
                console.log(`  questionBreakdown length: ${s.questionBreakdown.length}`);
                console.log(`  Sample QB:`, JSON.stringify(s.questionBreakdown[0]));
            } else {
                console.log(`  Has questionScores? ${!!s.questionScores}`); // Legacy field?
            }

            if (s.byPrinciple) {
                console.log(`  byPrinciple keys: ${Object.keys(s.byPrinciple).join(', ')}`);
                Object.keys(s.byPrinciple).forEach(k => {
                    const p = s.byPrinciple[k];
                    console.log(`    ${k}: risk=${p?.risk}, n=${p?.n}, avg=${p?.avg}`);
                });
            }
        });

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
