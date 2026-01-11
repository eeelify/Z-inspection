const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables logic
const envPathDot = path.resolve(__dirname, '.env');
dotenv.config({ path: envPathDot });

async function run() {
    const output = { log: [], data: [] };
    const log = (msg) => {
        console.log(msg);
        output.log.push(msg);
    };

    try {
        const uri = process.env.MONGO_URI;
        log(`Connecting to DB...`);

        if (!uri) throw new Error("MONGO_URI is undefined");

        await mongoose.connect(uri);
        log('Connected.');

        const Project = mongoose.model('Project', new mongoose.Schema({}, { strict: false }));
        const Response = mongoose.model('Response', new mongoose.Schema({}, { strict: false }));
        const Report = mongoose.model('Report', new mongoose.Schema({}, { strict: false }));

        const projects = await Project.find({}).maxTimeMS(10000);
        log(`Projects found: ${projects.length}`);

        for (const p of projects) {
            log(`Processing project ${p.title} (${p._id})...`);
            const pData = {
                id: p._id,
                title: p.title,
                responsesCount: 0,
                answeredQuestions: 0,
                reportsCount: 0,
                derivedStatus: 'setup'
            };

            try {
                log(`  Finding responses...`);
                const responses = await Response.find({ projectId: p._id }).maxTimeMS(5000);
                pData.responsesCount = responses.length;
                log(`  Found ${responses.length} responses.`);

                let answeredParams = 0;
                for (const r of responses) {
                    if (r.answers && Array.isArray(r.answers)) {
                        answeredParams += r.answers.length;
                    }
                }
                pData.answeredQuestions = answeredParams;
                log(`  Total answered: ${answeredParams}`);

                log(`  Finding reports...`);
                const reports = await Report.find({ projectId: p._id }).maxTimeMS(5000);
                pData.reportsCount = reports.length;
                log(`  Found ${reports.length} reports.`);

                if (pData.reportsCount >= 1) {
                    pData.derivedStatus = 'resolve';
                } else if (pData.answeredQuestions > 0) {
                    pData.derivedStatus = 'assess';
                }
                log(`  Status: ${pData.derivedStatus}`);

                output.data.push(pData);
            } catch (innerErr) {
                log(`Error processing project ${p.title}: ${innerErr.message}`);
            }
        }

    } catch (err) {
        log(`Fatal error: ${err.message}`);
        output.error = err.message;
    } finally {
        try {
            await mongoose.disconnect();
        } catch (e) { }

        fs.writeFileSync('debug_output.json', JSON.stringify(output, null, 2));
        log('Done. Wrote debug_output.json');
    }
}

run();
