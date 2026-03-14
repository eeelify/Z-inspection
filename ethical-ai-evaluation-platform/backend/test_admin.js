const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        const db = mongoose.connection.db;
        const adminUser = await db.collection('users').findOne({ role: 'admin' });
        console.log('Admin User:', adminUser ? adminUser._id : 'None');

        const totalCount = await db.collection('projects').countDocuments();
        console.log('Total Projects:', totalCount);

        if (adminUser) {
            const query = { $or: [{ createdByAdmin: new mongoose.Types.ObjectId(adminUser._id) }, { createdByAdmin: String(adminUser._id) }] };
            const adminProjects = await db.collection('projects').find(query).toArray();
            console.log('Admin Projects Count:', adminProjects.length);
        }

        const sampleProjects = await db.collection('projects').find({}).limit(5).project({ title: 1, createdByAdmin: 1 }).toArray();
        console.log('Sample Projects createdByAdmin:', JSON.stringify(sampleProjects, null, 2));

        mongoose.connection.close();
    });
