const Notification = require('../models/Notification');
const User = require('../models/User');
const Project = require('../models/Project');
const Tension = require('../models/Tension');

/**
 * Create notifications for multiple recipients with deduplication
 * @param {Array} recipients - Array of recipient user IDs
 * @param {Object} payload - Notification payload
 * @param {Object} options - Options for deduplication
 */
async function createNotifications(recipients, payload, options = {}) {
  const {
    dedupeWindow = 60000, // 60 seconds default
    mergeSimilar = false
  } = options;

  if (!recipients || recipients.length === 0) {
    return [];
  }

  const notifications = [];
  const now = Date.now();

  for (const recipientId of recipients) {
    // Skip if recipient is the actor
    if (recipientId.toString() === payload.actorId.toString()) {
      continue;
    }

    // Deduplication check: same recipient, type, entityId within time window
    if (dedupeWindow > 0) {
      const existing = await Notification.findOne({
        recipientId,
        type: payload.type,
        entityId: payload.entityId,
        createdAt: { $gte: new Date(now - dedupeWindow) },
        ...(payload.metadata?.voteType ? { 'metadata.voteType': payload.metadata.voteType } : {})
      });

      if (existing) {
        // Skip duplicate notification
        continue;
      }
    }

    const notification = new Notification({
      recipientId,
      projectId: payload.projectId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      actorId: payload.actorId,
      actorRole: payload.actorRole,
      metadata: payload.metadata || {},
      url: payload.url,
      isRead: false
    });

    notifications.push(notification);
  }

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }

  return notifications;
}

/**
 * Get assigned experts for a project
 * @param {ObjectId} projectId
 * @returns {Array} Array of user IDs
 */
async function getAssignedExperts(projectId) {
  try {
    const project = await Project.findById(projectId).populate('assignedUsers');
    if (!project) return [];

    // Get assigned users (experts)
    const expertIds = (project.assignedUsers || [])
      .map(u => u._id || u.id || u)
      .filter(Boolean);

    return expertIds;
  } catch (error) {
    console.error('Error getting assigned experts:', error);
    return [];
  }
}

/**
 * Get all admin users
 * @returns {Array} Array of admin user IDs
 */
async function getAllAdmins() {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id');
    return admins.map(u => u._id);
  } catch (error) {
    console.error('Error getting admins:', error);
    return [];
  }
}

/**
 * Get participants of a tension (commenters, voters, evidence uploaders)
 * @param {ObjectId} tensionId
 * @returns {Array} Array of user IDs
 */
async function getTensionParticipants(tensionId) {
  try {
    const tension = await Tension.findById(tensionId);
    if (!tension) return [];

    const participants = new Set();

    // Add creator
    if (tension.createdBy) {
      participants.add(tension.createdBy.toString());
    }

    // Add commenters
    if (tension.comments && Array.isArray(tension.comments)) {
      tension.comments.forEach(comment => {
        if (comment.authorId) {
          participants.add(comment.authorId.toString());
        }
      });
    }

    // Add voters
    if (tension.votes && Array.isArray(tension.votes)) {
      tension.votes.forEach(vote => {
        if (vote.userId) {
          participants.add(vote.userId.toString());
        }
      });
    }

    // Add evidence uploaders
    if (tension.evidences && Array.isArray(tension.evidences)) {
      tension.evidences.forEach(evidence => {
        if (evidence.uploadedBy) {
          participants.add(evidence.uploadedBy.toString());
        }
      });
    }

    return Array.from(participants).map(id => {
      try {
        return require('mongoose').Types.ObjectId(id);
      } catch {
        return id;
      }
    });
  } catch (error) {
    console.error('Error getting tension participants:', error);
    return [];
  }
}

/**
 * Notify when tension is created
 */
async function notifyTensionCreated(tension, actorId, actorRole) {
  try {
    const projectId = tension.projectId;
    const assignedExperts = await getAssignedExperts(projectId);

    const payload = {
      projectId,
      entityType: 'tension',
      entityId: tension._id,
      type: 'tension_created',
      title: 'New ethical tension added',
      message: `${actorRole || 'User'} added a tension: ${tension.claimStatement || tension.description || 'Untitled'} (Conflict: ${tension.principle1 || 'P1'} ↔ ${tension.principle2 || 'P2'})`,
      actorId: typeof actorId === 'string' ? actorId : actorId._id || actorId,
      actorRole,
      metadata: {
        tensionId: tension._id,
        tensionTitle: tension.claimStatement || tension.description || 'Untitled'
      },
      url: `/projects/${projectId}/tensions/${tension._id}?tab=evidence`
    };

    await createNotifications(assignedExperts, payload);
  } catch (error) {
    console.error('Error notifying tension created:', error);
  }
}

/**
 * Notify when tension is commented
 */
async function notifyTensionCommented(tension, actorId, actorRole) {
  try {
    const projectId = tension.projectId;
    const participants = await getTensionParticipants(tension._id);

    const payload = {
      projectId,
      entityType: 'tension',
      entityId: tension._id,
      type: 'tension_commented',
      title: 'New comment on tension',
      message: `${actorRole || 'User'} commented on ${tension.claimStatement || tension.description || 'Untitled'}`,
      actorId: typeof actorId === 'string' ? actorId : actorId._id || actorId,
      actorRole,
      metadata: {
        tensionId: tension._id,
        tensionTitle: tension.claimStatement || tension.description || 'Untitled'
      },
      url: `/projects/${projectId}/tensions/${tension._id}?tab=discussion`
    };

    await createNotifications(participants, payload);
  } catch (error) {
    console.error('Error notifying tension commented:', error);
  }
}

/**
 * Notify when evidence is added to tension
 */
async function notifyTensionEvidenceAdded(tension, evidence, actorId, actorRole) {
  try {
    const projectId = tension.projectId;
    const participants = await getTensionParticipants(tension._id);

    const payload = {
      projectId,
      entityType: 'tension',
      entityId: tension._id,
      type: 'tension_evidence_added',
      title: 'New evidence added',
      message: `${actorRole || 'User'} added evidence${evidence.type ? ` (${evidence.type})` : ''} to ${tension.claimStatement || tension.description || 'Untitled'}`,
      actorId: typeof actorId === 'string' ? actorId : actorId._id || actorId,
      actorRole,
      metadata: {
        tensionId: tension._id,
        tensionTitle: tension.claimStatement || tension.description || 'Untitled',
        evidenceType: evidence.type
      },
      url: `/projects/${projectId}/tensions/${tension._id}?tab=evidence`
    };

    await createNotifications(participants, payload);
  } catch (error) {
    console.error('Error notifying tension evidence added:', error);
  }
}

/**
 * Notify when tension is voted
 */
async function notifyTensionVoted(tension, voteType, actorId, actorRole) {
  try {
    const projectId = tension.projectId;
    const participants = await getTensionParticipants(tension._id);

    const payload = {
      projectId,
      entityType: 'tension',
      entityId: tension._id,
      type: 'tension_voted',
      title: 'New vote on tension',
      message: `${actorRole || 'User'} voted ${voteType} on ${tension.claimStatement || tension.description || 'Untitled'}`,
      actorId: typeof actorId === 'string' ? actorId : actorId._id || actorId,
      actorRole,
      metadata: {
        tensionId: tension._id,
        tensionTitle: tension.claimStatement || tension.description || 'Untitled',
        voteType
      },
      url: `/projects/${projectId}/tensions/${tension._id}?tab=discussion`
    };

    await createNotifications(participants, payload, { dedupeWindow: 60000 }); // 60 second dedupe
  } catch (error) {
    console.error('Error notifying tension voted:', error);
  }
}

/**
 * Notify admins when evaluation is started (once per project+user+questionnaireKey)
 */
async function notifyEvaluationStarted(projectId, userId, questionnaireKey, actorRole, userName) {
  try {
    // Check if already notified for this combination
    const existing = await Notification.findOne({
      type: 'evaluation_started',
      projectId,
      'metadata.questionnaireKey': questionnaireKey,
      actorId: userId,
      createdAt: { $gte: new Date(Date.now() - 86400000) } // Check last 24 hours
    });

    if (existing) {
      // Already notified, skip
      return;
    }

    const admins = await getAllAdmins();
    if (admins.length === 0) return;

    const project = await Project.findById(projectId);
    const projectTitle = project?.title || 'Project';

    const payload = {
      projectId,
      entityType: 'evaluation',
      entityId: userId, // Using userId as entityId for evaluation_started
      type: 'evaluation_started',
      title: 'Evaluation started',
      message: `${actorRole || 'Expert'} (${userName || 'User'}) started evaluation for project ${projectTitle}.`,
      actorId: userId,
      actorRole,
      metadata: {
        questionnaireKey
      },
      url: `/admin/projects/${projectId}/evaluations`
    };

    await createNotifications(admins, payload);
  } catch (error) {
    console.error('Error notifying evaluation started:', error);
  }
}

module.exports = {
  createNotifications,
  getAssignedExperts,
  getAllAdmins,
  getTensionParticipants,
  notifyTensionCreated,
  notifyTensionCommented,
  notifyTensionEvidenceAdded,
  notifyTensionVoted,
  notifyEvaluationStarted
};

