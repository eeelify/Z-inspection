const mongoose = require('mongoose');

const uri = 'mongodb+srv://admin_merve:Sifre123@cluster0.tg8voq1.mongodb.net/zinspection?retryWrites=true&w=majority&appName=Cluster0';

async function fixW8Question() {
    try {
        await mongoose.connect(uri);
        console.log('✅ Connected\n');

        const db = mongoose.connection.db;
        const questions = db.collection('questions');

        // Find W8
        const w8 = await questions.findOne({ code: 'W8' });

        if (!w8) {
            console.log('❌ W8 not found');
            process.exit(1);
        }

        console.log('📋 W8 BEFORE UPDATE:');
        console.log(`   questionnaireKey: ${w8.questionnaireKey}`);
        console.log(`   principle: ${w8.principle || 'MISSING'}`);
        console.log('');

        // Update W8
        const result = await questions.updateOne(
            { code: 'W8' },
            {
                $set: {
                    questionnaireKey: 'ethical-expert-v1',
                    principle: 'SOCIETAL & INTERPERSONAL WELL-BEING'
                }
            }
        );

        console.log(`✅ Updated: ${result.modifiedCount} document(s)`);

        // Verify
        const updated = await questions.findOne({ code: 'W8' });
        console.log('\n📋 W8 AFTER UPDATE:');
        console.log(`   questionnaireKey: ${updated.questionnaireKey}`);
        console.log(`   principle: ${updated.principle}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixW8Question();
