/**
 * Role Cardinality Configuration
 * 
 * Defines min/max constraints for evaluator roles per project.
 * Z-Inspection Framework currently requires exactly 1 ethical-expert.
 * 
 * Future frameworks may have different requirements - update config, not code.
 */

module.exports = {
    ETHICAL_EXPERT_CARDINALITY: {
        min: 1,
        max: 1,
        description: 'Z-Inspection requires exactly ONE ethical-expert per project for ethical plurality validation'
    },

    // Other role constraints (optional, for future use)
    ROLE_CONSTRAINTS: {
        'legal-expert': { min: 0, max: 5 },
        'technical-expert': { min: 0, max: 5 },
        'medical-expert': { min: 0, max: 5 },
        'education-expert': { min: 0, max: 5 }
    },

    // Minimum total evaluator count for valid ethical plurality
    MIN_TOTAL_EVALUATORS: 3
};
