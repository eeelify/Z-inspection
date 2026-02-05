require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGO_URI;
console.log('Connecting to:', uri.replace(/:([^:@]{1,})@/, ':****@'));

async function check() {
    try {
        await mongoose.connect(uri);
        console.log('Connected!');

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections found:', collections.map(c => c.name));

        const models = ['User', 'Project', 'Score', 'Response', 'Tension', 'Report'];
        for (const m of models) {
            // We use flexible schema access since we don't have the model definitions loaded here
            const count = await mongoose.connection.db.collection(m.toLowerCase() + 's').countDocuments();
            console.log(`${m} count: ${count}`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

check();
