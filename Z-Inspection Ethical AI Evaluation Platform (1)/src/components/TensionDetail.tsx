import React, { useState } from 'react';
import { ArrowLeft, Download, Trash2, Plus, FileText, Calendar, User as UserIcon } from 'lucide-react';
import { Tension, User, Evidence } from '../types';
import { mockEvidences } from '../utils/mockData';

interface TensionDetailProps {
  tension: Tension;
  currentUser: User;
  users: User[];
  onBack: () => void;
}

const statusColors = {
  ongoing: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  proven: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  disproven: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' }
};

export function TensionDetail({ tension, currentUser, users, onBack }: TensionDetailProps) {
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [evidences, setEvidences] = useState<Evidence[]>(
    mockEvidences.filter(ev => ev.tensionId === tension.id)
  );

  const creator = users.find(u => u.id === tension.createdBy);

  const handleDeleteEvidence = (evidenceId: string) => {
    if (confirm('Are you sure you want to delete this evidence?')) {
      setEvidences(evidences.filter(ev => ev.id !== evidenceId));
    }
  };

  const handleAddEvidence = (newEvidence: Omit<Evidence, 'id' | 'tensionId' | 'uploadedBy' | 'uploadedAt'>) => {
    const evidence: Evidence = {
      ...newEvidence,
      id: `ev${Date.now()}`,
      tensionId: tension.id,
      uploadedBy: currentUser.id,
      uploadedAt: new Date().toISOString().split('T')[0]
    };
    setEvidences([...evidences, evidence]);
    setShowAddEvidence(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Tensions
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-5xl mx-auto">
        {/* Tension Details */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center mb-3">
                <span
                  className={`px-2 py-1 text-xs rounded-full ${statusColors[tension.status].bg} ${statusColors[tension.status].text} mr-2`}
                >
                  {tension.status.toUpperCase()}
                </span>
                <span className="text-xs text-gray-500">
                  Created by {creator?.name} on {new Date(tension.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h1 className="text-2xl text-gray-900 mb-3">{tension.claimStatement}</h1>
              
              {tension.tensionDescription && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <div className="text-sm text-amber-900 mb-1">Tension Description:</div>
                  <p className="text-gray-900">{tension.tensionDescription}</p>
                  {tension.principle1 && tension.principle2 && (
                    <div className="mt-2 text-sm text-amber-800">
                      <strong>{tension.principle1}</strong> ↔ <strong>{tension.principle2}</strong>
                    </div>
                  )}
                </div>
              )}
              
              {tension.supportingArgument && (
                <div className="bg-gray-50 border rounded-lg p-4 mb-4">
                  <div className="text-sm text-gray-600 mb-1">Supporting Argument:</div>
                  <p className="text-gray-900">{tension.supportingArgument}</p>
                </div>
              )}
              
              {/* Consensus Indicator */}
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600">Consensus:</div>
                <div className="flex items-center flex-1">
                  <div className="w-full max-w-xs bg-gray-200 rounded-full h-3 mr-3">
                    <div
                      className="bg-green-500 h-3 rounded-full"
                      style={{ width: `${tension.consensus.agree}%` }}
                    />
                  </div>
                  <div className="flex space-x-4 text-sm">
                    <span className="text-green-600">{tension.consensus.agree}% agree</span>
                    <span className="text-red-600">{tension.consensus.disagree}% disagree</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Evidence Library Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl text-gray-900">Evidence Library</h2>
            <button
              onClick={() => setShowAddEvidence(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Evidence
            </button>
          </div>

          {evidences.length > 0 ? (
            <div className="space-y-4">
              {evidences.map(evidence => {
                const uploader = users.find(u => u.id === evidence.uploadedBy);
                return (
                  <div key={evidence.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <FileText className="h-5 w-5 text-blue-500 mr-2" />
                          <h3 className="text-gray-900">{evidence.title}</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{evidence.description}</p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center">
                            <UserIcon className="h-3 w-3 mr-1" />
                            {uploader?.name}
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(evidence.uploadedAt).toLocaleDateString()}
                          </div>
                          {evidence.documentName && (
                            <div className="flex items-center">
                              <FileText className="h-3 w-3 mr-1" />
                              {evidence.documentName}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex space-x-2 ml-4">
                        {evidence.documentUrl && (
                          <button className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteEvidence(evidence.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-3" />
              <p className="mb-2">No evidence added yet</p>
              <p className="text-sm">Add supporting documents and reports to strengthen this tension</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Evidence Modal */}
      {showAddEvidence && (
        <AddEvidenceModal
          onClose={() => setShowAddEvidence(false)}
          onAdd={handleAddEvidence}
        />
      )}
    </div>
  );
}

interface AddEvidenceModalProps {
  onClose: () => void;
  onAdd: (evidence: Omit<Evidence, 'id' | 'tensionId' | 'uploadedBy' | 'uploadedAt'>) => void;
}

function AddEvidenceModal({ onClose, onAdd }: AddEvidenceModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const evidence = {
      title,
      description,
      documentName: file?.name,
      documentUrl: file ? '#' : undefined
    };
    
    onAdd(evidence);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl text-gray-900">Add Evidence</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm mb-2 text-gray-700">Evidence Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter evidence title..."
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-700">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the evidence and how it supports the tension..."
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-700">Upload Document</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
            />
            <p className="text-xs text-gray-500 mt-1">Accepted formats: PDF, DOC, DOCX, XLS, XLSX, CSV</p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
