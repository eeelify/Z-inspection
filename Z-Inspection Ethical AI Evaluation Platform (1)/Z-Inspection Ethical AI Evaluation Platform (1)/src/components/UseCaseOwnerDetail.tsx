import React from 'react';
import { ArrowLeft, Mail, Briefcase, FileText, Target, CheckCircle } from 'lucide-react';
import { UseCaseOwner, User, Tension, Evidence } from '../types';
import { mockTensions, mockEvidences } from '../utils/mockData';

interface UseCaseOwnerDetailProps {
  owner: UseCaseOwner;
  currentUser: User;
  users: User[];
  onBack: () => void;
  onViewTension?: (tension: Tension) => void;
}

const statusColors = {
  ongoing: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  proven: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  disproven: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' }
};

export function UseCaseOwnerDetail({ owner, currentUser, users, onBack, onViewTension }: UseCaseOwnerDetailProps) {
  const assignedTensions = mockTensions.filter(tension => owner.assignedTensions.includes(tension.id));
  
  const getEvidencesForTension = (tensionId: string) => {
    return mockEvidences.filter(ev => ev.tensionId === tensionId);
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
              Back
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-5xl mx-auto">
        {/* Owner Profile */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-start">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white mr-4">
              <span className="text-3xl">{owner.name.charAt(0)}</span>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl text-gray-900 mb-2">{owner.name}</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="flex items-start">
                  <Mail className="h-5 w-5 text-gray-400 mr-2 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Email</div>
                    <div className="text-sm text-gray-900">{owner.email}</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <Briefcase className="h-5 w-5 text-gray-400 mr-2 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Expertise Area</div>
                    <div className="text-sm text-gray-900">{owner.expertiseArea}</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <FileText className="h-5 w-5 text-gray-400 mr-2 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Associated Use Case</div>
                    <div className="text-sm text-gray-900">{owner.associatedUseCase}</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <Target className="h-5 w-5 text-gray-400 mr-2 mt-0.5" />
                  <div>
                    <div className="text-xs text-gray-500">Assigned Tensions</div>
                    <div className="text-sm text-gray-900">{owner.assignedTensions.length} tensions</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t">
            <div className="text-sm text-gray-600 mb-2">Responsibilities</div>
            <p className="text-gray-900">{owner.responsibilities}</p>
          </div>
        </div>

        {/* Assigned Tensions */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl text-gray-900 mb-6">Assigned Tensions & Evidence</h2>

          {assignedTensions.length > 0 ? (
            <div className="space-y-6">
              {assignedTensions.map(tension => {
                const evidences = getEvidencesForTension(tension.id);
                const creator = users.find(u => u.id === tension.createdBy);
                
                return (
                  <div key={tension.id} className="border rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${statusColors[tension.status].bg} ${statusColors[tension.status].text} mr-2`}
                          >
                            {tension.status.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">
                            Created by {creator?.name} on {new Date(tension.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="text-gray-900 mb-2">{tension.claimStatement}</h3>
                        <p className="text-sm text-gray-600 mb-3">{tension.supportingArgument}</p>
                        
                        {/* Consensus */}
                        <div className="flex items-center space-x-4 mb-4">
                          <div className="text-xs text-gray-600">Consensus:</div>
                          <div className="flex items-center flex-1">
                            <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                              <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${tension.consensus.agree}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">{tension.consensus.agree}% agree</span>
                          </div>
                        </div>

                        {/* Related Evidence */}
                        {evidences.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <div className="flex items-center mb-3">
                              <FileText className="h-4 w-4 text-gray-400 mr-2" />
                              <span className="text-sm text-gray-600">Related Evidence ({evidences.length})</span>
                            </div>
                            <div className="space-y-2">
                              {evidences.map(evidence => {
                                const uploader = users.find(u => u.id === evidence.uploadedBy);
                                return (
                                  <div key={evidence.id} className="bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="text-sm text-gray-900 mb-1">{evidence.title}</div>
                                        <div className="text-xs text-gray-600 mb-2">{evidence.description}</div>
                                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                                          <span>Uploaded by {uploader?.name}</span>
                                          <span>{new Date(evidence.uploadedAt).toLocaleDateString()}</span>
                                          {evidence.documentName && (
                                            <span className="flex items-center">
                                              <FileText className="h-3 w-3 mr-1" />
                                              {evidence.documentName}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {onViewTension && (
                      <button
                        onClick={() => onViewTension(tension)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        View Full Tension Details →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="h-16 w-16 text-gray-300 mx-auto mb-3" />
              <p className="mb-2">No tensions assigned yet</p>
              <p className="text-sm">Tensions will appear here when assigned to this owner</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
