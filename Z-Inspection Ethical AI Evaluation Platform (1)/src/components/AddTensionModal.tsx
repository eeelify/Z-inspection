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
  AlertTriangle
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
import { EthicalTensionSelector } from './EthicalTensionSelector'; // Bu dosyanın var olduğundan eminiz

// --- İÇ BİLEŞEN: AddTensionModal (Ayrı dosya derdini bitirdik) ---
interface AddTensionModalProps {
  onClose: () => void;
  onSave: (data: any) => void;
}

function AddTensionModal({ onClose, onSave }: AddTensionModalProps) {
  const [principle1, setPrinciple1] = useState<EthicalPrinciple | undefined>();
  const [principle2, setPrinciple2] = useState<EthicalPrinciple | undefined>();
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<number>(2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (principle1 && principle2 && description) {
      onSave({
        principle1,
        principle2,
        description,
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
            Add Ethical Tension
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

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">Description of Conflict</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Explain why these two principles are in conflict..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-3 text-gray-700 flex items-center justify-between">
              <span>Severity Level</span>
              <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                severity === 3 ? 'bg-red-100 text-red-800' : 
                severity === 2 ? 'bg-yellow-100 text-yellow-800' : 
                'bg-green-100 text-green-800'
              }`}>
                {severity === 1 ? 'Low' : severity === 2 ? 'Medium' : 'High'}
              </span>
            </label>
            <input
              type="range"
              min="1"
              max="3"
              step="1"
              value={severity}
              onChange={(e) => setSeverity(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">Cancel</button>
            <button type="submit" disabled={!principle1 || !principle2 || !description} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Save Tension</button>
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
  const [tensions, setTensions] = useState<Tension[]>([]); 

  // Veritabanından gerilimleri çek
  const fetchTensions = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/tensions/${project.id}`);
      if (response.ok) {
        const data = await response.json();
        // Veri formatını UI'ya uydur
        const formattedData = data.map((t: any) => ({
            ...t,
            id: t._id || t.id, // ID kontrolü
            claimStatement: t.description || t.claimStatement,
            status: t.status || 'ongoing',
            consensus: t.consensus || { agree: 0, disagree: 0 }
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

  // Yeni gerilim kaydetme
  const handleSaveTension = async (data: any) => {
    if (onCreateTension) {
      await onCreateTension(data);
      setShowAddTension(false);
      // Listeyi yenile
      setTimeout(fetchTensions, 500); 
    } else {
      console.error("onCreateTension function is missing in props!");
      alert("Hata: Kayıt fonksiyonu bulunamadı. Lütfen App.tsx dosyasını kontrol edin.");
    }
  };

  const canViewOwners = currentUser.role === 'admin' || currentUser.role === 'ethical-expert';
  const roleColor = roleColors[currentUser.role as keyof typeof roleColors] || '#1F2937';
  const isAssigned = project.assignedUsers.includes(currentUser.id);
  const isAdmin = currentUser.role === 'admin';
  const assignedUserDetails = users.filter((user) => project.assignedUsers.includes(user.id));

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
                {/* Değerlendirme içeriği buraya gelebilir */}
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    Select "Start Evaluation" to begin or resume your assessment.
                </div>
              </div>
            )}

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
                      const agreePercent = tension.consensus?.agree || 0;
                      return (
                        <div
                          key={tension.id}
                          className="border rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => onViewTension?.(tension)}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center mb-2">
                                <span className={`px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800`}>
                                  Severity: {tension.severity || 2}
                                </span>
                                <span className="ml-2 text-xs text-gray-500">
                                  {tension.createdAt ? new Date(tension.createdAt).toLocaleDateString() : 'Just now'}
                                </span>
                              </div>
                              <h4 className="text-base text-gray-900 mb-2 flex items-center">
                                {tension.claimStatement}
                              </h4>
                              <p className="text-sm text-gray-600 mb-3">
                                {tension.principle1} ↔ {tension.principle2}
                              </p>
                            </div>
                            <button className="p-1 text-gray-400 hover:text-gray-600">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
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