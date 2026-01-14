/**
 * PHASE 4: Assignment API Guard - Code Snippet
 * 
 * **MANUAL INTEGRATION REQUIRED**
 * 
 * This guard prevents duplicate ethical-expert assignment.
 * Add this code to your assignment creation endpoint.
 * 
 * Likely locations:
 * - server.js (if monolithic)
 * - controllers/projectController.js
 * - routes/projects.js
 * 
 * Look for routes like:
 * - POST /api/projects/:projectId/assign
 * - POST /api/project-assignments
 */

const { ETHICAL_EXPERT_CARDINALITY } = require('./config/roles.config');
const ProjectAssignment = require('./models/projectAssignment');
const mongoose = require('mongoose');

/**
 * EXAMPLE: Assignment Endpoint with Role Cardinality Guard
 */
async function exampleAssignmentEndpoint(req, res) {
    const { projectId, userId, role } = req.body;

    try {
        const projectIdObj = mongoose.Types.ObjectId(projectId);

        // PHASE 4: Role Cardinality Guard
        if (role === 'ethical-expert') {
            console.log(`🔒 [PHASE 4] Checking ethical-expert cardinality for project ${projectId}...`);

            const existingCount = await ProjectAssignment.countDocuments({
                projectId: projectIdObj,
                role: 'ethical-expert'
            });

            console.log(`📊 [PHASE 4] Current ethical-expert count: ${existingCount}`);
            console.log(`📏 [PHASE 4] Maximum allowed: ${ETHICAL_EXPERT_CARDINALITY.max}`);

            if (existingCount >= ETHICAL_EXPERT_CARDINALITY.max) {
                console.log(`❌ [PHASE 4] BLOCKED: Cannot assign duplicate ethical-expert`);

                return res.status(400).json({
                    success: false,
                    error: 'ROLE_CARDINALITY_EXCEEDED',
                    message: `Only ${ETHICAL_EXPERT_CARDINALITY.max} ethical-expert allowed per project (Z-Inspection methodology requirement)`,
                    details: {
                        role: 'ethical-expert',
                        currentCount: existingCount,
                        maxAllowed: ETHICAL_EXPERT_CARDINALITY.max,
                        projectId: projectId
                    },
                    action: 'Remove existing ethical-expert before assigning a new one, or assign a different role'
                });
            }

            console.log(`✅ [PHASE 4] Cardinality check PASSED - proceeding with assignment`);
        }

        // Proceed with normal assignment logic
        const assignment = new ProjectAssignment({
            projectId: projectIdObj,
            userId,
            role,
            assignedAt: new Date()
        });

        await assignment.save();

        res.json({
            success: true,
            assignment
        });

    } catch (error) {
        console.error('Assignment error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * INTEGRATION INSTRUCTIONS
 * 
 * 1. Find your assignment creation endpoint
 *    - Search for: "ProjectAssignment" + "save" or "create"
 *    - Look in server.js or controllers/
 * 
 * 2. Add the guard BEFORE creating the assignment:
 *    - Import: require('./config/roles.config')
 *    - Check: if (role === 'ethical-expert')
 *    - Count: await ProjectAssignment.countDocuments(...)
 *    - Block: if (count >= max) return 400 error
 * 
 * 3. Test:
 *    - Try assigning 2nd ethical-expert
 *    - Should receive 400 error with clear message
 *    - Should NOT create ProjectAssignment document
 * 
 * 4. Verify logs:
 *    - Should see "[PHASE 4] Checking ethical-expert cardinality..."
 *    - Should see "[PHASE 4] BLOCKED: Cannot assign duplicate..."
 */

module.exports = {
    exampleAssignmentEndpoint
};
