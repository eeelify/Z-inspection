const mongoose = require('mongoose');

const uri = 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

async function checkReportQuestionCount() {
    try {
        await mongoose.connect(uri);
        console.log('✅ Connected\n');

        const db = mongoose.connection.db;

        // Find Tutor AI project
        const projects = db.collection('projects');
        const tutorProject = await projects.findOne({ title: /tutor/i });

        console.log(`📁 Project: ${tutorProject.title}\n`);

        // Find assignments for this project
        const assignments = db.collection('projectassignments');
        const projectAssignments = await assignments.find({ projectId: tutorProject._id }).toArray();

        console.log(`Found ${projectAssignments.length} assignments:\n`);

        let expectedTotal = 0;

        for (const assignment of projectAssignments) {
            const users = db.collection('users');
            const user = await users.findOne({ _id: assignment.userId });

            const role = assignment.role;
            let expectedQuestions = 12; // General

            if (role === 'ethical-expert') expectedQuestions += 12;
            else if (role === 'technical-expert') expectedQuestions += 12;
            else if (role === 'education-expert') expectedQuestions += 27;
            else if (role === 'legal-expert') expectedQuestions += 21;
            else if (role === 'medical-expert') expectedQuestions += 25;

            expectedTotal += expectedQuestions;

            console.log(`👤 ${user?.name || 'Unknown'} (${role})`);
            console.log(`   Beklenen soru sayısı: ${expectedQuestions} (12 general + uzman özel)`);
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📊 TOPLAM BEKLENEN SORU: ${expectedTotal}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Check what the report actually shows
        const scores = db.collection('scores');
        const combinedScore = await scores.findOne({
            projectId: tutorProject._id,
            questionnaireKey: '__ALL_COMBINED__'
        });

        if (combinedScore) {
            console.log('📈 RAPORDAKI VERİLER:');
            console.log(`   totals.n (total questions): ${combinedScore.totals?.n || 'N/A'}`);
            console.log(`   totals.nAnswered: ${combinedScore.totals?.nAnswered || 'N/A'}`);

            if (combinedScore.totals?.n === expectedTotal) {
                console.log('\n   ✅ Soru sayısı DOĞRU!');
            } else {
                console.log(`\n   ❌ Soru sayısı YANLIŞ! Beklenen: ${expectedTotal}, Raporda: ${combinedScore.totals?.n}`);
            }
        } else {
            console.log('❌ Combined score bulunamadı');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkReportQuestionCount();
