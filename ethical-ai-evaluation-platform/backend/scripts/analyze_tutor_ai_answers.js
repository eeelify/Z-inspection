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

async function analyzeAnswers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // Define models
        if (!mongoose.models.Project) mongoose.model('Project', new mongoose.Schema({}, { strict: false }));
        if (!mongoose.models.Response) mongoose.model('Response', new mongoose.Schema({}, { strict: false }));
        if (!mongoose.models.Question) mongoose.model('Question', new mongoose.Schema({}, { strict: false }));
        if (!mongoose.models.User) mongoose.model('User', new mongoose.Schema({}, { strict: false }));

        const Project = mongoose.model('Project');
        const Response = mongoose.model('Response');
        const Question = mongoose.model('Question');
        const User = mongoose.model('User');
        const Score = require('../models/score');

        // Find Tutor AI project
        const project = await Project.findOne({
            title: /Tutor AI/i
        }).lean();

        if (!project) {
            throw new Error('Tutor AI project not found');
        }

        console.log(`\n📊 Tutor AI - Soru ve Cevap Analizi`);
        console.log(`=`.repeat(80));

        // Get score to see which questions were actually scored
        const score = await Score.findOne({
            projectId: project._id
        }).lean();

        const report = [];

        if (score && score.questionBreakdown) {
            console.log(`\n✅ ${score.questionBreakdown.length} soru için skorlama bulundu\n`);

            for (let i = 0; i < score.questionBreakdown.length; i++) {
                const qb = score.questionBreakdown[i];

                // Get full question details
                const question = await Question.findById(qb.questionId).lean();

                if (!question) continue;

                // Get the response that contains this answer
                const response = await Response.findOne({
                    projectId: project._id,
                    'answers.questionId': qb.questionId
                }).lean();

                let selectedAnswer = null;
                let answerDetails = '';

                if (response && response.answers) {
                    const answer = response.answers.find(a =>
                        a.questionId && a.questionId.toString() === qb.questionId.toString()
                    );

                    if (answer) {
                        // Find the selected option
                        if (question.options && answer.selectedOptionKey) {
                            selectedAnswer = question.options.find(opt =>
                                opt.key === answer.selectedOptionKey
                            );

                            if (selectedAnswer) {
                                answerDetails = `Seçilen: "${selectedAnswer.label || selectedAnswer.text || answer.selectedOptionKey}"`;
                                if (selectedAnswer.severity !== undefined) {
                                    answerDetails += ` (Severity: ${selectedAnswer.severity})`;
                                }
                            }
                        }
                    }
                }

                const questionNum = i + 1;
                const questionText = typeof question.text === 'object' ? question.text.tr || question.text.en || 'N/A' : question.text;

                console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`📋 SORU ${questionNum}/${score.questionBreakdown.length}`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`İlke: ${qb.principle}`);
                console.log(`Soru: ${questionText}`);
                console.log(`\n${answerDetails || 'Cevap bilgisi bulunamadı'}`);
                console.log(`\nRisk Hesaplaması:`);
                console.log(`  • Etik Önemi (Importance): ${qb.importance}`);
                console.log(`  • Cevap Şiddeti (Answer Severity): ${qb.answerSeverity}`);
                console.log(`  • Risk Katkısı (ERC): ${qb.importance} × (1 - ${qb.answerSeverity}) = ${qb.finalRiskContribution}`);

                // Add to report
                report.push({
                    questionNumber: questionNum,
                    principle: qb.principle,
                    questionText: questionText.substring(0, 150) + (questionText.length > 150 ? '...' : ''),
                    selectedOption: selectedAnswer ? (selectedAnswer.label || selectedAnswer.text) : 'N/A',
                    optionSeverity: qb.answerSeverity,
                    importance: qb.importance,
                    riskContribution: qb.finalRiskContribution
                });
            }

            console.log(`\n\n${'='.repeat(80)}`);
            console.log(`📊 ÖZET`);
            console.log(`${'='.repeat(80)}`);

            const totalRisk = score.questionBreakdown.reduce((sum, q) => sum + q.finalRiskContribution, 0);
            const avgRisk = totalRisk / score.questionBreakdown.length;

            console.log(`Toplam Kümülatif Risk: ${totalRisk.toFixed(2)}`);
            console.log(`Ortalama Risk (ERC): ${avgRisk.toFixed(3)}`);
            console.log(`Normalized (0-4 skalası): ${(avgRisk * 4).toFixed(3)} / 4`);

            const highRiskQuestions = score.questionBreakdown.filter(q => q.answerSeverity >= 0.5);
            console.log(`\n⚠️  Yüksek şiddetli cevaplar (≥0.5): ${highRiskQuestions.length} / ${score.questionBreakdown.length}`);

            if (highRiskQuestions.length > 0) {
                console.log(`\nYüksek şiddetli sorular:`);
                highRiskQuestions.forEach(q => {
                    console.log(`  • ${q.principle}: Severity ${q.answerSeverity}`);
                });
            }
        }

        // Write detailed report
        fs.writeFileSync('tutor_ai_detailed_answers.json', JSON.stringify(report, null, 2));
        console.log(`\n\n✅ Detaylı rapor 'tutor_ai_detailed_answers.json' dosyasına yazıldı`);

    } catch (error) {
        console.error('Error:', error);
        fs.writeFileSync('tutor_ai_detailed_answers.json', JSON.stringify({ error: error.message, stack: error.stack }, null, 2));
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

analyzeAnswers();
