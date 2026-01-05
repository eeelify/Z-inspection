/**
 * Answer Severity Service (ERC Model)
 * 
 * Computes answerSeverity (0-1) deterministically based on answer content.
 * answerSeverity = risk severity indicated by the answer (system state), NOT question importance.
 * 
 * ERC (Ethical Risk Contribution) = QuestionRiskImportance (0-4) × AnswerRiskSeverity (0-1)
 */

/**
 * Clamp answerSeverity to valid range [0, 1]
 * @param {number} severity - Input severity
 * @returns {number} Clamped severity
 */
function clampAnswerSeverity(severity) {
  return Math.max(0, Math.min(1, severity));
}

/**
 * Map option label/key to answerSeverity (0-1) for multiple-choice questions
 * Rules:
 * - Safe / Yes / Very confident → 0
 * - Partial / Somewhat → 0.5
 * - Risky / No / Not confident → 1
 * @param {string} choiceKey - The selected option key
 * @param {Object} option - The option object with label
 * @returns {number} answerSeverity (0-1)
 */
function mapOptionToSeverity(choiceKey, option) {
  if (!choiceKey) return 0.5; // Default to medium if no choice
  
  const keyLower = choiceKey.toLowerCase();
  const labelEn = option?.label?.en?.toLowerCase() || '';
  const labelTr = option?.label?.tr?.toLowerCase() || '';
  const combined = `${keyLower} ${labelEn} ${labelTr}`;
  
  // Safe / Yes / Very confident → 0
  const safePatterns = [
    /\b(yes|safe|very confident|fully|completely|always|strong|robust|implemented|in place|adequate|sufficient|clear|transparent|compliant|compliant|verified|tested|monitored|audited)\b/i,
    /\b(very_clear|very_safe|very_confident|fully_implemented|always_yes|strong_yes)\b/i
  ];
  
  // Risky / No / Not confident → 1
  const riskyPatterns = [
    /\b(no|risky|not confident|not sure|unsure|missing|none|unknown|not implemented|no policy|no control|no safeguard|no mitigation|gap|gaps|lack|lacking|absence|absent|unclear|inadequate|insufficient|non-compliant|not verified|not tested|not monitored|not audited)\b/i,
    /\b(very_unclear|very_risky|not_confident|not_implemented|no_control|no_safeguard)\b/i
  ];
  
  // Partial / Somewhat → 0.5
  const partialPatterns = [
    /\b(somewhat|partial|partially|mostly|moderate|moderately|sometimes|occasionally|some|few|limited|partly|incomplete|needs improvement|could be better)\b/i,
    /\b(mostly_clear|somewhat_clear|partially_implemented|moderate_confidence)\b/i
  ];
  
  // Check in order: risky first (most important), then safe, then partial
  if (riskyPatterns.some(pattern => pattern.test(combined))) {
    return 1.0;
  }
  if (safePatterns.some(pattern => pattern.test(combined))) {
    return 0.0;
  }
  if (partialPatterns.some(pattern => pattern.test(combined))) {
    return 0.5;
  }
  
  // Default to 0.5 if no pattern matches
  return 0.5;
}

/**
 * Calculate answerSeverity for select-based questions
 * @param {Object} question - Question document
 * @param {Object} answerEntry - Answer entry from Response
 * @returns {Object} { answerSeverity: number (0-1), mappingMissing: boolean, source: string }
 */
function calculateAnswerSeveritySelect(question, answerEntry) {
  const choiceKey = answerEntry.answer?.choiceKey || 
                    answerEntry.answer?.selectedOption || 
                    answerEntry.answer?.selectedValue;
  
  if (!choiceKey) {
    // No answer selected => high severity (missing info is risky)
    return { answerSeverity: 1.0, mappingMissing: false, source: 'no_answer' };
  }

  // Check optionSeverityMap first (explicit mapping in question schema)
  if (question.optionSeverityMap) {
    let severity;
    if (question.optionSeverityMap instanceof Map) {
      severity = question.optionSeverityMap.get(choiceKey);
    } else if (typeof question.optionSeverityMap === 'object') {
      severity = question.optionSeverityMap[choiceKey];
    }
    
    if (severity !== undefined && severity !== null) {
      return { 
        answerSeverity: clampAnswerSeverity(severity), 
        mappingMissing: false,
        source: 'optionSeverityMap'
      };
    }
  }

  // Fallback: Check options array for explicit answerSeverity field
  if (question.options && Array.isArray(question.options)) {
    const option = question.options.find(opt => opt.key === choiceKey);
    if (option && option.answerSeverity !== undefined && option.answerSeverity !== null) {
      return { 
        answerSeverity: clampAnswerSeverity(option.answerSeverity), 
        mappingMissing: false,
        source: 'option_answerSeverity'
      };
    }
    
    // If no explicit mapping, use label-based inference
    if (option) {
      const inferredSeverity = mapOptionToSeverity(choiceKey, option);
      return {
        answerSeverity: inferredSeverity,
        mappingMissing: true, // Flag as missing explicit mapping
        source: 'label_inference'
      };
    }
  }

  // Default: answerSeverity = 0.5 (medium) if no mapping found
  return { answerSeverity: 0.5, mappingMissing: true, source: 'default' };
}

/**
 * Calculate answerSeverity for free-text questions
 * Uses expert-provided severity if available, otherwise defaults to 0.5
 * @param {Object} answerEntry - Answer entry from Response
 * @returns {Object} { answerSeverity: number (0-1), source: string }
 */
function calculateAnswerSeverityFreeText(answerEntry) {
  // Check for expert-provided severity in answer entry
  // This should be set by the expert when answering free-text questions
  if (answerEntry.answerSeverity !== undefined && answerEntry.answerSeverity !== null) {
    return {
      answerSeverity: clampAnswerSeverity(answerEntry.answerSeverity),
      source: 'expert_provided'
    };
  }
  
  // If not provided, default to 0.5 (medium severity)
  // TODO: In future, we may add automatic inference, but for now we require expert input
  return {
    answerSeverity: 0.5,
    source: 'default_not_provided'
  };
}

/**
 * Main function to calculate answerSeverity based on question type
 * @param {Object} question - Question document
 * @param {Object} answerEntry - Answer entry from Response
 * @returns {Object} { answerSeverity: number (0-1), metadata: object }
 */
function calculateAnswerSeverity(question, answerEntry) {
  if (question.answerType === 'single_choice' || question.answerType === 'multi_choice') {
    const result = calculateAnswerSeveritySelect(question, answerEntry);
    return {
      answerSeverity: result.answerSeverity,
      metadata: {
        answerType: 'select',
        mappingMissing: result.mappingMissing,
        source: result.source
      }
    };
  } else if (question.answerType === 'open_text') {
    const result = calculateAnswerSeverityFreeText(answerEntry);
    return {
      answerSeverity: result.answerSeverity,
      metadata: {
        answerType: 'free_text',
        source: result.source
      }
    };
  } else {
    // Numeric or unknown - default to medium severity
    return {
      answerSeverity: 0.5,
      metadata: {
        answerType: question.answerType || 'unknown',
        source: 'default_unsupported_type'
      }
    };
  }
}

module.exports = {
  calculateAnswerSeverity,
  calculateAnswerSeveritySelect,
  calculateAnswerSeverityFreeText,
  mapOptionToSeverity,
  clampAnswerSeverity
};
