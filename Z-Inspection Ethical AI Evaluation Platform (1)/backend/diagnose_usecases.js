require('dotenv').config();
const mongoose = require('mongoose');

// UseCase Schema
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

// User Schema (simplified for checking)
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  preconditionApproved: { type: Boolean, default: false },
  preconditionApprovedAt: { type: Date },
  profileImage: { type: String },
  isVerified: { type: Boolean, default: false }
});

const UseCase = mongoose.model('UseCase', UseCaseSchema);
const User = mongoose.model('User', UserSchema);

async function diagnose() {
  try {
    console.log('🔍 Z-Inspection Use Case Diagnostics\n');
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
    console.log('═'.repeat(60));

    // 1. Check total use cases
    const totalCount = await UseCase.countDocuments();
    console.log(`\n📊 Total Use Cases in Database: ${totalCount}`);

    // 2. Get all use cases
    const useCases = await UseCase.find()
      .select('_id title ownerId status createdAt updatedAt')
      .lean();
    
    if (useCases.length === 0) {
      console.log('\n⚠️  WARNING: No use cases found in the database!');
      console.log('   This could mean:');
      console.log('   - Use cases were deleted');
      console.log('   - Use cases are not being saved properly');
      console.log('   - You are looking at the wrong database');
    } else {
      console.log('\n📋 Use Cases List:\n');
      for (let i = 0; i < useCases.length; i++) {
        const uc = useCases[i];
        console.log(`${i + 1}. "${uc.title}"`);
        console.log(`   ID: ${uc._id}`);
        console.log(`   Owner ID: ${uc.ownerId || '❌ MISSING'}`);
        console.log(`   Status: ${uc.status}`);
        console.log(`   Created: ${uc.createdAt}`);
        console.log(`   Updated: ${uc.updatedAt}`);
        console.log('');
      }
    }

    // 3. Get all users with use-case-owner role
    const owners = await User.find({ role: 'use-case-owner' })
      .select('_id name email')
      .lean();
    
    console.log('═'.repeat(60));
    console.log(`\n👥 Use Case Owners in Database: ${owners.length}\n`);
    owners.forEach((owner, idx) => {
      console.log(`${idx + 1}. ${owner.name} (${owner.email})`);
      console.log(`   ID: ${owner._id}`);
      
      // Count use cases for this owner
      const ownerUseCases = useCases.filter(uc => 
        uc.ownerId && uc.ownerId.toString() === owner._id.toString()
      );
      console.log(`   Use Cases: ${ownerUseCases.length}`);
      
      if (ownerUseCases.length > 0) {
        ownerUseCases.forEach(uc => {
          console.log(`      - "${uc.title}" (${uc.status})`);
        });
      }
      console.log('');
    });

    // 4. Check for orphaned use cases (no owner)
    const orphanedUseCases = useCases.filter(uc => !uc.ownerId);
    if (orphanedUseCases.length > 0) {
      console.log('═'.repeat(60));
      console.log(`\n⚠️  WARNING: Found ${orphanedUseCases.length} orphaned use case(s) (no ownerId):\n`);
      orphanedUseCases.forEach((uc, idx) => {
        console.log(`${idx + 1}. "${uc.title}"`);
        console.log(`   ID: ${uc._id}`);
        console.log(`   Created: ${uc.createdAt}\n`);
      });
    }

    // 5. Check for use cases with invalid ownerIds
    const allOwnerIds = owners.map(o => o._id.toString());
    const invalidOwnerUseCases = useCases.filter(uc => 
      uc.ownerId && !allOwnerIds.includes(uc.ownerId.toString())
    );
    
    if (invalidOwnerUseCases.length > 0) {
      console.log('═'.repeat(60));
      console.log(`\n⚠️  WARNING: Found ${invalidOwnerUseCases.length} use case(s) with invalid ownerId:\n`);
      invalidOwnerUseCases.forEach((uc, idx) => {
        console.log(`${idx + 1}. "${uc.title}"`);
        console.log(`   ID: ${uc._id}`);
        console.log(`   Owner ID: ${uc.ownerId} (USER NOT FOUND)`);
        console.log(`   Created: ${uc.createdAt}\n`);
      });
    }

    console.log('═'.repeat(60));
    console.log('\n✅ Diagnosis complete\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnose();
