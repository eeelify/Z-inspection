import React, { useState } from 'react';
import { Plus, User as UserIcon, Briefcase, FileText, Target } from 'lucide-react';
import { UseCaseOwner, User, Project } from '../types';
import { mockUseCaseOwners } from '../utils/mockData';

interface UseCaseOwnersProps {
  currentUser: User;
  projects: Project[];
  onViewOwner: (owner: UseCaseOwner) => void;
}

export function UseCaseOwners({ currentUser, projects, onViewOwner }: UseCaseOwnersProps) {
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [owners, setOwners] = useState<UseCaseOwner[]>(mockUseCaseOwners);

  const getProjectTitle = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.title || 'Unknown Project';
  };

  const handleAddOwner = (newOwner: Omit<UseCaseOwner, 'id'>) => {
    const owner: UseCaseOwner = {
      ...newOwner,
      id: `owner${Date.now()}`
    };
    setOwners([...owners, owner]);
    setShowAddOwner(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl text-gray-900">Use Case Owners</h3>
          <p className="text-gray-600 mt-1">Manage stakeholders and their responsibilities</p>
        </div>
        {currentUser.role === 'admin' && (
          <button
            onClick={() => setShowAddOwner(true)}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Owner
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {owners.map(owner => (
          <div
            key={owner.id}
            onClick={() => onViewOwner(owner)}
            className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white mr-3">
                <span className="text-lg">{owner.name.charAt(0)}</span>
              </div>
              <div className="flex-1">
                <h4 className="text-gray-900 mb-1">{owner.name}</h4>
                <p className="text-sm text-gray-600">{owner.email}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start">
                <Briefcase className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">Expertise Area</div>
                  <div className="text-sm text-gray-900">{owner.expertiseArea}</div>
                </div>
              </div>

              <div className="flex items-start">
                <FileText className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">Associated Use Case</div>
                  <div className="text-sm text-gray-900">{owner.associatedUseCase}</div>
                </div>
              </div>

              <div className="flex items-start">
                <Target className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs text-gray-500 mb-1">Responsibilities</div>
                  <div className="text-sm text-gray-700 line-clamp-2">{owner.responsibilities}</div>
                </div>
              </div>

              <div className="pt-3 border-t">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Assigned Tensions</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                    {owner.assignedTensions.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {owners.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <UserIcon className="h-16 w-16 text-gray-300 mx-auto mb-3" />
          <p className="mb-2">No use case owners yet</p>
          <p className="text-sm">Add stakeholders to manage their responsibilities</p>
        </div>
      )}

      {showAddOwner && (
        <AddOwnerModal
          projects={projects}
          onClose={() => setShowAddOwner(false)}
          onAdd={handleAddOwner}
        />
      )}
    </div>
  );
}

interface AddOwnerModalProps {
  projects: Project[];
  onClose: () => void;
  onAdd: (owner: Omit<UseCaseOwner, 'id'>) => void;
}

function AddOwnerModal({ projects, onClose, onAdd }: AddOwnerModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [expertiseArea, setExpertiseArea] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [responsibilities, setResponsibilities] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedProject = projects.find(p => p.id === projectId);
    const owner = {
      name,
      email,
      expertiseArea,
      projectId,
      associatedUseCase: selectedProject?.title || '',
      responsibilities,
      assignedTensions: []
    };
    
    onAdd(owner);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl text-gray-900">Add Use Case Owner</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm mb-2 text-gray-700">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter full name..."
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-700">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter email address..."
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-700">Expertise Area *</label>
            <input
              type="text"
              value={expertiseArea}
              onChange={(e) => setExpertiseArea(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Medical Imaging, Financial Compliance..."
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-700">Associated Project *</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-700">Responsibilities *</label>
            <textarea
              value={responsibilities}
              onChange={(e) => setResponsibilities(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe key responsibilities..."
              required
            />
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
              className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
            >
              Add Owner
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
