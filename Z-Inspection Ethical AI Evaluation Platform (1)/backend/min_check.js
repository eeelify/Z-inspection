const mongoose = require('mongoose');
require('dotenv').config();
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

mongoose.connect(MONGO_URI).then(async () => {
    console.log('CONNECTED');
    const dbs = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections:', dbs.map(c => c.name));

    const Project = mongoose.connection.collection('projects');
    const Report = mongoose.connection.collection('reports');
    const Response = mongoose.connection.collection('responses');

    const ScoreCol = mongoose.connection.collection('scores');
    const allScores = await ScoreCol.find({}).toArray();
    const sampleScore = allScores.find(s => s.byPrinciple && Object.keys(s.byPrinciple).length > 0);

    if (sampleScore) {
        console.log('--- Question Count Verification (Found in Score) ---');
        console.log('ID:', sampleScore._id);
        for (const [principle, data] of Object.entries(sampleScore.byPrinciple)) {
            console.log(`Principle: ${principle}, n (questions): ${data.n}, count: ${data.count}`);
        }
    } else {
        console.log('No Score document with byPrinciple found.');
    }

    const allReports = await Report.find({}).toArray();
    const sampleWithHTML = allReports.find(r => r.metadata && r.metadata.hasHTMLReport);
    const sampleWithMetrics = allReports.find(r => r.computedMetrics);

    if (sampleWithHTML || sampleWithMetrics) {
        const target = sampleWithHTML || sampleWithMetrics;
        console.log('--- Question Count Verification (Found Sample) ---');
        console.log('ID:', target._id);
        const scoring = target.scoring || (target.computedMetrics ? (target.computedMetrics.scores || target.computedMetrics) : null);
        if (scoring && scoring.byPrincipleOverall) {
            for (const [principle, data] of Object.entries(scoring.byPrincipleOverall)) {
                console.log(`Principle: ${principle}, Question Count (n): ${data.n}, Experts Count: ${data.count}`);
            }
        } else {
            console.log('Sample report has scoring but no byPrincipleOverall.');
        }
    } else {
        console.log('Searched 50 reports, none had .scoring data.');
    }

    console.log('Projects:', await Project.countDocuments());
    console.log('Reports:', await Report.countDocuments());
    console.log('Responses:', await Response.countDocuments());

    const allRes = await Response.find({}).toArray();
    let corrupted = 0;
    let objects = 0;

    allRes.forEach(r => {
        (r.answers || []).forEach(ans => {
            if (ans.answer) {
                if (ans.answer.choiceKey === '[object Object]') corrupted++;
                if (ans.answer.choiceKey && typeof ans.answer.choiceKey === 'object') objects++;
            }
        });
    });

    console.log('Corrupted [object Object]:', corrupted);
    console.log('Raw objects in choiceKey:', objects);

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
