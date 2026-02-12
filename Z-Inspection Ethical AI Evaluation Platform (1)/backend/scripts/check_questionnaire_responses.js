const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load environment
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const parts = trimmed.split('=');
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^[\"']|[\"']$/g, '');
            if (key === 'MONGODB_URI' || key === 'MONGO_URI') {
                process.env.MONGODB_URI = val;
            }
        }
    }
}

async function checkQuestionnaireResponses() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        if (!mongoose.models.Project) mongoose.model('Project', new mongoose.Schema({}, { strict: false }));
        if (!mongoose.models.Response) mongoose.model('Response', new mongoose.Schema({}, { strict: false }));

        const Project = mongoose.model('Project');
        const Response = mongoose.model('Response');
        const Score = require('../models/score');

        // Find Tutor AI project
        const project = await Project.findOne({
            title: /Tutor AI/i
        }).lean();

        if (!project) {
            throw new Error('Tutor AI project not found');
        }

        console.log(`\n📊 Tutor AI - Questionnaire Responses Analizi`);
        console.log(`${'='.repeat(80)}\n`);

        // Get all responses
        const responses = await Response.find({
            projectId: project._id
        }).lean();

        console.log(`Toplam Response: ${responses.length}\n`);

        // Group by questionnaire key
        const byQuestionnaire = {};

        responses.forEach(resp => {
            const qKey = resp.questionnaireKey || 'null';
            if (!byQuestionnaire[qKey]) {
                byQuestionnaire[qKey] = {
                    count: 0,
                    responses: [],
                    totalAnswers: 0
                };
            }
            byQuestionnaire[qKey].count++;
            byQuestionnaire[qKey].responses.push(resp);
            byQuestionnaire[qKey].totalAnswers += (resp.answers?.length || 0);
        });

        console.log('Questionnaire Key\'lere Göre Dağılım:\n');
        for (const [qKey, data] of Object.entries(byQuestionnaire)) {
            console.log(`  📋 ${qKey}:`);
            console.log(`     - Response sayısı: ${data.count}`);
            console.log(`     - Toplam cevap sayısı: ${data.totalAnswers}`);
            console.log(`     - Roller: ${[...new Set(data.responses.map(r => r.role))].join(', ')}`);
            console.log('');
        }

        // Get all scores
        const scores = await Score.find({
            projectId: project._id
        }).lean();

        console.log(`\n${'='.repeat(80)}`);
        console.log(`Toplam Score Dökümanı: ${scores.length}\n`);

        // Group scores by questionnaire key
        const scoresByQuestionnaire = {};

        scores.forEach(score => {
            const qKey = score.questionnaireKey || 'null';
            if (!scoresByQuestionnaire[qKey]) {
                scoresByQuestionnaire[qKey] = [];
            }
            scoresByQuestionnaire[qKey].push(score);
        });

        console.log('Score Dökümanları (Questionnaire Key\'e Göre):\n');
        for (const [qKey, scoreList] of Object.entries(scoresByQuestionnaire)) {
            console.log(`  📊 ${qKey}:`);
            console.log(`     - Score döküman sayısı: ${scoreList.length}`);

            // Check if scores have data
            const hasData = scoreList.some(s =>
                s.totals?.overallRisk > 0 ||
                (s.byPrinciple && Object.keys(s.byPrinciple).length > 0)
            );

            if (hasData) {
                const totalRisk = scoreList.reduce((sum, s) => sum + (s.totals?.overallRisk || 0), 0);
                const avgRisk = totalRisk / scoreList.length;
                console.log(`     - Ortalama Risk: ${avgRisk.toFixed(3)}`);
            } else {
                console.log(`     - ⚠️ Risk verisi yok`);
            }
            console.log('');
        }

        // Check if report uses ALL questionnaires or just one
        console.log(`\n${'='.repeat(80)}`);
        console.log('💡 SONUÇ:\n');

        const questionnaireKeys = Object.keys(byQuestionnaire);
        if (questionnaireKeys.length > 1) {
            console.log(`✅ Projede ÇOKLU questionnaire var (${questionnaireKeys.join(', ')})`);
            console.log(`⚠️  Sistem şu anda bunları AYRI AYRI hesaplıyor olabilir`);
            console.log(`📝 İstenen: TÜM questionnaire'lerin BİRLEŞTİRİLMİŞ risk hesaplaması`);
        } else {
            console.log(`ℹ️  Projede tek questionnaire var: ${questionnaireKeys[0]}`);
        }

        const result = {
            projectId: project._id.toString(),
            projectTitle: project.title,
            questionnaireBreakdown: byQuestionnaire,
            scoreBreakdown: scoresByQuestionnaire,
            totalResponses: responses.length,
            totalScores: scores.length
        };

        fs.writeFileSync('questionnaire_analysis.json', JSON.stringify(result, null, 2));
        console.log(`\n\n✅ Detaylı analiz 'questionnaire_analysis.json' dosyasına yazıldı`);

    } catch (error) {
        console.error('Error:', error);
        fs.writeFileSync('questionnaire_analysis.json', JSON.stringify({ error: error.message }, null, 2));
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkQuestionnaireResponses();
