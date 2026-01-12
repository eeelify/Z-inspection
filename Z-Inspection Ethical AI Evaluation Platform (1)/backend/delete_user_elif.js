const mongoose = require('mongoose');
const User = require('./models/User');
// Try to load .env from backend folder if not in root
require('dotenv').config({ path: 'backend/.env' });
require('dotenv').config(); // Fallback to root

const deleteUser = async () => {
    try {
        const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/z-inspection';
        console.log(`Connecting to MongoDB at: ${mongoURI}`);

        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB.');

        const email = 'elifkisak8@gmail.com';
        console.log(`Searching for user with email: ${email}`);
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`User with email ${email} not found.`);
        } else {
            console.log(`Found user: ${user.name} (${user.email}) - Role: ${user.role} - ID: ${user._id}`);
            const result = await User.deleteOne({ _id: user._id });
            console.log('Delete result:', result);
            console.log('User deleted successfully.');
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('SCRIPT ERROR:', error);
        process.exit(1);
    }
};

deleteUser();
