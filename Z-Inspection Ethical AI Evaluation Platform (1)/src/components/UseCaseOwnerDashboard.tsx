import React, { useState } from 'react';
import { Plus, LogOut, FolderOpen, Upload, X, FileText, Clock, TrendingUp, Eye, Download, Info, Database, Users as UsersIcon, Scale } from 'lucide-react';
import { User, UseCase } from '../types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface UseCaseOwnerDashboardProps {
  currentUser: User;
  useCases: UseCase[];
  onCreateUseCase: (useCase: Partial<UseCase>) => void;
  onViewUseCase: (useCase: UseCase) => void;
  onLogout: () => void;
}

const statusColors = {
  'assigned': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  'in-review': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  'completed': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' }
};

const statusLabels = {
  'assigned': 'Assigned',
  'in-review': 'In Review',
  'completed': 'Completed'
};

export function UseCaseOwnerDashboard({
  currentUser,
  useCases,
  onCreateUseCase,
  onViewUseCase,
  onLogout
}: UseCaseOwnerDashboardProps) {
  const [showNewUseCaseModal, setShowNewUseCaseModal] = useState(false);

  const myUseCases = useCases.filter(uc => uc.ownerId === currentUser.id);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Role Color Bar */}
        <div className="h-1 bg-gradient-to-r from-green-500 to-green-600" />
        
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="text-xl text-gray-900 mb-1">Z-Inspection</div>
          <div className="text-xs text-gray-600">Use-case Owner Portal</div>
        </div>

        {/* User Profile */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white mr-3">
              {currentUser.name.charAt(0)}
            </div>
            <div className="text-sm">
              <div className="text-gray-900">{currentUser.name}</div>
              <div className="text-gray-500">Use-case Owner</div>
            </div>
          </div>
        </div>

        {/* Navigation - Restricted */}
        <nav className="flex-1 px-3 py-4">
          <button className="w-full px-4 py-3 mb-2 flex items-center bg-green-50 text-green-700 rounded-lg">
            <FolderOpen className="h-4 w-4 mr-3" />
            My Projects
          </button>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onLogout}
            className="w-full px-4 py-3 flex items-center text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <LogOut className="h-4 w-4 mr-3" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl text-gray-900 mb-2">Use-case Owner Dashboard</h1>
              <p className="text-gray-600">Upload and monitor your AI system use cases</p>
            </div>
            <button
              onClick={() => setShowNewUseCaseModal(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center shadow-sm"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Use Case
            </button>
          </div>
        </div>

        {/* Use Case Template Banner */}
        <div className="mx-8 mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-blue-600 mr-3" />
            <div>
              <div className="text-sm text-blue-900">Need help getting started?</div>
              <div className="text-xs text-blue-700">Download our use case template for guidance</div>
            </div>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center">
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </button>
        </div>

        {/* Use Cases Grid */}
        <div className="px-8 py-6">
          {myUseCases.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myUseCases.map(useCase => (
                <div
                  key={useCase.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  {/* Status Badge */}
                  <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg text-gray-900 flex-1 mr-2">{useCase.title}</h3>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${statusColors[useCase.status].bg} ${statusColors[useCase.status].text} whitespace-nowrap`}
                      >
                        {statusLabels[useCase.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{useCase.description}</p>
                  </div>

                  {/* Progress Bar */}
                  <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-600">Progress</span>
                      <span className="text-xs text-gray-900">{useCase.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${useCase.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="px-6 py-4 bg-gray-50">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        Last updated: {new Date(useCase.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {/* Assigned Experts */}
                    {useCase.assignedExperts && useCase.assignedExperts.length > 0 && (
                      <div className="flex items-center mb-3">
                        <span className="text-xs text-gray-600 mr-2">Assigned Experts:</span>
                        <div className="flex -space-x-2">
                          {useCase.assignedExperts.slice(0, 3).map((expertId, idx) => (
                            <div
                              key={expertId}
                              className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 border-2 border-white flex items-center justify-center text-white text-xs"
                              title={`Expert ${idx + 1}`}
                            >
                              {String.fromCharCode(65 + idx)}
                            </div>
                          ))}
                          {useCase.assignedExperts.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-gray-600 text-xs">
                              +{useCase.assignedExperts.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => onViewUseCase(useCase)}
                      className="w-full px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 text-sm flex items-center justify-center"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <FolderOpen className="h-20 w-20 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl text-gray-900 mb-2">No Use Cases Yet</h3>
              <p className="text-gray-600 mb-6">Create your first use case to get started with the evaluation process</p>
              <button
                onClick={() => setShowNewUseCaseModal(true)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 inline-flex items-center"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Use Case
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Use Case Modal */}
      {showNewUseCaseModal && (
        <NewUseCaseModal
          onClose={() => setShowNewUseCaseModal(false)}
          onSubmit={(data) => {
            onCreateUseCase(data);
            setShowNewUseCaseModal(false);
          }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

interface NewUseCaseModalProps {
  onClose: () => void;
  onSubmit: (data: Partial<UseCase>) => void;
  currentUser: User;
}

function NewUseCaseModal({ onClose, onSubmit, currentUser }: NewUseCaseModalProps) {
  // Basic Information
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [aiSystemCategory, setAiSystemCategory] = useState('Healthcare & Medical');
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<string[]>([]);

  // Section I - Basic System Definition
  const [systemName, setSystemName] = useState('');
  const [systemVersion, setSystemVersion] = useState('');
  const [developer, setDeveloper] = useState('');
  const [applicationDomain, setApplicationDomain] = useState('');
  const [purposeStatement, setPurposeStatement] = useState('');
  const [deploymentEnvironment, setDeploymentEnvironment] = useState('');
  const [deploymentStage, setDeploymentStage] = useState('');
  const [primaryClaims, setPrimaryClaims] = useState('');
  const [solutionCurrency, setSolutionCurrency] = useState('');
  const [legalCompliance, setLegalCompliance] = useState('');

  // Section II - Actors, Decision-Making & Oversight
  const [targetUsers, setTargetUsers] = useState('');
  const [userProficiency, setUserProficiency] = useState('');
  const [epistemicAuthority, setEpistemicAuthority] = useState('');
  const [overtrustRisk, setOvertrustRisk] = useState('');
  const [operationalDelay, setOperationalDelay] = useState('');
  const [accessibility, setAccessibility] = useState('');

  // Section III - Data Governance & Technical Robustness
  const [modelType, setModelType] = useState('');
  const [dataSource, setDataSource] = useState('');
  const [trainingDataCharacteristics, setTrainingDataCharacteristics] = useState('');
  const [trainingSufficiency, setTrainingSufficiency] = useState('');
  const [dataAppropriateness, setDataAppropriateness] = useState('');
  const [federatedLearning, setFederatedLearning] = useState('');
  const [modelGeneralization, setModelGeneralization] = useState('');
  const [dataPrivacy, setDataPrivacy] = useState('');
  const [cybersecurity, setCybersecurity] = useState('');
  const [modelMaintenance, setModelMaintenance] = useState('');

  // Section IV - Ethics, Fairness & Social Impact
  const [ethicalRisks, setEthicalRisks] = useState('');
  const [biasMonitoring, setBiasMonitoring] = useState('');
  const [resourceDependency, setResourceDependency] = useState('');
  const [adverseOutcomes, setAdverseOutcomes] = useState('');
  const [environmentalImpact, setEnvironmentalImpact] = useState('');

  // Section V - Explainability & Accountability
  const [explainability, setExplainability] = useState('');
  const [uncertaintyCommunication, setUncertaintyCommunication] = useState('');
  const [modelDocumentation, setModelDocumentation] = useState('');
  const [feedbackMechanisms, setFeedbackMechanisms] = useState('');
  const [costBenefit, setCostBenefit] = useState('');
  const [accountability, setAccountability] = useState('');
  const [traceability, setTraceability] = useState('');

  const categories = [
    'Healthcare & Medical',
    'Finance',
    'Education',
    'Transportation',
    'Energy',
    'Public Sector',
    'Other'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      aiSystemCategory,
      status: 'assigned',
      progress: 0,
      ownerId: currentUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      supportingFiles: files.map(f => ({ name: f, url: '#' })),
      // Extended information
      extendedInfo: {
        sectionI: {
          systemName,
          systemVersion,
          developer,
          applicationDomain,
          purposeStatement,
          deploymentEnvironment,
          deploymentStage,
          primaryClaims,
          solutionCurrency,
          legalCompliance
        },
        sectionII: {
          targetUsers,
          userProficiency,
          epistemicAuthority,
          overtrustRisk,
          operationalDelay,
          accessibility
        },
        sectionIII: {
          modelType,
          dataSource,
          trainingDataCharacteristics,
          trainingSufficiency,
          dataAppropriateness,
          federatedLearning,
          modelGeneralization,
          dataPrivacy,
          cybersecurity,
          modelMaintenance
        },
        sectionIV: {
          ethicalRisks,
          biasMonitoring,
          resourceDependency,
          adverseOutcomes,
          environmentalImpact
        },
        sectionV: {
          explainability,
          uncertaintyCommunication,
          modelDocumentation,
          feedbackMechanisms,
          costBenefit,
          accountability,
          traceability
        }
      }
    });
  };

  const InfoTooltip = ({ content }: { content: string }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3 w-3 text-gray-400 cursor-help inline-block ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const newFiles = Array.from(e.dataTransfer.files).map(f => f.name);
      setFiles([...files, ...newFiles]);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-10">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl text-gray-900">Create New Use Case</h2>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 rounded-lg border border-gray-300 hover:border-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                Submit Use Case
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
            <div>
              <h3 className="text-lg text-gray-900 mb-4">🩺 Basic Information</h3>
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700">Use Case Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="e.g., Medical Image Analysis for Cancer Detection"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Provide a detailed description of your AI system, its purpose, and intended use..."
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700">AI System Category *</label>
              <select
                value={aiSystemCategory}
                onChange={(e) => setAiSystemCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700">Upload Supporting Files</label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'
              }`}
            >
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-1">Drag and drop files here, or click to browse</p>
              <p className="text-xs text-gray-500">Supported: PDF, DOCX, XLSX, PNG, JPG (Max 10MB)</p>
              <input
                type="file"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    const newFiles = Array.from(e.target.files).map(f => f.name);
                    setFiles([...files, ...newFiles]);
                  }
                }}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-block mt-3 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer text-sm"
              >
                Browse Files
              </label>
            </div>

            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center text-sm text-gray-700">
                      <FileText className="h-4 w-4 mr-2 text-gray-400" />
                      {file}
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>

          {/* Divider */}
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-gray-50 px-4 text-sm text-gray-600">
                Extended Information – Z-Inspection® Structured Sections
              </span>
            </div>
          </div>

          {/* Z-Inspection Sections */}
          <Accordion type="multiple" className="space-y-4">
            {/* SECTION I */}
            <AccordionItem value="section-1" className="bg-white rounded-lg shadow-sm border">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center space-x-3 w-full">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-gray-900">🩺 SECTION I – BASIC SYSTEM DEFINITION AND SCOPE</h3>
                    <p className="text-xs text-blue-600 mt-1">EU Trustworthy AI → "Lawful, Transparent Purpose"</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-2 text-gray-700 flex items-center">
                        System Name and Version *
                        <InfoTooltip content="Full name, version, and codename (if any)" />
                      </label>
                      <input
                        type="text"
                        value={systemName}
                        onChange={(e) => setSystemName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        placeholder="e.g., MediScan AI v2.1"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-2 text-gray-700 flex items-center">
                        Developer / Organization *
                        <InfoTooltip content="Institution, team, or company responsible" />
                      </label>
                      <input
                        type="text"
                        value={developer}
                        onChange={(e) => setDeveloper(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        placeholder="e.g., HealthTech Innovations Inc."
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Application Domain *
                      <InfoTooltip content="Sector (Healthcare, Finance, Legal, HR, Education, etc.)" />
                    </label>
                    <select
                      value={applicationDomain}
                      onChange={(e) => setApplicationDomain(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      required
                    >
                      <option value="">Select domain...</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="finance">Finance</option>
                      <option value="legal">Legal</option>
                      <option value="hr">Human Resources</option>
                      <option value="education">Education</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Purpose and Problem Statement *
                      <InfoTooltip content="What problem is the system designed to solve?" />
                    </label>
                    <textarea
                      value={purposeStatement}
                      onChange={(e) => setPurposeStatement(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Describe the problem this AI system aims to solve..."
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-2 text-gray-700 flex items-center">
                        Deployment Environment *
                        <InfoTooltip content="Cloud, On-Premise, Embedded, or Hybrid" />
                      </label>
                      <select
                        value={deploymentEnvironment}
                        onChange={(e) => setDeploymentEnvironment(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        required
                      >
                        <option value="">Select environment...</option>
                        <option value="cloud">Cloud</option>
                        <option value="on-premise">On-Premise</option>
                        <option value="embedded">Embedded</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-2 text-gray-700 flex items-center">
                        Deployment Stage *
                        <InfoTooltip content="Pilot, Beta, Production, or Maintenance" />
                      </label>
                      <select
                        value={deploymentStage}
                        onChange={(e) => setDeploymentStage(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        required
                      >
                        <option value="">Select stage...</option>
                        <option value="pilot">Pilot</option>
                        <option value="beta">Beta</option>
                        <option value="production">Production</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Primary Claims
                      <InfoTooltip content="Developer's key performance, ethical, or impact claims" />
                    </label>
                    <textarea
                      value={primaryClaims}
                      onChange={(e) => setPrimaryClaims(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="List main claims about system performance, ethics, or impact..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Solution Currency
                      <InfoTooltip content="Alignment with latest industry or legal standards" />
                    </label>
                    <textarea
                      value={solutionCurrency}
                      onChange={(e) => setSolutionCurrency(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Describe alignment with current standards..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Legal and Regulatory Compliance
                      <InfoTooltip content="GDPR, HIPAA, ISO, etc." />
                    </label>
                    <textarea
                      value={legalCompliance}
                      onChange={(e) => setLegalCompliance(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="List applicable regulations..."
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* SECTION II */}
            <AccordionItem value="section-2" className="bg-white rounded-lg shadow-sm border">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center space-x-3 w-full">
                  <div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <UsersIcon className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-gray-900">🧍‍♀️ SECTION II – ACTORS, DECISION-MAKING & OVERSIGHT</h3>
                    <p className="text-xs text-purple-600 mt-1">"Human Agency & Oversight" principle</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Target Users and Reach *
                      <InfoTooltip content="Primary and secondary user groups" />
                    </label>
                    <textarea
                      value={targetUsers}
                      onChange={(e) => setTargetUsers(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Describe primary and secondary user groups..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      User Proficiency and Experience
                      <InfoTooltip content="Technical level (expert, general public)" />
                    </label>
                    <textarea
                      value={userProficiency}
                      onChange={(e) => setUserProficiency(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Describe typical user technical proficiency..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Epistemic Authority (Expertise)
                      <InfoTooltip content="Decision-support or decision-maker? Who holds final authority?" />
                    </label>
                    <textarea
                      value={epistemicAuthority}
                      onChange={(e) => setEpistemicAuthority(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Explain who has final decision authority..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Overtrust Risk
                      <InfoTooltip content="Measures preventing user overreliance or confirmation bias" />
                    </label>
                    <textarea
                      value={overtrustRisk}
                      onChange={(e) => setOvertrustRisk(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Describe measures to prevent overreliance..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Operational Delay and Usability
                      <InfoTooltip content="Does system latency cause workflow delays?" />
                    </label>
                    <textarea
                      value={operationalDelay}
                      onChange={(e) => setOperationalDelay(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Address system latency and workflow integration..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Accessibility and Universal Design
                      <InfoTooltip content="Support for disabled or vulnerable users" />
                    </label>
                    <textarea
                      value={accessibility}
                      onChange={(e) => setAccessibility(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Describe accessibility features..."
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* SECTION III */}
            <AccordionItem value="section-3" className="bg-white rounded-lg shadow-sm border">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center space-x-3 w-full">
                  <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Database className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-gray-900">💾 SECTION III – DATA GOVERNANCE & TECHNICAL ROBUSTNESS</h3>
                    <p className="text-xs text-green-600 mt-1">"Technical Robustness & Safety," "Privacy & Data Governance"</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-2 text-gray-700 flex items-center">
                        Model Type *
                        <InfoTooltip content="Algorithm/model type (CNN, LLM, etc.)" />
                      </label>
                      <input
                        type="text"
                        value={modelType}
                        onChange={(e) => setModelType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        placeholder="e.g., CNN, LLM, Random Forest"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-2 text-gray-700 flex items-center">
                        Data Source *
                        <InfoTooltip content="Origin and nature of training data" />
                      </label>
                      <input
                        type="text"
                        value={dataSource}
                        onChange={(e) => setDataSource(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        placeholder="e.g., Public medical databases"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      General Characteristics of Training Data *
                      <InfoTooltip content="Format, diversity, geographic scope, volume" />
                    </label>
                    <textarea
                      value={trainingDataCharacteristics}
                      onChange={(e) => setTrainingDataCharacteristics(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Describe data format, diversity, geographic coverage..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Training Sufficiency and Parameters
                      <InfoTooltip content="Validation/test splits and metrics used" />
                    </label>
                    <textarea
                      value={trainingSufficiency}
                      onChange={(e) => setTrainingSufficiency(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Detail train/validation/test splits and metrics..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Data Appropriateness and Soundness *
                      <InfoTooltip content="Data relevance and bias risk" />
                    </label>
                    <textarea
                      value={dataAppropriateness}
                      onChange={(e) => setDataAppropriateness(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Assess data quality, relevance, and potential bias..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Federated Learning & Quality Control
                      <InfoTooltip content="Bias control across federated nodes (if applicable)" />
                    </label>
                    <textarea
                      value={federatedLearning}
                      onChange={(e) => setFederatedLearning(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="If using federated learning, describe quality control..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Model Generalization
                      <InfoTooltip content="Performance limits across regions/populations" />
                    </label>
                    <textarea
                      value={modelGeneralization}
                      onChange={(e) => setModelGeneralization(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Discuss model performance across different contexts..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Data Privacy and Anonymization *
                      <InfoTooltip content="Anonymization/pseudonymization and compliance" />
                    </label>
                    <textarea
                      value={dataPrivacy}
                      onChange={(e) => setDataPrivacy(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Describe anonymization methods and privacy compliance..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Cybersecurity and Resilience
                      <InfoTooltip content="Security audits, adversarial defense, encryption" />
                    </label>
                    <textarea
                      value={cybersecurity}
                      onChange={(e) => setCybersecurity(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Detail security measures and audits..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Model Maintenance and Drift
                      <InfoTooltip content="Retraining or monitoring protocol" />
                    </label>
                    <textarea
                      value={modelMaintenance}
                      onChange={(e) => setModelMaintenance(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Describe monitoring and retraining schedule..."
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* SECTION IV */}
            <AccordionItem value="section-4" className="bg-white rounded-lg shadow-sm border">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center space-x-3 w-full">
                  <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <Scale className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-gray-900">⚖️ SECTION IV – ETHICS, FAIRNESS & SOCIAL IMPACT</h3>
                    <p className="text-xs text-amber-600 mt-1">"Diversity, Non-Discrimination & Fairness," "Societal & Environmental Well-being"</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Ethical Risk Identification *
                      <InfoTooltip content="Documented risks (bias, discrimination, harm)" />
                    </label>
                    <textarea
                      value={ethicalRisks}
                      onChange={(e) => setEthicalRisks(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Identify and document ethical risks..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Bias Monitoring and Fairness Controls *
                      <InfoTooltip content="Bias detection/mitigation methods and fairness metrics" />
                    </label>
                    <textarea
                      value={biasMonitoring}
                      onChange={(e) => setBiasMonitoring(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Describe bias detection methods and mitigation strategies..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Resource Dependency and Inequality
                      <InfoTooltip content="Does performance depend on resource-rich environments?" />
                    </label>
                    <textarea
                      value={resourceDependency}
                      onChange={(e) => setResourceDependency(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Assess if system performance varies based on resources..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Adverse Outcomes and Impact Analysis *
                      <InfoTooltip content="Observed/predicted social impacts" />
                    </label>
                    <textarea
                      value={adverseOutcomes}
                      onChange={(e) => setAdverseOutcomes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Document observed or predicted adverse outcomes..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Environmental Impact
                      <InfoTooltip content="Energy use, carbon footprint, sustainability" />
                    </label>
                    <textarea
                      value={environmentalImpact}
                      onChange={(e) => setEnvironmentalImpact(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Assess energy consumption and carbon footprint..."
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* SECTION V */}
            <AccordionItem value="section-5" className="bg-white rounded-lg shadow-sm border">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <div className="flex items-center space-x-3 w-full">
                  <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <FileText className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-gray-900">🧩 SECTION V – EXPLAINABILITY & ACCOUNTABILITY</h3>
                    <p className="text-xs text-indigo-600 mt-1">"Transparency & Accountability" principles</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Decision Explainability (XAI) *
                      <InfoTooltip content="Interpretability methods (SHAP, LIME, etc.)" />
                    </label>
                    <textarea
                      value={explainability}
                      onChange={(e) => setExplainability(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Describe XAI methods used (SHAP, LIME, etc.)..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Communicating Uncertainty
                      <InfoTooltip content="How is uncertainty or confidence communicated?" />
                    </label>
                    <textarea
                      value={uncertaintyCommunication}
                      onChange={(e) => setUncertaintyCommunication(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Explain how uncertainty is communicated to users..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Model Documentation & Transparency *
                      <InfoTooltip content="Model cards, datasheets, or documentation" />
                    </label>
                    <textarea
                      value={modelDocumentation}
                      onChange={(e) => setModelDocumentation(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Describe available documentation (model cards, etc.)..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Feedback & Improvement Mechanisms *
                      <InfoTooltip content="Process for collecting and integrating feedback" />
                    </label>
                    <textarea
                      value={feedbackMechanisms}
                      onChange={(e) => setFeedbackMechanisms(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Describe feedback collection and improvement processes..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Cost-Benefit Analysis
                      <InfoTooltip content="System cost vs. societal benefit" />
                    </label>
                    <textarea
                      value={costBenefit}
                      onChange={(e) => setCostBenefit(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Analyze costs vs. benefits..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Accountability & Redress *
                      <InfoTooltip content="Legal liability and redress mechanism" />
                    </label>
                    <textarea
                      value={accountability}
                      onChange={(e) => setAccountability(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Define accountability structure and redress mechanisms..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-2 text-gray-700 flex items-center">
                      Traceability & Logging *
                      <InfoTooltip content="Outputs and versions logged with timestamps" />
                    </label>
                    <textarea
                      value={traceability}
                      onChange={(e) => setTraceability(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      placeholder="Describe logging systems and audit trails..."
                      required
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Submit Note and Actions */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Once submitted, you cannot edit the use case. You will be able to view progress and feedback from experts.
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4 sticky bottom-0 bg-gray-50 py-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 rounded-lg border border-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Submit Use Case
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
