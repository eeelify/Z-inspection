const mongoose = require('mongoose');

const uri = 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

async function checkAllScores() {
    try {
        await mongoose.connect(uri);
        console.log('✅ Connected\n');

        const db = mongoose.connection.db;
        const scores = db.collection('scores');

        // Find all scores with questionnaireKey __ALL_COMBINED__
        const allCombined = await scores.find({ questionnaireKey: '__ALL_COMBINED__' }).toArray();

        console.log(`Found ${allCombined.length} combined scores:\n`);

        for (const score of allCombined) {
            const projects = db.collection('projects');
            const project = await projects.findOne({ _id: score.projectId });

            console.log(`📁 ${project?.title || 'Unknown Project'}`);
            console.log(`   Project ID: ${score.projectId}`);
            console.log(`   totals.n: ${score.totals?.n || 'N/A'}`);
            console.log(`   totals.nAnswered: ${score.totals?.nAnswered || 'N/A'}`);
            console.log('');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkAllScores();
