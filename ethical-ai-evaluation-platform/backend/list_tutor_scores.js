const mongoose = require('mongoose');

const uri = 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

async function listAllScores() {
    try {
        await mongoose.connect(uri);
        console.log('✅ Connected\n');

        const db = mongoose.connection.db;
        const scores = db.collection('scores');
        const projects = db.collection('projects');

        // Find Tutor AI
        const tutorProject = await projects.findOne({ title: /tutor/i });
        console.log(`📁 Project: ${tutorProject.title}\n`);

        // Find ALL scores for this project
        const allScores = await scores.find({ projectId: tutorProject._id }).toArray();

        console.log(`Found ${allScores.length} score documents:\n`);

        allScores.forEach((score, i) => {
            console.log(`${i + 1}. questionnaireKey: ${score.questionnaireKey}`);
            console.log(`   userId: ${score.userId || 'N/A'}`);
            console.log(`   role: ${score.role || 'N/A'}`);
            console.log(`   questionBreakdown: ${score.questionBreakdown?.length || 0} items`);
            console.log(`   totals.n: ${score.totals?.n || 'N/A'}`);
            console.log('');
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

listAllScores();
