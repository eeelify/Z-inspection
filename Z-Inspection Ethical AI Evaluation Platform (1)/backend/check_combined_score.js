const mongoose = require('mongoose');

const uri = 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

async function checkCombinedScore() {
    try {
        await mongoose.connect(uri);
        console.log('✅ Connected\n');

        const db = mongoose.connection.db;
        const scores = db.collection('scores');

        // Find Tutor AI project
        const projects = db.collection('projects');
        const tutorProject = await projects.findOne({ title: /tutor/i });

        console.log(`📁 Project: ${tutorProject.title}`);
        console.log(`   ID: ${tutorProject._id}\n`);

        // Find combined score
        const combinedScore = await scores.findOne({
            projectId: tutorProject._id,
            questionnaireKey: '__ALL_COMBINED__'
        });

        if (combinedScore) {
            console.log('✅ Combined score BULUNDU');
            console.log(`   questionBreakdown length: ${combinedScore.questionBreakdown?.length || 0}`);

            if (combinedScore.questionBreakdown) {
                const uniqueQuestionIds = new Set(
                    combinedScore.questionBreakdown.map(qb => qb.questionId?.toString()).filter(Boolean)
                );
                console.log(`   Unique question IDs: ${uniqueQuestionIds.size}`);

                const uniqueQuestions = new Map();
                combinedScore.questionBreakdown.forEach(qb => {
                    const qId = qb.questionId?.toString();
                    if (qId && !uniqueQuestions.has(qId)) {
                        uniqueQuestions.set(qId, qb);
                    }
                });

                const qualitative = Array.from(uniqueQuestions.values()).filter(qb =>
                    qb.answerType === 'open_text' || qb.scoringMethod === 'manual_risk_input'
                ).length;

                console.log(`\n📊 DOĞRU SAYILAR:`);
                console.log(`   Total: ${uniqueQuestionIds.size}`);
                console.log(`   Qualitative: ${qualitative}`);
                console.log(`   Quantitative: ${uniqueQuestionIds.size - qualitative}`);
            }
        } else {
            console.log('❌ Combined score BULUNAMADI!');
            console.log('   Rapor henüz oluşturulmamış olabilir.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkCombinedScore();
