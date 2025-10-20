import React, { useState } from 'react';
import { Bell, Folder, MessageSquare, Users, LogOut, Search, Download, Calendar, Target } from 'lucide-react';
import { Project, User } from '../types';
import { formatRoleName } from '../utils/helpers';

interface UserDashboardProps {
  currentUser: User;
  projects: Project[];
  users: User[];
  onViewProject: (project: Project) => void;
  onStartEvaluation: (project: Project) => void;
  onNavigate: (view: string) => void;
  onLogout: () => void;
}

const roleColors = {
  admin: '#1F2937',
  legal: '#1E40AF', 
  technical: '#065F46',
  medical: '#9D174D'
};

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

export function UserDashboard({
  currentUser,
  projects,
  users,
  onViewProject,
  onStartEvaluation,
  onNavigate,
  onLogout
}: UserDashboardProps) {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTab, setCurrentTab] = useState<'assigned' | 'commented'>('assigned');

  const roleColor = roleColors[currentUser.role as keyof typeof roleColors];

  // Filter projects based on user assignments and comments
  const assignedProjects = projects.filter(project => 
    project.assignedUsers.includes(currentUser.id)
  );

  // Mock commented projects (projects where user has participated but isn't assigned)
  const commentedProjects = projects.filter(project => 
    !project.assignedUsers.includes(currentUser.id) && 
    Math.random() > 0.5 // Mock condition for demonstration
  ).slice(0, 2);

  const currentProjects = currentTab === 'assigned' ? assignedProjects : commentedProjects;

  const filteredProjects = currentProjects.filter(project => {
    const matchesFilter = activeFilter === 'all' || project.status === activeFilter;
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.shortDescription.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const canStartEvaluation = (project: Project) => {
    return project.assignedUsers.includes(currentUser.id) && 
           (project.stage === 'assess' || project.stage === 'set-up');
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
                  2
                </span>
              </button>
              <div className="flex items-center space-x-2">
                <div className="text-sm">
                  <div className="text-gray-900">{currentUser.name}</div>
                  <div className="text-gray-500">{formatRoleName(currentUser.role)}</div>
                </div>
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
                  style={{ backgroundColor: roleColor }}
                >
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
            <div className="mb-6">
              <div className="text-sm text-gray-600 mb-2">Welcome back,</div>
              <div className="text-lg text-gray-900">{currentUser.name}</div>
              <div 
                className="text-sm capitalize px-2 py-1 rounded text-white inline-block mt-1"
                style={{ backgroundColor: roleColor }}
              >
                {currentUser.role} Expert
              </div>
            </div>

            <nav className="space-y-2">
              <button
                onClick={() => onNavigate('dashboard')}
                className="w-full flex items-center px-3 py-2 text-gray-700 bg-blue-50 border-r-2 border-blue-500 hover:bg-gray-50"
              >
                <Folder className="h-4 w-4 mr-3" />
                My Projects
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
            <h2 className="text-2xl mb-2 text-gray-900">
              {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)} Dashboard
            </h2>
            <p className="text-gray-600">
              Review and evaluate AI systems from a {currentUser.role} perspective
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setCurrentTab('assigned')}
                  className={`py-2 px-1 border-b-2 text-sm transition-colors ${
                    currentTab === 'assigned'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  📂 Assigned Projects ({assignedProjects.length})
                </button>
                <button
                  onClick={() => setCurrentTab('commented')}
                  className={`py-2 px-1 border-b-2 text-sm transition-colors ${
                    currentTab === 'commented'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  💬 Commented Projects ({commentedProjects.length})
                </button>
              </nav>
            </div>
          </div>

          {/* Projects List */}
          <div className="space-y-4">
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
                          Team: {project.assignedUsers.length} members
                        </div>
                      </div>
                    </div>

                    {/* Role-specific badge */}
                    <div className="ml-4">
                      {project.assignedUsers.includes(currentUser.id) ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                          Assigned
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                          Observer
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar (only for assigned projects) */}
                  {project.assignedUsers.includes(currentUser.id) && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Your Progress</span>
                        <span>{project.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ 
                            width: `${project.progress}%`,
                            backgroundColor: roleColor
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Next Steps */}
                  <div className="mb-4">
                    <span className="text-sm text-gray-600">Next Steps: </span>
                    <span className="text-sm text-gray-900">
                      {canStartEvaluation(project) 
                        ? 'Complete evaluation form' 
                        : project.assignedUsers.includes(currentUser.id)
                          ? 'Review submitted evaluations'
                          : 'Provide feedback in discussions'
                      }
                    </span>
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
                      {canStartEvaluation(project) && (
                        <button
                          onClick={() => onStartEvaluation(project)}
                          className="px-4 py-2 text-white rounded-lg text-sm transition-colors hover:opacity-90"
                          style={{ backgroundColor: roleColor }}
                        >
                          Start Evaluation
                        </button>
                      )}
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
              <div className="text-gray-400 text-6xl mb-4">
                {currentTab === 'assigned' ? '📋' : '💬'}
              </div>
              <h3 className="text-lg text-gray-900 mb-2">
                No {currentTab} projects found
              </h3>
              <p className="text-gray-600">
                {searchTerm 
                  ? 'No projects match your search criteria.' 
                  : currentTab === 'assigned' 
                    ? 'You have not been assigned to any projects yet.'
                    : 'You have not commented on any projects yet.'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}