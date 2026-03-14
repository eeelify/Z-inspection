const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function diagnoseGizem() {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        const User = require('./models/user');
        const Project = require('./models/project');
        const ProjectAssignment = require('./models/projectAssignment');

        // Tutor AI projesini bul
        const project = await Project.findOne({ name: /tutor/i }).lean();
        if (!project) {
            console.log('❌ Tutor AI projesi bulunamadı');
            process.exit(1);
        }

        console.log(`\n📁 Proje: ${project.name}`);
        console.log(`   ID: ${project._id}\n`);

        // Gizem ILICALI kullanıcısını bul
        const gizem = await User.findOne({ name: /gizem/i }).lean();
        if (!gizem) {
            console.log('❌ Gizem ILICALI bulunamadı');
            process.exit(1);
        }

        console.log(`👤 Kullanıcı: ${gizem.name}`);
        console.log(`   Email: ${gizem.email}`);
        console.log(`   Role: ${gizem.role}\n`);

        // Assignment'ı bul
        const assignment = await ProjectAssignment.findOne({
            projectId: project._id,
            userId: gizem._id
        }).lean();

        if (!assignment) {
            console.log('❌ Assignment bulunamadı');
            process.exit(1);
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 QUESTIONNAIRE ANALİZİ');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Her questionnaire için detay
        for (const q of assignment.questionnaires) {
            console.log(`📋 ${q.questionnaireKey}`);
            console.log(`   Toplam Soru: ${q.questions?.length || 0}`);
            console.log(`   Progress: ${q.progress}%`);

            if (q.questions && q.questions.length > 0) {
                const answered = q.questions.filter(qu => qu.answered).length;
                const notAnswered = q.questions.filter(qu => !qu.answered);

                console.log(`   Cevaplanan: ${answered}/${q.questions.length}`);

                if (notAnswered.length > 0) {
                    console.log(`   ❌ Cevaplanmayan sorular (${notAnswered.length}):`);
                    notAnswered.forEach(qu => {
                        console.log(`      - ${qu.code}: answered=${qu.answered}`);
                    });
                }

                // Hesaplanamayan soruları bul (answered=true ama response yok)
                const problematic = q.questions.filter(qu =>
                    qu.answered === true && (!qu.response || !qu.response.answerScore)
                );

                if (problematic.length > 0) {
                    console.log(`   ⚠️  Problematic sorular (answered=true ama score yok):`);
                    problematic.forEach(qu => {
                        console.log(`      - ${qu.code}: answered=${qu.answered}, response=${JSON.stringify(qu.response)}`);
                    });
                }
            }
            console.log('');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Hata:', error);
        process.exit(1);
    }
}

diagnoseGizem();
