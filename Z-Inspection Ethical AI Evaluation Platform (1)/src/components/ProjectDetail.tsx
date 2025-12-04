import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Users as UsersIcon,
  Download,
  FileText,
  MessageSquare,
  Shield,
  Target,
  BarChart3,
  Plus,
  MoreVertical,
  User as UserIconLucide,
  GitBranch,
  X,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Upload,
  ChevronDown,
  ChevronUp,
  Send
} from 'lucide-react';
import {
  Project,
  User,
  Tension,
  UseCaseOwner,
  EthicalPrinciple
} from '../types';
import { UseCaseOwners } from './UseCaseOwners';
import { formatRoleName } from '../utils/helpers';
import { EthicalTensionSelector } from './EthicalTensionSelector';

// --- TİP TANIMLAMALARI ---
interface Comment {
  id: string;
  text: string;
  author: string;
  date: string;
}

interface ExpandedTension extends Tension {
  claimStatement?: string;
  description?: string;
  evidenceDescription?: string;
  evidenceFileName?: string;
  comments?: Comment[];
}

// --- İÇ BİLEŞEN: AddTensionModal ---
interface AddTensionModalProps {
  onClose: () => void;
  onSave: (data: any) => void;
}

function AddTensionModal({ onClose, onSave }: AddTensionModalProps) {
  const [principle1, setPrinciple1] = useState<EthicalPrinciple | undefined>();
  const [principle2, setPrinciple2] = useState<EthicalPrinciple | undefined>();
  
  const [claim, setClaim] = useState('');
  const [argument, setArgument] = useState('');
  const [evidence, setEvidence] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  
  const [severity, setSeverity] = useState<number>(2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (principle1 && principle2 && claim && argument) {
      onSave({
        principle1,
        principle2,
        claimStatement: claim, 
        description: argument,
        evidenceDescription: evidence,
        evidenceFileName: evidenceFile ? evidenceFile.name : undefined,
        severity
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
            Add Ethical Tension (CAE Framework)
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <EthicalTensionSelector
            principle1={principle1}
            principle2={principle2}
            onPrinciple1Change={setPrinciple1}
            onPrinciple2Change={setPrinciple2}
          />

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Claim *</label>
              <input
                type="text"
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="E.g., The system exhibits bias against specific demographic groups..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Argument *</label>
              <textarea
                value={argument}
                onChange={(e) => setArgument(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Detailed explanation of why this conflict exists..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Evidence (Optional)</label>
              <textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Supporting data, reports, or observations..."
              />
              
              <div className="mt-3">
                <div className="flex items-center space-x-3">
                  <label className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                    <Upload className="h-4 w-4 mr-2 text-gray-500" />
                    Upload File
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <span className="text-sm text-gray-500 italic">
                    {evidenceFile ? evidenceFile.name : 'No file attached'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-3 text-gray-700">Severity Level</label>
            <div className="grid grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setSeverity(1)}
                className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                  severity === 1 
                    ? 'border-green-500 bg-green-50 text-green-700' 
                    : 'border-gray-200 hover:border-green-200 text-gray-600'
                }`}
              >
                <div className={`w-4 h-4 rounded-full mb-1 ${severity === 1 ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="font-medium text-sm">Low</span>
              </button>

              <button
                type="button"
                onClick={() => setSeverity(2)}
                className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                  severity === 2 
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-800' 
                    : 'border-gray-200 hover:border-yellow-200 text-gray-600'
                }`}
              >
                <div className={`w-4 h-4 rounded-full mb-1 ${severity === 2 ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                <span className="font-medium text-sm">Medium</span>
              </button>

              <button
                type="button"
                onClick={() => setSeverity(3)}
                className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                  severity === 3 
                    ? 'border-red-500 bg-red-50 text-red-800' 
                    : 'border-gray-200 hover:border-red-200 text-gray-600'
                }`}
              >
                <div className={`w-4 h-4 rounded-full mb-1 ${severity === 3 ? 'bg-red-500' : 'bg-gray-300'}`} />
                <span className="font-medium text-sm">High</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">Cancel</button>
            <button type="submit" disabled={!principle1 || !principle2 || !claim || !argument} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Save Tension</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- ANA BİLEŞEN ---

interface ProjectDetailProps {
  project: Project;
  currentUser: User;
  users: User[];
  onBack: () => void;
  onStartEvaluation: () => void;
  onViewTension?: (tension: Tension) => void;
  onViewOwner?: (owner: UseCaseOwner) => void;
  onCreateTension?: (data: any) => void; 
}

const roleColors = {
  admin: '#1F2937',
  'ethical-expert': '#1E40AF',
  'medical-expert': '#9D174D',
  'use-case-owner': '#065F46',
  'education-expert': '#7C3AED',
  'technical-expert': '#0891B2',
  'legal-expert': '#B45309'
};

export function ProjectDetail({
  project,
  currentUser,
  users,
  onBack,
  onStartEvaluation,
  onViewTension,
  onViewOwner,
  onCreateTension
}: ProjectDetailProps) {
  const [activeTab, setActiveTab] = useState<'evaluation' | 'tensions' | 'usecase' | 'owners'>('evaluation');
  const [showAddTension, setShowAddTension] = useState(false);
  const [tensions, setTensions] = useState<ExpandedTension[]>([]); 
  const [expandedTensionId, setExpandedTensionId] = useState<string | null>(null);

  const fetchTensions = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/tensions/${project.id}`);
      if (response.ok) {
        const data = await response.json();
        // Backend'den gelen veriyi frontend formatına eşle
        const formattedData = data.map((t: any) => ({
            ...t,
            id: t._id || t.id,
            claimStatement: t.claimStatement || t.description || "No claim specified",
            description: t.description || t.claimStatement,
            principle1: t.principle1,
            principle2: t.principle2,
            status: t.status || 'ongoing',
            // Backend artık canlı consensus verisi gönderiyor
            consensus: t.consensus || { agree: 0, disagree: 0 },
            createdAt: t.createdAt,
            comments: t.comments || []
        }));
        setTensions(formattedData);
      }
    } catch (error) {
      console.error("Tensions load error:", error);
    }
  };

  useEffect(() => {
    fetchTensions();
  }, [project.id]);

  const handleSaveTension = async (data: any) => {
    if (onCreateTension) {
      await onCreateTension(data);
      setShowAddTension(false);
      setTimeout(fetchTensions, 500); 
    }
  };

  // --- OYLAMA (BACKEND BAĞLANTILI) ---
  const handleVote = async (tensionId: string, type: 'agree' | 'disagree') => {
    try {
        const response = await fetch(`http://127.0.0.1:5000/api/tensions/${tensionId}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, voteType: type })
        });

        if (response.ok) {
            const updatedData = await response.json();
            // Arayüzü güncelle (Veritabanından dönen yeni sayılarla)
            setTensions(currentTensions =>
                currentTensions.map(t => {
                    if (t.id === tensionId) {
                        return {
                            ...t,
                            consensus: updatedData.consensus
                        };
                    }
                    return t;
                })
            );
        }
    } catch (error) {
        console.error("Vote error:", error);
    }
  };

  // --- YORUM (BACKEND BAĞLANTILI) ---
  const handleAddComment = async (tensionId: string) => {
    const commentText = window.prompt("Enter your comment:");
    if (commentText) {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/tensions/${tensionId}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    text: commentText,
                    author: currentUser.name 
                })
            });

            if (response.ok) {
                const newComment = await response.json();
                setTensions(currentTensions =>
                    currentTensions.map(t => {
                        if (t.id === tensionId) {
                            return { ...t, comments: [...(t.comments || []), newComment] };
                        }
                        return t;
                    })
                );
                setExpandedTensionId(tensionId);
            }
        } catch (error) {
            console.error("Comment error:", error);
        }
    }
  };

  const toggleExpandTension = (tensionId: string) => {
    setExpandedTensionId(prev => prev === tensionId ? null : tensionId);
  };

  const canViewOwners = currentUser.role === 'admin' || currentUser.role === 'ethical-expert';
  const roleColor = roleColors[currentUser.role as keyof typeof roleColors] || '#1F2937';
  const isAssigned = project.assignedUsers.includes(currentUser.id);
  const isAdmin = currentUser.role === 'admin';
  const assignedUserDetails = users.filter((user) => project.assignedUsers.includes(user.id));

  const stages = [
    { key: 'set-up', label: 'Set-up', icon: '🚀' },
    { key: 'assess', label: 'Assess', icon: '🔍' },
    { key: 'resolve', label: 'Resolve', icon: '📊' }
  ] as const;

  const getCurrentStageIndex = () => stages.findIndex((stage) => stage.key === project.stage);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="flex items-center text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </button>
              <div>
                <div className="flex items-center">
                  <h1 className="text-xl text-gray-900 mr-3">{project.title}</h1>
                  {project.isNew && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      NEW
                    </span>
                  )}
                </div>
                <p className="text-gray-600">{project.shortDescription}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {isAssigned && (
                <button
                  onClick={onStartEvaluation}
                  className="px-4 py-2 text-white rounded-lg transition-colors hover:opacity-90"
                  style={{ backgroundColor: roleColor }}
                >
                  Start Evaluation
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        
        {/* Timeline */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg mb-4 text-gray-900">Z-Inspection Timeline</h2>
          <div className="relative">
            <div className="flex items-center justify-between">
              {stages.map((stage, index) => {
                const isActive = index <= getCurrentStageIndex();
                const isCurrent = stage.key === project.stage;

                return (
                  <div key={stage.key} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 ${
                        isActive
                          ? isCurrent
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-green-500 text-white border-green-500'
                          : 'bg-gray-100 text-gray-400 border-gray-200'
                      }`}
                    >
                      {stage.icon}
                    </div>
                    <span
                      className={`mt-2 text-sm ${isActive ? 'text-gray-900' : 'text-gray-500'}`}
                    >
                      {stage.label}
                    </span>
                    {index < stages.length - 1 && (
                      <div
                        className={`absolute top-6 h-0.5 ${
                          index < getCurrentStageIndex() ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                        style={{
                          left: `${
                            (index + 1) * (100 / stages.length) - 100 / stages.length / 2
                          }%`,
                          width: `${100 / stages.length}%`,
                          transform: 'translateX(-50%)'
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Project Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-gray-400 mr-2" />
              <div>
                <div className="text-xs text-gray-600">Target Date</div>
                <div className="text-sm text-gray-900">
                  {new Date(project.targetDate).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center">
              <UsersIcon className="h-5 w-5 text-gray-400 mr-2" />
              <div>
                <div className="text-xs text-gray-600">Team Size</div>
                <div className="text-sm text-gray-900">{assignedUserDetails.length} members</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center">
              <Target className="h-5 w-5 text-gray-400 mr-2" />
              <div>
                <div className="text-xs text-gray-600">Progress</div>
                <div className="text-sm text-gray-900">{project.progress}%</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center">
              <BarChart3 className="h-5 w-5 text-gray-400 mr-2" />
              <div>
                <div className="text-xs text-gray-600">Tensions</div>
                <div className="text-sm text-gray-900">{tensions.length} total</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('evaluation')}
                className={`px-6 py-3 text-sm transition-colors ${
                  activeTab === 'evaluation'
                    ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Shield className="h-4 w-4 inline mr-2" />
                Evaluation
              </button>
              <button
                onClick={() => setActiveTab('tensions')}
                className={`px-6 py-3 text-sm transition-colors ${
                  activeTab === 'tensions'
                    ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <MessageSquare className="h-4 w-4 inline mr-2" />
                Tensions ({tensions.length})
              </button>
              <button
                onClick={() => setActiveTab('usecase')}
                className={`px-6 py-3 text-sm transition-colors ${
                  activeTab === 'usecase'
                    ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText className="h-4 w-4 inline mr-2" />
                Use Case
              </button>
              {canViewOwners && (
                <button
                  onClick={() => setActiveTab('owners')}
                  className={`px-6 py-3 text-sm transition-colors ${
                    activeTab === 'owners'
                      ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <UserIconLucide className="h-4 w-4 inline mr-2" />
                  Use Case Owners
                </button>
              )}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'evaluation' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg text-gray-900">Evaluation Status</h3>
                  {isAssigned && (
                    <button
                      onClick={onStartEvaluation}
                      className="px-4 py-2 text-white rounded-lg transition-colors hover:opacity-90"
                      style={{ backgroundColor: roleColor }}
                    >
                      Start My Evaluation
                    </button>
                  )}
                </div>
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    Select "Start Evaluation" above to begin or resume your assessment.
                </div>
              </div>
            )}

            {/* --- TENSIONS TAB --- */}
            {activeTab === 'tensions' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg text-gray-900">Tensions Management</h3>
                  <button
                    onClick={() => setShowAddTension(true)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tension
                  </button>
                </div>

                {tensions.length > 0 ? (
                  <div className="space-y-4">
                    {tensions.map((tension) => {
                      const agreeCount = tension.consensus?.agree || 0;
                      const disagreeCount = tension.consensus?.disagree || 0;
                      const totalVotes = agreeCount + disagreeCount;
                      const agreePercent = totalVotes > 0 ? Math.round((agreeCount / totalVotes) * 100) : 0;
                      const isExpanded = expandedTensionId === tension.id;

                      const severityColor = tension.severity === 3 ? 'bg-red-100 text-red-800' :
                                            tension.severity === 2 ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-green-100 text-green-800';
                      const severityLabel = tension.severity === 3 ? 'High' :
                                            tension.severity === 2 ? 'Medium' : 'Low';

                      return (
                        <div
                          key={tension.id}
                          className={`border rounded-lg transition-all ${isExpanded ? 'ring-2 ring-blue-100 shadow-md' : 'hover:shadow-sm'}`}
                        >
                          {/* Card Header (Click to expand) */}
                          <div 
                            className="p-6 cursor-pointer"
                            onClick={() => toggleExpandTension(tension.id)}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <div className="flex items-center mb-2">
                                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${severityColor}`}>
                                    Risk: {severityLabel}
                                  </span>
                                  <span className="ml-2 text-xs text-gray-500">
                                    {tension.createdAt ? new Date(tension.createdAt).toLocaleDateString() : 'Just now'}
                                  </span>
                                </div>
                                <h4 className="text-base text-gray-900 mb-2 font-semibold">
                                  {tension.claimStatement}
                                </h4>
                                {tension.description && (
                                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                    {tension.description}
                                  </p>
                                )}
                                <p className="text-xs text-blue-600 font-medium">
                                  {tension.principle1} ↔ {tension.principle2}
                                </p>

                                {/* Consensus Indicator */}
                                <div className="flex items-center space-x-4 mt-3">
                                  <div className="text-xs text-gray-600">Consensus:</div>
                                  <div className="flex items-center">
                                    <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                                      <div
                                        className="bg-green-500 h-2 rounded-full transition-all"
                                        style={{ width: `${agreePercent}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-600">
                                      {agreePercent}% agree ({agreeCount}/{totalVotes})
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button className="p-1 text-gray-400 hover:text-gray-600">
                                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                              </button>
                            </div>

                            <div className="flex items-center space-x-2">
                              <button
                                className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full hover:bg-green-200 border border-green-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVote(tension.id, 'agree');
                                }}
                              >
                                Agree ({agreeCount})
                              </button>
                              <button
                                className="px-3 py-1 text-xs bg-red-100 text-red-800 rounded-full hover:bg-red-200 border border-red-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVote(tension.id, 'disagree');
                                }}
                              >
                                Disagree ({disagreeCount})
                              </button>
                              <button
                                className="px-3 py-1 text-xs bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200 border border-gray-200 flex items-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddComment(tension.id);
                                }}
                              >
                                <MessageSquare className="h-3 w-3 mr-1" />
                                Comment ({tension.comments?.length || 0})
                              </button>
                            </div>
                          </div>

                          {/* Expanded Content (Comments & Evidence) */}
                          {isExpanded && (
                            <div className="px-6 pb-6 pt-2 border-t border-gray-100 bg-gray-50/50">
                              
                              {/* Evidence Section */}
                              {tension.evidenceDescription && (
                                <div className="mb-4">
                                  <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Evidence</h5>
                                  <div className="bg-white p-3 rounded border border-gray-200 text-sm text-gray-700">
                                    {tension.evidenceDescription}
                                    {tension.evidenceFileName && (
                                      <div className="mt-2 flex items-center text-blue-600 text-xs">
                                        <FileText className="h-3 w-3 mr-1" />
                                        {tension.evidenceFileName}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Comments Section */}
                              <div>
                                <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                  Comments ({tension.comments?.length || 0})
                                </h5>
                                {tension.comments && tension.comments.length > 0 ? (
                                  <div className="space-y-3">
                                    {tension.comments.map((comment) => (
                                      <div key={comment.id} className="bg-white p-3 rounded border border-gray-200">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-xs font-bold text-gray-900">{comment.author}</span>
                                          <span className="text-[10px] text-gray-400">
                                            {new Date(comment.date).toLocaleDateString()}
                                          </span>
                                        </div>
                                        <p className="text-sm text-gray-600">{comment.text}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400 italic">No comments yet.</p>
                                )}
                                
                                <button 
                                  onClick={() => handleAddComment(tension.id)}
                                  className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add a comment
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <GitBranch className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No tensions identified yet.</p>
                    <button 
                      onClick={() => setShowAddTension(true)}
                      className="text-blue-600 text-sm font-medium hover:underline"
                    >
                      Create first tension
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'usecase' && (
              <div>
                <h3 className="text-lg mb-4 text-gray-900">Use Case Documentation</h3>
                <div className="text-center py-8 text-gray-500 border rounded-lg">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p>Use Case ID: {project.useCase || 'Not Linked'}</p>
                </div>
              </div>
            )}

            {activeTab === 'owners' && canViewOwners && onViewOwner && (
              <UseCaseOwners currentUser={currentUser} projects={[project]} onViewOwner={onViewOwner} />
            )}
          </div>
        </div>
      </div>

      {/* --- ADD TENSION MODAL --- */}
      {showAddTension && (
        <AddTensionModal 
          onClose={() => setShowAddTension(false)} 
          onSave={handleSaveTension} 
        />
      )}
    </div>
  );
}
```

### **2. Adım: Backend (`server.js`) Dosyasını Güncelle**

Backend tarafında, oyların "kimin" kullandığını takip etmemiz lazım. Böylece bir kişi ikinci kez oy verdiğinde eski oyu güncellenir. Ayrıca yorumları da veritabanına kaydedelim.

Aşağıdaki kodu **`backend/server.js`** dosyasına yapıştırarak eski kodun üzerine yaz.

```javascript
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Veritabanı Bağlantısı
const MONGO_URI = 'mongodb://localhost:27017/zinspection';
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Bağlantısı Başarılı'))
  .catch(err => console.error('❌ MongoDB Bağlantı Hatası:', err));

// --- ŞEMALAR ---

// Kullanıcı Şeması
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// Proje Şeması
const ProjectSchema = new mongoose.Schema({
  title: String,
  shortDescription: String,
  fullDescription: String,
  status: { type: String, default: 'ongoing' },
  stage: { type: String, default: 'set-up' },
  targetDate: String,
  progress: { type: Number, default: 0 },
  assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  useCase: { type: String }, 
  createdAt: { type: Date, default: Date.now }
});
const Project = mongoose.model('Project', ProjectSchema);

// Use Case Şeması
const UseCaseSchema = new mongoose.Schema({
  title: String,
  description: String,
  aiSystemCategory: String,
  status: { type: String, default: 'assigned' },
  progress: { type: Number, default: 0 },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedExperts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  adminNotes: String,
  supportingFiles: [String],
  createdAt: { type: Date, default: Date.now }
});
const UseCase = mongoose.model('UseCase', UseCaseSchema);

// Tension (Gerilim) Şeması (GÜNCELLENDİ)
const TensionSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  principle1: String,
  principle2: String,
  claimStatement: String, // İddia
  description: String,    // Argüman
  evidenceDescription: String, // Kanıt metni
  evidenceFileName: String, // Kanıt dosya adı
  severity: Number,
  createdAt: { type: Date, default: Date.now },
  
  // OYLAMA SİSTEMİ (YENİ)
  votes: [{
    userId: String,
    voteType: { type: String, enum: ['agree', 'disagree'] }
  }],
  
  // YORUMLAR SİSTEMİ (YENİ)
  comments: [{
    id: String,
    text: String,
    author: String,
    date: { type: Date, default: Date.now }
  }]
});
const Tension = mongoose.model('Tension', TensionSchema);

// Değerlendirme Formu Şeması
const EvaluationSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  role: String,
  stage: String,
  answers: { type: Map, of: mongoose.Schema.Types.Mixed },
  riskLevel: String,
  isDraft: Boolean,
  updatedAt: { type: Date, default: Date.now }
});
const Evaluation = mongoose.model('Evaluation', EvaluationSchema);

// --- ROUTES ---

// 1. OYLAMA ROUTE'U (YENİ)
app.post('/api/tensions/:id/vote', async (req, res) => {
  try {
    const { userId, voteType } = req.body;
    const tension = await Tension.findById(req.params.id);
    if (!tension) return res.status(404).send('Tension not found');

    // votes dizisi yoksa oluştur
    if (!tension.votes) tension.votes = [];

    // Kullanıcı daha önce oy vermiş mi kontrol et
    const existingVoteIndex = tension.votes.findIndex(v => v.userId === userId);

    if (existingVoteIndex > -1) {
      // Varsa güncelle
      tension.votes[existingVoteIndex].voteType = voteType;
    } else {
      // Yoksa yeni ekle
      tension.votes.push({ userId, voteType });
    }

    await tension.save();

    // Güncel sayıları hesapla
    const agreeCount = tension.votes.filter(v => v.voteType === 'agree').length;
    const disagreeCount = tension.votes.filter(v => v.voteType === 'disagree').length;

    res.json({ consensus: { agree: agreeCount, disagree: disagreeCount } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. YORUM EKLEME ROUTE'U (YENİ)
app.post('/api/tensions/:id/comment', async (req, res) => {
  try {
    const { text, author } = req.body;
    const tension = await Tension.findById(req.params.id);
    if (!tension) return res.status(404).send('Not found');

    const newComment = {
      id: Date.now().toString(),
      text,
      author,
      date: new Date()
    };

    if (!tension.comments) tension.comments = [];
    tension.comments.push(newComment);
    
    await tension.save();
    res.json(newComment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. TENSION GETİRME (GÜNCELLENDİ - Oyları Hesaplayıp Dönüyor)
app.get('/api/tensions/:projectId', async (req, res) => {
  try {
    const tensions = await Tension.find({ projectId: req.params.projectId });
    
    // Her gerilim için oy sayılarını hesaplayıp frontend formatına çevir
    const formattedTensions = tensions.map(t => {
        const agreeCount = t.votes ? t.votes.filter(v => v.voteType === 'agree').length : 0;
        const disagreeCount = t.votes ? t.votes.filter(v => v.voteType === 'disagree').length : 0;
        
        return {
            ...t.toObject(),
            consensus: { agree: agreeCount, disagree: disagreeCount }
        };
    });
    
    res.json(formattedTensions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Diğer Standart Route'lar (Login, Project, UseCase vs.) ---
app.post('/api/register', async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.json(newUser);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password, role: req.body.role });
    if (user) res.json(user);
    else res.status(401).json({ message: "Invalid credentials" });
});

app.get('/api/projects', async (req, res) => {
    const projects = await Project.find();
    res.json(projects);
});

app.post('/api/projects', async (req, res) => {
    const project = new Project(req.body);
    await project.save();
    res.json(project);
});

app.get('/api/users', async (req, res) => {
    const users = await User.find({}, '-password');
    res.json(users);
});

app.get('/api/use-cases', async (req, res) => {
    const useCases = await UseCase.find();
    res.json(useCases);
});

app.post('/api/use-cases', async (req, res) => {
    const useCase = new UseCase(req.body);
    await useCase.save();
    res.json(useCase);
});

app.post('/api/tensions', async (req, res) => {
    const tension = new Tension(req.body);
    await tension.save();
    res.json(tension);
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));