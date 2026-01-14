const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PROJECT_ID = '6964d4e9d7a6755353c39e4b';

/**
 * CRITICAL DIAGNOSTIC: Duplicate Ethical-Expert Investigation
 * 
 * Z-Inspection Methodology requires EXACTLY ONE ethical-expert per project.
 * This script diagnoses why the system shows TWO ethical-experts.
 */

async function diagnose() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/z-inspection';
        await mongoose.connect(mongoUri.replace(/&appName=[^&]*/i, ''));
        console.log('✅ Connected to MongoDB\n');

        // Define inline models
        const User = mongoose.models.User || require('./models/User');
        const ProjectAssignment = mongoose.models.ProjectAssignment || require('./models/projectAssignment');
        const Response = mongoose.models.Response || require('./models/response');

        const projectIdObj = new mongoose.Types.ObjectId(PROJECT_ID);

        // 1. Check Project Assignments
        console.log('=' + '='.repeat(60));
        console.log('1) PROJECT ASSIGNMENTS');
        console.log('='.repeat(61));

        const assignments = await ProjectAssignment.find({ projectId: projectIdObj }).lean();
        console.log(`\nFound ${assignments.length} assignment(s):\n`);

        const roleCount = {};
        for (const assignment of assignments) {
            const user = await User.findById(assignment.userId).select('name email').lean();
            const role = assignment.role || 'unknown';
            roleCount[role] = (roleCount[role] || 0) + 1;

            console.log(`  - User: ${user?.name || user?.email || assignment.userId}`);
            console.log(`    Role: ${role}`);
            console.log(`    AssignmentId: ${assignment._id}`);
            console.log(`    Questionnaires: ${assignment.questionnaires?.join(', ') || 'none'}`);
            console.log('');
        }

        console.log('Role Summary:');
        for (const [role, count] of Object.entries(roleCount)) {
            const status = (role === 'ethical-expert' && count !== 1) ? '❌ INVALID' : '✅';
            console.log(`  ${status} ${role}: ${count}`);
        }

        // 2. Check Responses
        console.log('\n' + '='.repeat(61));
        console.log('2) RESPONSES (Who actually submitted)');
        console.log('='.repeat(61) + '\n');

        const responses = await Response.find({ projectId: projectIdObj }).lean();
        console.log(`Found ${responses.length} response(s):\n`);

        const responseRoles = {};
        const userIds = new Set();

        for (const response of responses) {
            const user = await User.findById(response.userId).select('name email role').lean();
            const role = response.role || user?.role || 'unknown';
            responseRoles[role] = (responseRoles[role] || 0) + 1;
            userIds.add(response.userId.toString());

            console.log(`  - User: ${user?.name || user?.email || response.userId}`);
            console.log(`    Response Role: ${response.role}`);
            console.log(`    User Role (in User collection): ${user?.role}`);
            console.log(`    QuestionnaireKey: ${response.questionnaireKey}`);
            console.log(`    Answers: ${response.answers?.length || 0}`);
            console.log('');
        }

        console.log('Response Role Summary:');
        for (const [role, count] of Object.entries(responseRoles)) {
            const status = (role === 'ethical-expert' && count > 1) ? '❌ DUPLICATE' : '✅';
            console.log(`  ${status} ${role}: ${count}`);
        }

        console.log(`\nUnique users who submitted: ${userIds.size}`);

        // 3. Check User Collection
        console.log('\n' + '='.repeat(61));
        console.log('3) USER COLLECTION (Account Roles)');
        console.log('='.repeat(61) + '\n');

        const userIdsArray = Array.from(userIds).map(id => new mongoose.Types.ObjectId(id));
        const users = await User.find({ _id: { $in: userIdsArray } }).select('name email role').lean();

        for (const user of users) {
            console.log(`  - ${user.name || user.email}`);
            console.log(`    Role: ${user.role}`);
            console.log(`    UserId: ${user._id}`);
            console.log('');
        }

        // 4. DIAGNOSIS
        console.log('=' + '='.repeat(60));
        console.log('🔍 DIAGNOSIS');
        console.log('='.repeat(61) + '\n');

        const ethicalExpertCount = responseRoles['ethical-expert'] || 0;

        if (ethicalExpertCount === 0) {
            console.log('❌ CRITICAL: No ethical-expert found');
        } else if (ethicalExpertCount === 1) {
            console.log('✅ VALID: Exactly one ethical-expert');
        } else if (ethicalExpertCount > 1) {
            console.log(`❌ CRITICAL: ${ethicalExpertCount} ethical-experts found (MUST be exactly 1)`);
            console.log('\nPossible causes:');
            console.log('  1. Same user submitted multiple times with different questionnaires');
            console.log('  2. Multiple users were assigned ethical-expert role');
            console.log('  3. Role was changed mid-evaluation');
            console.log('\nRECOMMENDED ACTION:');
            console.log('  - Review User accounts and ensure only ONE has role=ethical-expert');
            console.log('  - Check if responses show same userId');
            console.log('  - Consider implementing role cardinality validation');
        }

        await mongoose.disconnect();
        console.log('\n✅ Diagnosis complete\n');

    } catch (error) {
        console.error('❌ Diagnosis failed:', error);
        process.exit(1);
    }
}

diagnose();
