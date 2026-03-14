const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' }, // Added for project-context messages
    text: { type: String, required: true },
    // Notification-only messages should show in bell notifications but not in chat threads
    isNotification: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now },
    readAt: { type: Date }
});

MessageSchema.index({ fromUserId: 1, toUserId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
