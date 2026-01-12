const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ProjectAssignment = require('../models/projectAssignment');

// These models are defined in server.js, so we get them from mongoose
const getProject = () => mongoose.model('Project');
const getTension = () => mongoose.model('Tension');

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

    // Check dedupeKey if provided
    if (payload.dedupeKey) {
      const existingByKey = await Notification.findOne({
        recipientId,
        dedupeKey: payload.dedupeKey
      });
      if (existingByKey) {
        continue; // Skip duplicate
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
      dedupeKey: payload.dedupeKey,
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
 * Get assigned experts for a project (excludes admins)
 * @param {ObjectId} projectId
 * @returns {Array} Array of user IDs (experts only, no admins)
 */
async function getAssignedExperts(projectId) {
  try {
    // First try ProjectAssignment collection (preferred)
    const assignments = await ProjectAssignment.find({
      projectId,
      status: { $in: ['assigned', 'in_progress', 'submitted'] }
    }).select('userId').lean();

    if (assignments && assignments.length > 0) {
      // Get all user IDs from assignments
      const userIds = assignments.map(a => a.userId).filter(Boolean);

      // Check user roles in bulk to exclude admins
      const users = await User.find({
        _id: { $in: userIds },
        role: { $ne: 'admin' } // Exclude admins
      }).select('_id').lean();

      return users.map(u => u._id);
    }

    // Fallback to Project.assignedUsers (but filter out admins)
    const project = await getProject().findById(projectId).populate('assignedUsers');
    if (!project) return [];

    // Get assigned user IDs
    const userIds = (project.assignedUsers || [])
      .map(u => u._id || u.id || u)
      .filter(Boolean);

    if (userIds.length === 0) return [];

    // Check user roles in bulk to exclude admins
    const users = await User.find({
      _id: { $in: userIds },
      role: { $ne: 'admin' } // Exclude admins
    }).select('_id').lean();

    return users.map(u => u._id);
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
    const tension = await getTension().findById(tensionId);
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
    // Only notify assigned experts (not admins)
    const assignedExperts = await getAssignedExperts(projectId);

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

    await createNotifications(assignedExperts, payload);
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
    // Only notify assigned experts (not admins)
    const assignedExperts = await getAssignedExperts(projectId);

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

    await createNotifications(assignedExperts, payload);
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
    // Only notify assigned experts (not admins)
    const assignedExperts = await getAssignedExperts(projectId);

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

    await createNotifications(assignedExperts, payload, { dedupeWindow: 60000 }); // 60 second dedupe
  } catch (error) {
    console.error('Error notifying tension voted:', error);
  }
}

/**
 * Notify admins when evaluation is started (once per project+user+questionnaireKey)
 */
async function notifyEvaluationStarted(projectId, userId, questionnaireKey, questionnaireVersion, actorRole, userName) {
  try {
    const dedupeKey = `evaluation_started_${projectId}_${userId}_${questionnaireKey}_${questionnaireVersion || 1}`;

    // Check if already notified for this combination using dedupeKey
    const existing = await Notification.findOne({
      dedupeKey
    });

    if (existing) {
      // Already notified, skip
      return;
    }

    const admins = await getAllAdmins();
    if (admins.length === 0) return;

    const project = await getProject().findById(projectId);
    const projectTitle = project?.title || 'Project';

    const payload = {
      projectId,
      entityType: 'evaluation',
      entityId: userId, // Using userId as entityId for evaluation_started
      type: 'evaluation_started',
      title: 'Evaluation started',
      message: `${actorRole || 'Expert'} (${userName || 'User'}) has started evaluation for project "${projectTitle}".`,
      actorId: userId,
      actorRole,
      metadata: {
        questionnaireKey,
        questionnaireVersion: questionnaireVersion || 1
      },
      url: `/admin/projects/${projectId}/evaluations`,
      dedupeKey
    };

    await createNotifications(admins, payload);
  } catch (error) {
    console.error('Error notifying evaluation started:', error);
  }
}

/**
 * Notify experts when a new project is created and they are assigned
 */
async function notifyProjectCreated(projectId, userIds, actorId, actorRole) {
  try {
    if (!userIds || userIds.length === 0) return;

    const project = await getProject().findById(projectId);
    if (!project) return;

    const projectTitle = project.title || 'Project';

    // Create notifications for all assigned experts (exclude admins)
    const notifications = [];
    for (const userId of userIds) {
      // Check if user is admin, skip if so
      const user = await User.findById(userId).select('role').lean();
      if (user && user.role === 'admin') {
        continue; // Skip admins
      }

      const dedupeKey = `project_created_${projectId}_${userId}`;

      // Check if already notified
      const existing = await Notification.findOne({ dedupeKey });
      if (existing) continue;

      const payload = {
        projectId,
        entityType: 'evaluation',
        entityId: projectId,
        type: 'project_assigned',
        title: 'New project created',
        message: `A new project "${projectTitle}" has been created and you have been assigned to it.`,
        actorId: typeof actorId === 'string' ? actorId : actorId?._id || actorId || projectId,
        actorRole: actorRole || 'admin',
        metadata: {
          projectTitle
        },
        url: `/projects/${projectId}`,
        dedupeKey
      };

      notifications.push(new Notification(payload));
    }

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  } catch (error) {
    console.error('Error notifying project created:', error);
  }
}

/**
 * Notify expert when assigned to a project
 */
async function notifyProjectAssigned(projectId, userId, assignmentId, role, actorId, actorRole) {
  try {
    const dedupeKey = `project_assigned_${projectId}_${userId}_${assignmentId}`;

    // Check if already notified
    const existing = await Notification.findOne({
      dedupeKey
    });

    if (existing) {
      return; // Already notified
    }

    const project = await getProject().findById(projectId);
    const projectTitle = project?.title || 'Project';

    const payload = {
      projectId,
      entityType: 'evaluation',
      entityId: assignmentId,
      type: 'project_assigned',
      title: 'New project created',
      message: `A new project "${projectTitle}" has been created and you have been assigned to it.`,
      actorId: typeof actorId === 'string' ? actorId : actorId._id || actorId,
      actorRole: actorRole || 'admin',
      metadata: {
        assignmentId,
        role,
        projectTitle
      },
      url: `/projects/${projectId}`,
      dedupeKey
    };

    await createNotifications([userId], payload);
  } catch (error) {
    console.error('Error notifying project assigned:', error);
  }
}

/**
 * Notify admins when expert completes evaluation (submits all answers)
 */
async function notifyEvaluationCompleted(projectId, userId, questionnaireKey, questionnaireVersion, actorRole, userName) {
  try {
    const dedupeKey = `evaluation_completed_${projectId}_${userId}_${questionnaireKey}_${questionnaireVersion || 1}`;

    // Check if already notified
    const existing = await Notification.findOne({
      dedupeKey
    });

    if (existing) {
      return; // Already notified
    }

    const admins = await getAllAdmins();
    if (admins.length === 0) return;

    const project = await getProject().findById(projectId);
    const projectTitle = project?.title || 'Project';

    const payload = {
      projectId,
      entityType: 'evaluation',
      entityId: userId,
      type: 'evaluation_completed',
      title: 'Evaluation completed',
      message: `${actorRole || 'Expert'} (${userName || 'User'}) has completed all questions for project "${projectTitle}".`,
      actorId: userId,
      actorRole,
      metadata: {
        questionnaireKey,
        questionnaireVersion: questionnaireVersion || 1,
        role: actorRole,
        submittedAt: new Date()
      },
      url: `/admin/projects/${projectId}/evaluations`,
      dedupeKey
    };

    await createNotifications(admins, payload);
  } catch (error) {
    console.error('Error notifying evaluation completed:', error);
  }
}

/**
 * Check if all assigned experts have completed and notify admins
 */
async function checkAndNotifyAllExpertsCompleted(projectId, questionnaireKey, questionnaireVersion) {
  try {
    const dedupeKey = `project_all_completed_${projectId}_${questionnaireKey}_${questionnaireVersion || 1}`;

    // Check if already notified
    const existing = await Notification.findOne({
      dedupeKey
    });

    if (existing) {
      return; // Already notified
    }

    // Get all assigned experts for this project
    const assignments = await ProjectAssignment.find({
      projectId,
      status: { $in: ['assigned', 'in_progress', 'submitted'] }
    }).select('userId role questionnaires').lean();

    if (!assignments || assignments.length === 0) {
      return; // No assignments
    }

    // Get all responses for this project and questionnaire
    const Response = require('../models/response');
    const responses = await Response.find({
      projectId,
      questionnaireKey,
      status: 'submitted'
    }).select('userId').lean();

    const submittedUserIds = new Set(
      responses.map(r => r.userId.toString())
    );

    // Check if all assigned experts have submitted
    const allAssignedIds = assignments.map(a => a.userId.toString());
    const allSubmitted = allAssignedIds.every(id => submittedUserIds.has(id));

    if (!allSubmitted) {
      return; // Not all experts have submitted yet
    }

    // All experts have submitted - notify admins
    const admins = await getAllAdmins();
    if (admins.length === 0) return;

    const project = await getProject().findById(projectId);
    const projectTitle = project?.title || 'Project';

    const payload = {
      projectId,
      entityType: 'evaluation',
      entityId: projectId, // Using projectId as entityId
      type: 'project_all_completed',
      title: 'All evaluations completed',
      message: `All assigned experts have completed their evaluations for project "${projectTitle}". Report generation is ready.`,
      actorId: projectId, // No specific actor
      actorRole: 'system',
      metadata: {
        questionnaireKey,
        questionnaireVersion: questionnaireVersion || 1,
        assignedCount: assignments.length,
        submittedCount: submittedUserIds.size
      },
      url: `/admin/projects/${projectId}/reports`,
      dedupeKey
    };

    await createNotifications(admins, payload);
  } catch (error) {
    console.error('Error checking and notifying all experts completed:', error);
  }
}

/**
 * Notify admins when an expert comments on a report review
 */
async function notifyAdminReview(projectId, reportId, actorId, actorName, commentText) {
  try {
    const admins = await getAllAdmins();
    if (admins.length === 0) return;

    const project = await getProject().findById(projectId);
    const projectTitle = project?.title || 'Project';

    const payload = {
      projectId,
      entityType: 'report',
      entityId: reportId,
      type: 'report_commented',
      title: 'Expert Report Review',
      message: `${actorName || 'Expert'} commented on the report for "${projectTitle}": "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
      actorId,
      actorRole: 'expert',
      metadata: {
        reportId,
        commentPreview: commentText.substring(0, 100)
      },
      url: `/admin/projects/${projectId}/reports`,
      dedupeKey: `report_comment_${reportId}_${Date.now()}` // Unique per comment
    };

    await createNotifications(admins, payload, { dedupeWindow: 0 });
  } catch (error) {
    console.error('Error notifying admin review:', error);
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
  notifyEvaluationStarted,
  notifyProjectCreated,
  notifyProjectAssigned,
  notifyEvaluationCompleted,
  checkAndNotifyAllExpertsCompleted,
  notifyAdminReview
};

