const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function verifyQuestionStructure() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Question = require('./models/question');

        console.log('\n=== SORU YAPISI ANALİZİ ===\n');

        // General sorular
        const general = await Question.find({ questionnaireKey: 'general-v1' }).lean();
        console.log(`📋 General Questions: ${general.length}`);
        console.log(`   appliesToRoles: ${general[0]?.appliesToRoles || 'N/A'}`);

        // Her expert için kendi soruları
        const ethical = await Question.find({ questionnaireKey: 'ethical-expert-v1' }).lean();
        const technical = await Question.find({ questionnaireKey: 'technical-expert-v1' }).lean();
        const education = await Question.find({ questionnaireKey: 'education-expert-v1' }).lean();
        const legal = await Question.find({ questionnaireKey: 'legal-expert-v1' }).lean();

        console.log(`\n🔬 Ethical Expert Özel: ${ethical.length}`);
        console.log(`🔧 Technical Expert Özel: ${technical.length}`);
        console.log(`📚 Education Expert Özel: ${education.length}`);
        console.log(`⚖️  Legal Expert Özel: ${legal.length}`);

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 HER UZMANIN TOPLAM SORUSU (General + Özel):');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Ethical:   ${general.length} + ${ethical.length} = ${general.length + ethical.length} ${general.length + ethical.length === 24 ? '✅' : '❌ (24 olmalı)'}`);
        console.log(`Technical: ${general.length} + ${technical.length} = ${general.length + technical.length} ${general.length + technical.length === 24 ? '✅' : '❌ (24 olmalı)'}`);
        console.log(`Education: ${general.length} + ${education.length} = ${general.length + education.length} ${general.length + education.length === 39 ? '✅' : '❌ (39 olmalı)'}`);
        console.log(`Legal:     ${general.length} + ${legal.length} = ${general.length + legal.length} ${general.length + legal.length === 33 ? '✅' : '❌ (33 olmalı)'}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Hata:', error);
        process.exit(1);
    }
}

verifyQuestionStructure();
