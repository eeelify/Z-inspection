import React, { useState } from 'react';
import { Plus, Filter, Bell, Folder, MessageSquare, Users, LogOut, Search, Download, MoreVertical, Calendar, Target } from 'lucide-react';
import { Project, User } from '../types';

interface AdminDashboardProps {
  currentUser: User;
  projects: Project[];
  users: User[];
  onViewProject: (project: Project) => void;
  onStartEvaluation: (project: Project) => void;
  onCreateProject: (project: Partial<Project>) => void;
  onNavigate: (view: string) => void;
  onLogout: () => void;
}

const statusColors = {
  ongoing: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  proven: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  disproven: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' }
};

const stageLabels = {
  'set-up': 'Set-up',
  assess: 'Assess', 
  resolve: 'Resolve'
};

export function AdminDashboard({
  currentUser,
  projects,
  users,
  onViewProject,
  onStartEvaluation,
  onCreateProject,
  onNavigate,
  onLogout
}: AdminDashboardProps) {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProjects = projects.filter(project => {
    const matchesFilter = activeFilter === 'all' || project.status === activeFilter;
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.shortDescription.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getAssignedUserNames = (userIds: string[]) => {
    return userIds.map(id => users.find(u => u.id === id)?.name).filter(Boolean).join(', ');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <h1 className="text-xl text-gray-900">Z-Inspection Platform</h1>
              <div className="hidden md:flex space-x-2">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    activeFilter === 'all' ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All Projects
                </button>

              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button className="relative p-2 text-gray-600 hover:text-gray-900">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                  3
                </span>
              </button>
              <div className="flex items-center space-x-2">
                <div className="text-sm">
                  <div className="text-gray-900">{currentUser.name}</div>
                  <div className="text-gray-500 capitalize">{currentUser.role}</div>
                </div>
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white text-sm">
                  {currentUser.name.charAt(0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Left Sidebar */}
        <div className="w-64 bg-white shadow-sm h-screen">
          <div className="p-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center mb-6"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Project
            </button>

            <nav className="space-y-2">
              <button
                onClick={() => onNavigate('dashboard')}
                className="w-full flex items-center px-3 py-2 text-gray-700 bg-blue-50 border-r-2 border-blue-500 hover:bg-gray-50"
              >
                <Folder className="h-4 w-4 mr-3" />
                Assigned Projects
              </button>
              <button
                onClick={() => onNavigate('shared-area')}
                className="w-full flex items-center px-3 py-2 text-gray-700 hover:bg-gray-50"
              >
                <MessageSquare className="h-4 w-4 mr-3" />
                Shared Area
              </button>
              <button
                onClick={() => onNavigate('other-members')}
                className="w-full flex items-center px-3 py-2 text-gray-700 hover:bg-gray-50"
              >
                <Users className="h-4 w-4 mr-3" />
                Other Members
              </button>
            </nav>
          </div>

          <div className="absolute bottom-0 left-0 w-64 p-6">
            <button
              onClick={onLogout}
              className="w-full flex items-center px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              <LogOut className="h-4 w-4 mr-3" />
              Logout
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h2 className="text-2xl mb-2 text-gray-900">Admin Dashboard</h2>
            <p className="text-gray-600">Manage projects, users, and evaluations across the platform</p>
          </div>

          {/* Projects Grid */}
          <div className="grid gap-6">
            {filteredProjects.map(project => (
              <div key={project.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="text-lg text-gray-900 mr-3">{project.title}</h3>
                        {project.isNew && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">NEW</span>
                        )}

                      </div>
                      <p className="text-gray-600 mb-3">{project.shortDescription}</p>
                      
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          Stage: {stageLabels[project.stage]}
                        </div>
                        <div className="flex items-center">
                          <Target className="h-4 w-4 mr-1" />
                          Due: {new Date(project.targetDate).toLocaleDateString()}
                        </div>
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          Assigned: {project.assignedUsers.length} users
                        </div>
                      </div>
                    </div>
                    <button className="p-1 text-gray-400 hover:text-gray-600">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{project.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Assigned Users */}
                  <div className="mb-4">
                    <span className="text-sm text-gray-600">Assigned to: </span>
                    <span className="text-sm text-gray-900">{getAssignedUserNames(project.assignedUsers)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => onViewProject(project)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                      >
                        View Details
                      </button>
                      {project.useCase && (
                        <button className="px-3 py-2 text-gray-600 hover:text-gray-800 text-sm flex items-center">
                          <Download className="h-3 w-3 mr-1" />
                          Use Case
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      Created {new Date(project.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredProjects.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📋</div>
              <h3 className="text-lg text-gray-900 mb-2">No projects found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm ? 'No projects match your search criteria.' : 'Create your first project to get started.'}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
                >
                  Create New Project
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          users={users}
          onClose={() => setShowCreateModal(false)}
          onSubmit={onCreateProject}
        />
      )}
    </div>
  );
}

interface CreateProjectModalProps {
  users: User[];
  onClose: () => void;
  onSubmit: (project: Partial<Project>) => void;
}

function CreateProjectModal({ users, onClose, onSubmit }: CreateProjectModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    shortDescription: '',
    fullDescription: '',
    targetDate: '',
    assignedUsers: [] as string[]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  const toggleUser = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedUsers: prev.assignedUsers.includes(userId)
        ? prev.assignedUsers.filter(id => id !== userId)
        : [...prev.assignedUsers, userId]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl text-gray-900">Create New Project</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm mb-2 text-gray-700">Project Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-700">Short Description *</label>
            <input
              type="text"
              value={formData.shortDescription}
              onChange={(e) => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-700">Full Description</label>
            <textarea
              value={formData.fullDescription}
              onChange={(e) => setFormData(prev => ({ ...prev, fullDescription: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-gray-700">Target Date</label>
            <input
              type="date"
              value={formData.targetDate}
              onChange={(e) => setFormData(prev => ({ ...prev, targetDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm mb-3 text-gray-700">Assign Users</label>
            <div className="space-y-2">
              {users.filter(u => u.role !== 'admin').map(user => (
                <label key={user.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.assignedUsers.includes(user.id)}
                    onChange={() => toggleUser(user.id)}
                    className="mr-3"
                  />
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white mr-2"
                         style={{ backgroundColor: user.role === 'legal' ? '#1E40AF' : user.role === 'technical' ? '#065F46' : '#9D174D' }}>
                      {user.name.charAt(0)}
                    </div>
                    <span className="text-sm">{user.name} ({user.role})</span>
                  </div>
                </label>
              ))}
            </div>
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
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}