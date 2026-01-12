
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// --- Schemas ---
const UserSchema = new mongoose.Schema({ role: String, email: String, name: String }, { strict: false });
const ProjectSchema = new mongoose.Schema({ title: String, assignedUsers: [Object], status: String, createdAt: Date }, { strict: false });
const ReportSchema = new mongoose.Schema({ projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' }, status: String, generatedAt: Date }, { strict: false });
const ResponseSchema = new mongoose.Schema({ projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' }, answers: Array }, { strict: false });

if (!mongoose.models.User) mongoose.model('User', UserSchema);
if (!mongoose.models.Project) mongoose.model('Project', ProjectSchema);
if (!mongoose.models.Report) mongoose.model('Report', ReportSchema);
if (!mongoose.models.Response) mongoose.model('Response', ResponseSchema);

const User = mongoose.model('User');

async function testReports() {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        await mongoose.connect(mongoUri.replace(/&appName=[^&]*/i, ''));
        console.log('✅ Connected');

        const adminUser = await User.findOne({ role: { $regex: /admin/i } });
        if (!adminUser) process.exit(1);

        const baseUrl = 'http://localhost:5000';

        // 1. Get ALL Reports
        console.log('Fetching Reports...');
        const resR = await fetch(`${baseUrl}/api/reports?userId=${adminUser._id}`);
        const reports = await resR.json();
        const reportProjectIds = reports.map(r => r.projectId ? (r.projectId._id || r.projectId) : 'MISSING');
        console.log(`Found ${reports.length} reports.`);
        console.log(`First 3 Report Project IDs: ${JSON.stringify(reportProjectIds.slice(0, 3))}`);

        // 2. Get ALL Projects
        console.log('Fetching Projects...');
        const resP = await fetch(`${baseUrl}/api/projects?userId=${adminUser._id}`);
        const projects = await resP.json();
        console.log(`Found ${projects.length} projects.`);

        // 3. CROSS CHECK
        let matchCount = 0;
        projects.forEach(p => {
            const pId = String(p._id);
            const matchingReports = reportProjectIds.filter(rpId => String(rpId) === pId);
            if (matchingReports.length > 0) {
                console.log(`✅ MATCH! Project "${p.title}" (${pId}) has ${matchingReports.length} reports in the list.`);
                console.log(`   API Project.reportCount says: ${p.reportCount}`);
                if (p.reportCount === 0) console.log('   ❌ MISMATCH DETECTED!');
                matchCount++;
            }
        });

        if (matchCount === 0) console.log('❌ NO CROSS-MATCHES FOUND. Reports point to unknown projects?');

    } catch (e) { console.error('Error:', e); }
    finally { await mongoose.disconnect(); }
}

testReports();
