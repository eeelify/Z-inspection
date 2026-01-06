const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, index: true },
  role: { type: String, index: true },
  password: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Avoid recompiling model in hot-reload / multiple imports
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);

