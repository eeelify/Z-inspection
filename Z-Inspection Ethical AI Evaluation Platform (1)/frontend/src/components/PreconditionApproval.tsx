import React from 'react';
import { ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';

interface PreconditionApprovalProps {
  userRole: string;
  onApproval: () => void;
  onBack: () => void;
}

const roleColors = {
  admin: '#1F2937',
  'ethical-expert': '#1E40AF',
  'medical-expert': '#9D174D',
  'use-case-owner': '#065F46',
  'education-expert': '#7C3AED',
  'technical-expert': '#0891B2',
  'legal-expert': '#B45309'
} as const;

const roleContent = {
  'ethical-expert': {
    title: 'Ethical Expert Guidelines',
    disclaimer:
      'As an Ethical Expert on the Z-Inspection® platform, you contribute to the independent evaluation of AI systems from an ethical, legal and societal perspective. Your role requires a high level of integrity, impartiality and awareness of potential harms.',
    responsibilities: [
      'Review the ethical alignment of AI systems with relevant principles, norms and values',
      'Assess potential unfairness, bias and discrimination in data, models and system behaviour',
      'Evaluate transparency, explainability and meaningful communication of results to stakeholders',
      'Analyse broader social impact, accountability mechanisms and redress opportunities'
    ]
  },
  'medical-expert': {
    title: 'Medical Expert Guidelines',
    disclaimer:
      'As a Medical Expert on the Z-Inspection® platform, you contribute to the independent evaluation of AI systems used in healthcare and medicine. Your role requires clinical judgement, ethical awareness and patient-centred thinking.',
    responsibilities: [
      'Review compliance with medical ethics, clinical standards and patient safety requirements',
      'Assess clinical validity, reliability and limitations of the AI system in its intended setting',
      'Evaluate potential risks, benefits and unintended consequences for patients and clinicians',
      'Analyse alignment with healthcare regulations, professional duties and quality of care'
    ]
  },
  'use-case-owner': {
    title: 'Use Case Owner Guidelines',
    disclaimer:
      'As a Use Case Owner on the Z-Inspection® platform, you provide contextual and domain-specific knowledge regarding the AI system and its real-world deployment environment.',
    responsibilities: [
      'Provide accurate and complete information about the use case, stakeholders and context of use',
      'Review claims made about the AI system and help clarify expected outcomes and limitations',
      'Assess practical feasibility, integration into workflows and impact on stakeholders',
      'Contribute relevant documentation and evidence to support a robust and transparent assessment'
    ]
  },
  'education-expert': {
    title: 'Education Expert Guidelines',
    disclaimer:
      'As an Education Expert on the Z-Inspection® platform, you evaluate AI systems that affect learning, teaching and educational environments.',
    responsibilities: [
      'Review educational impact, learning outcomes and pedagogical soundness of the AI system',
      'Assess accessibility, inclusiveness and potential for reinforcing educational inequalities',
      'Evaluate student data protection, privacy and responsible use of learning analytics',
      'Analyse alignment with educational ethics, institutional policies and professional standards'
    ]
  },
  'technical-expert': {
    title: 'Technical Expert Guidelines',
    disclaimer:
      'As a Technical Expert on the Z-Inspection® platform, you are responsible for assessing the technical design, implementation and robustness of AI systems.',
    responsibilities: [
      'Review system architecture, data pipelines, model design and deployment setup',
      'Assess security, privacy-by-design measures and resilience against failures or attacks',
      'Evaluate robustness, performance, monitoring and model lifecycle management',
      'Analyse conformity with relevant technical standards, best practices and documentation'
    ]
  },
  'legal-expert': {
    title: 'Legal Expert Guidelines',
    disclaimer:
      'As a Legal Expert on the Z-Inspection® platform, you assess the compliance of AI systems with applicable laws, regulations and contractual obligations.',
    responsibilities: [
      'Review compliance with data protection, privacy and information-security laws',
      'Assess liability, accountability and allocation of responsibilities among actors',
      'Evaluate contractual arrangements, intellectual property and terms of use',
      'Analyse alignment with relevant regulatory frameworks and guidance for AI systems'
    ]
  }
} as const;

// Generic fallback if role content is not found
const defaultContent = {
  title: 'Z-Inspection® Platform Guidelines',
  disclaimer:
    'You will contribute to the independent evaluation of AI systems on the Z-Inspection® platform. Please review the responsibilities below before proceeding.',
  responsibilities: [
    'Provide objective, well-reasoned and transparent assessments',
    'Respect data protection, privacy and confidentiality obligations at all times',
    'Collaborate constructively and respectfully with other members of the inspection team',
    'Support the responsible and trustworthy development and deployment of AI systems'
  ]
};

export function PreconditionApproval({
  userRole,
  onApproval,
  onBack
}: PreconditionApprovalProps) {
  const content =
    roleContent[userRole as keyof typeof roleContent] ?? defaultContent;

  const roleColor =
    roleColors[userRole as keyof typeof roleColors] ?? '#1F2937';

  const [conflictChecks, setConflictChecks] = React.useState({
    entity: false,
    vendors: false,
    bias: false
  });

  const allChecked = Object.values(conflictChecks).every(Boolean);

  const handleCheckboxChange = (key: keyof typeof conflictChecks) => {
    setConflictChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm px-6 py-4">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-gray-800 mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </button>
          <h1 className="text-xl text-gray-900">Z-Inspection® Platform</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Colored Header */}
          <div className="px-8 py-6" style={{ backgroundColor: roleColor }}>
            <div className="flex items-center text-white">
              <AlertCircle className="h-6 w-6 mr-3" />
              <h2 className="text-2xl font-semibold">{content.title}</h2>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-8 space-y-8">
            {/* Role disclaimer + responsibilities */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-900">
                Role-Specific Disclaimer
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {content.disclaimer}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900">
                Core Responsibilities
              </h3>
              <ul className="space-y-3">
                {content.responsibilities.map((responsibility, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle
                      className="h-5 w-5 mr-3 mt-0.5"
                      style={{ color: roleColor }}
                    />
                    <span className="text-gray-700">{responsibility}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Conflict of Interest section (Z-Inspection rationale) */}
            <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
              <h3 className="text-lg font-semibold mb-3 text-gray-900">
                Conflict of Interest and Impartiality Declaration
              </h3>
              <p className="text-gray-700 text-sm leading-relaxed mb-4">
                The Z-Inspection® methodology requires independence and impartiality of inspectors. 
                All members of the inspection team must ensure that their participation does not 
                compromise the objectivity, fairness, and integrity of the assessment process.
              </p>
              <ol className="list-[lower-alpha] ml-5 space-y-2 text-sm text-gray-700 mb-4">
                <li>
                  No conflict of interest exists between the inspector and the entity or organisation 
                  or AI system under inspection.
                </li>
                <li>
                  No conflict of interest exists between the inspector and vendors or providers of 
                  tools, toolkits, frameworks, or data platforms used in the inspection.
                </li>
                <li>
                  Any potential bias or homogeneity in the composition of the inspection team is 
                  considered and addressed to minimize "group thinking" and to avoid one-dimensional 
                  perspectives, unjustified discrimination, or unfair results.
                </li>
              </ol>

              <p className="text-gray-700 text-sm leading-relaxed mb-4">
                Within the Z-Inspection® methodology, the assessment of these three conditions 
                determines whether the inspection can proceed:
              </p>
              <ul className="list-disc ml-5 space-y-1 text-sm text-gray-700 mb-4">
                <li>
                  If conditions (a), (b), and (c) are satisfied, the assessment can proceed as a{' '}
                  <span className="font-semibold">"GO"</span>.
                </li>
                <li>
                  If only condition (b) is not satisfied, it may proceed as a{' '}
                  <span className="font-semibold">"Still GO"</span> with restricted use of specific 
                  tools, toolkits, frameworks, or data platforms.
                </li>
                <li>
                  If condition (a) or (c) are not satisfied, it must be considered a{' '}
                  <span className="font-semibold">"NoGO"</span> and the inspection team composition 
                  or participation must be reconsidered.
                </li>
              </ul>

              {/* Checkboxes */}
              <div className="space-y-3 text-sm text-gray-700">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-700"
                    checked={conflictChecks.entity}
                    onChange={() => handleCheckboxChange('entity')}
                  />
                  <span className="ml-2">
                    I confirm that I have no conflict of interest with the entity or organisation 
                    and AI system under inspection, or that any such relationship has been fully 
                    disclosed to the coordination team.
                  </span>
                </label>

                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-700"
                    checked={conflictChecks.vendors}
                    onChange={() => handleCheckboxChange('vendors')}
                  />
                  <span className="ml-2">
                    I confirm that I have no conflict of interest with vendors or providers of 
                    tools, toolkits, frameworks or data platforms used in the inspection. If any 
                    such relationship exists, I understand that the use of these tools may be 
                    restricted under a 'Still GO' condition.
                  </span>
                </label>

                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-700"
                    checked={conflictChecks.bias}
                    onChange={() => handleCheckboxChange('bias')}
                  />
                  <span className="ml-2">
                    I acknowledge that my own perspective and the overall composition of the 
                    inspection team will be assessed for potential bias and homogeneity, to avoid 
                    'group thinking' and to safeguard a fair and pluralistic evaluation.
                  </span>
                </label>
              </div>
            </div>

            {/* General platform notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5" />
                <div>
                  <h4 className="text-yellow-800 font-semibold mb-1">
                    Important Notice
                  </h4>
                  <p className="text-yellow-700 text-sm leading-relaxed">
                    This platform is dedicated to the careful and ethical
                    evaluation of AI systems. All contributions should be made
                    with professional integrity, independence and respect for
                    affected individuals and communities. Your declarations and
                    assessments form part of the formal Z-Inspection®
                    documentation.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-gray-600 max-w-md">
                By continuing, you formally confirm the above declarations and
                agree to follow the Z-Inspection® methodology and its principles
                of independence, impartiality and responsibility.
              </div>
              <button
                onClick={onApproval}
                disabled={!allChecked}
                className={`px-6 py-3 rounded-lg text-white text-sm font-medium transition-colors ${
                  allChecked
                    ? 'hover:opacity-90 cursor-pointer'
                    : 'opacity-60 cursor-not-allowed'
                }`}
                style={{ backgroundColor: roleColor }}
              >
                Continue to Platform
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
