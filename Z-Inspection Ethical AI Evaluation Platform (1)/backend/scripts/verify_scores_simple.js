const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Schema definitions (Copied to be standalone)
const ScoreSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId },
    role: String,
    totals: mongoose.Schema.Types.Mixed,
    byPrinciple: mongoose.Schema.Types.Mixed
}, { strict: false });

const ProjectSchema = new mongoose.Schema({
    title: String
}, { strict: false });

async function verifyScores() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.');

        const Project = mongoose.model('Project', ProjectSchema);
        const Score = mongoose.model('Score', ScoreSchema);

        // Get latest project
        const projects = await Project.find({}).sort({ createdAt: -1 }).limit(1);
        if (projects.length === 0) {
            console.log('❌ No projects found.');
            return;
        }
        const project = projects[0];
        console.log(`\n🔍 Project: "${project.title}" (ID: ${project._id})`);

        // Count Scores
        const scoreCount = await Score.countDocuments({ projectId: project._id });
        console.log(`\n📊 Score Documents Found: ${scoreCount}`);

        if (scoreCount > 0) {
            const scores = await Score.find({ projectId: project._id }).lean();

            console.log('\n🔎 Detailed Score Analysis:');
            scores.forEach((s, i) => {
                console.log(`\n[Score #${i + 1}]`);
                console.log(`  Role: ${s.role}`);
                console.log(`  User: ${s.userId}`);
                console.log(`  Totals:`, s.totals ? JSON.stringify(s.totals) : 'MISSING');

                if (s.byPrinciple) {
                    const validPrinciples = Object.keys(s.byPrinciple).filter(k => s.byPrinciple[k] && s.byPrinciple[k].risk !== undefined);
                    console.log(`  Valid Principles (risk defined): ${validPrinciples.length}`);
                    console.log(`  Keys: ${Object.keys(s.byPrinciple).join(', ')}`);
                } else {
                    console.log(`  ❌ byPrinciple is MISSING`);
                }
            });
        } else {
            console.log('👉 RECOMMENDATION: Please run "Compute Scores" in the application.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

verifyScores();
