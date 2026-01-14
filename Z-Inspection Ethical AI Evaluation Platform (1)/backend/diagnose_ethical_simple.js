const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PROJECT_ID = '6964d4e9d7a6755353c39e4b';

async function diagnose() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/z-inspection';
        await mongoose.connect(mongoUri.replace(/&appName=[^&]*/i, ''));

        const User = require('./models/User');
        const Response = require('./models/response');

        const projectIdObj = new mongoose.Types.ObjectId(PROJECT_ID);

        // Get all responses for this project
        const responses = await Response.find({ projectId: projectIdObj })
            .select('userId role questionnaireKey')
            .lean();

        // Group by userId
        const userMap = {};
        for (const response of responses) {
            const userId = response.userId.toString();
            if (!userMap[userId]) {
                userMap[userId] = {
                    userId,
                    roles: new Set(),
                    questionnaires: new Set()
                };
            }
            userMap[userId].roles.add(response.role);
            userMap[userId].questionnaires.add(response.questionnaireKey);
        }

        // Get user details
        const result = { users: [], ethicalExperts: [] };

        for (const [userId, data] of Object.entries(userMap)) {
            const user = await User.findById(userId).select('name email role').lean();
            const userInfo = {
                userId,
                name: user?.name || 'Unknown',
                email: user?.email || 'Unknown',
                accountRole: user?.role || 'unknown',
                responseRoles: Array.from(data.roles),
                questionnaires: Array.from(data.questionnaires)
            };

            result.users.push(userInfo);

            if (data.roles.has('ethical-expert')) {
                result.ethicalExperts.push(userInfo);
            }
        }

        result.ethicalExpertCount = result.ethicalExperts.length;
        result.isValid = result.ethicalExpertCount === 1;

        fs.writeFileSync('ethical_expert_diagnosis.json', JSON.stringify(result, null, 2));
        console.log(JSON.stringify(result, null, 2));

        await mongoose.disconnect();
        process.exit(result.isValid ? 0 : 1);

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

diagnose();
