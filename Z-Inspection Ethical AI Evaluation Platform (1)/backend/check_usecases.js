require('dotenv').config();
const mongoose = require('mongoose');

const UseCaseSchema = new mongoose.Schema({
  title: String,
  description: String,
  aiSystemCategory: String,
  status: { type: String, default: 'assigned' },
  progress: { type: Number, default: 0 },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedExperts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  adminNotes: String,
  supportingFiles: [{
    name: String,
    data: String,
    contentType: String,
    url: String
  }],
  answers: [{
    questionId: { type: String, required: true },
    questionKey: { type: String },
    answer: { type: String, default: '' }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  extendedInfo: { type: Map, of: mongoose.Schema.Types.Mixed },
  feedback: [{ from: String, text: String, timestamp: { type: Date, default: Date.now } }],
  adminReflections: [{ id: String, text: String, visibleToExperts: Boolean, createdAt: { type: Date, default: Date.now } }]
});

const UseCase = mongoose.model('UseCase', UseCaseSchema);

async function checkUseCases() {
  try {
    console.log('Connecting to MongoDB...');
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI not found in environment');
      process.exit(1);
    }

    const cleanMongoUri = mongoUri.replace(/&appName=[^&]*/i, '');
    await mongoose.connect(cleanMongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ Connected to MongoDB\n');

    // Count all use cases
    const totalCount = await UseCase.countDocuments();
    console.log(`📊 Total Use Cases: ${totalCount}`);

    // Get all use cases
    const useCases = await UseCase.find().select('_id title ownerId status createdAt updatedAt').lean();
    
    if (useCases.length === 0) {
      console.log('\n⚠️  No use cases found in the database');
    } else {
      console.log('\n📋 Use Cases List:');
      useCases.forEach((uc, idx) => {
        console.log(`\n${idx + 1}. ${uc.title}`);
        console.log(`   ID: ${uc._id}`);
        console.log(`   Owner ID: ${uc.ownerId}`);
        console.log(`   Status: ${uc.status}`);
        console.log(`   Created: ${uc.createdAt}`);
        console.log(`   Updated: ${uc.updatedAt}`);
      });
    }

    // Group by ownerId
    const byOwner = {};
    useCases.forEach(uc => {
      const ownerId = uc.ownerId ? uc.ownerId.toString() : 'NO_OWNER';
      if (!byOwner[ownerId]) {
        byOwner[ownerId] = [];
      }
      byOwner[ownerId].push(uc);
    });

    console.log('\n\n📊 Use Cases by Owner:');
    Object.keys(byOwner).forEach(ownerId => {
      console.log(`\n  Owner ${ownerId}: ${byOwner[ownerId].length} use case(s)`);
      byOwner[ownerId].forEach(uc => {
        console.log(`    - ${uc.title} (${uc.status})`);
      });
    });

    await mongoose.disconnect();
    console.log('\n✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUseCases();
