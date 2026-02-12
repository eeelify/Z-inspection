const mongoose = require('mongoose');

const uri = 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

async function checkPrincipleData() {
    try {
        await mongoose.connect(uri);
        console.log('✅ Connected\n');

        const db = mongoose.connection.db;
        const questions = db.collection('questions');

        // Find the question about social harms
        const socialHarmQ = await questions.findOne({
            'text.en': /Describe any potential social or interpersonal harms/i
        });

        if (socialHarmQ) {
            console.log('📋 SORU BULUNDU:');
            console.log(`   Code: ${socialHarmQ.code}`);
            console.log(`   QuestionnaireKey: ${socialHarmQ.questionnaireKey}`);
            console.log(`   Principle: ${socialHarmQ.principle || 'MISSING!'}`);
            console.log(`   PrincipleKey: ${socialHarmQ.principleKey || 'MISSING!'}`);
            console.log(`   PrincipleLabel: ${JSON.stringify(socialHarmQ.principleLabel || 'MISSING!')}`);
            console.log(`   Text EN: ${socialHarmQ.text.en.substring(0, 100)}...`);
            console.log('');
            console.log('📄 TAM VERİ:');
            console.log(JSON.stringify(socialHarmQ, null, 2));
        } else {
            console.log('❌ Soru bulunamadı');
        }

        // Check a few random questions for principle data
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 RASTGELE 5 SORU KONTROLü:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const randomQuestions = await questions.find({
            questionnaireKey: { $in: ['general-v1', 'ethical-expert-v1'] }
        }).limit(5).toArray();

        randomQuestions.forEach(q => {
            console.log(`${q.code} (${q.questionnaireKey}):`);
            console.log(`  principle: ${q.principle || 'MISSING'}`);
            console.log(`  principleKey: ${q.principleKey || 'MISSING'}`);
            console.log(`  principleLabel: ${q.principleLabel ? JSON.stringify(q.principleLabel.en) : 'MISSING'}`);
            console.log('');
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkPrincipleData();
