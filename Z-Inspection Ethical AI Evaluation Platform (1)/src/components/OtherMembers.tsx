import React, { useState } from 'react';
import { ArrowLeft, Search, Users, Calendar, Globe } from 'lucide-react';
import { User, Project } from '../types';
import { ContactUserModal } from './ContactUserModal';
import { roleColors, mockUserDetails } from '../utils/constants';
import { formatLastSeen, getUserProjects, formatRoleName } from '../utils/helpers';

interface OtherMembersProps {
  currentUser: User;
  users: User[];
  projects: Project[];
  onBack: () => void;
}

export function OtherMembers({ currentUser, users, projects, onBack }: OtherMembersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  const otherUsers = users.filter(user => user.id !== currentUser.id);

  const filteredUsers = otherUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const userDetails = mockUserDetails[user.id as keyof typeof mockUserDetails];
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'online' && userDetails?.isOnline) ||
                         (statusFilter === 'offline' && !userDetails?.isOnline);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleContactUser = (user: User) => {
    setSelectedUser(user);
    setShowContactModal(true);
  };

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
                <h1 className="text-xl text-gray-900 flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Team Members
                </h1>
                <p className="text-gray-600">Connect with other experts on the platform</p>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {filteredUsers.length} of {otherUsers.length} members
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="legal">Legal</option>
            <option value="technical">Technical</option>
            <option value="medical">Medical</option>
          </select>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      </div>

      {/* Members List */}
      <div className="px-6 py-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map(user => {
            const userDetails = mockUserDetails[user.id as keyof typeof mockUserDetails];
            const userProjects = getUserProjects(user.id, projects);
            const userColor = roleColors[user.role as keyof typeof roleColors];

            return (
              <div key={user.id} className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="relative">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: userColor }}
                    >
                      {user.name.charAt(0)}
                    </div>
                    <div
                      className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                        userDetails?.isOnline ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-lg text-gray-900">{user.name}</h3>
                    <p className="text-sm text-gray-600">{formatRoleName(user.role)}</p>
                    <div className="flex items-center text-xs text-gray-500 mt-1">
                      <Globe className="h-3 w-3 mr-1" />
                      {userDetails?.isOnline ? (
                        <span className="text-green-600">Online</span>
                      ) : (
                        <span>
                          Last seen {userDetails?.lastSeen ? formatLastSeen(userDetails.lastSeen) : 'unknown'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-gray-600 mb-2">Current Projects ({userProjects.length})</div>
                  <div className="space-y-1">
                    {userProjects.slice(0, 2).map(project => (
                      <div key={project.id} className="text-xs text-gray-800 bg-gray-50 px-2 py-1 rounded">
                        {project.title}
                      </div>
                    ))}
                    {userProjects.length > 2 && (
                      <div className="text-xs text-gray-500">
                        +{userProjects.length - 2} more
                      </div>
                    )}
                    {userProjects.length === 0 && (
                      <div className="text-xs text-gray-500">No active projects</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleContactUser(user)}
                    className="flex-1 px-3 py-2 text-white text-sm rounded-lg transition-colors hover:opacity-90"
                    style={{ backgroundColor: userColor }}
                  >
                    Contact
                  </button>
                  <button className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
                    Profile
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg text-gray-900 mb-2">No members found</h3>
            <p className="text-gray-600">
              {searchTerm 
                ? 'No members match your search criteria.'
                : 'There are no other members on the platform yet.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="bg-white border-t px-6 py-4 mt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl text-gray-900">{users.filter(u => u.role === 'admin').length}</div>
            <div className="text-sm text-gray-600">Admins</div>
          </div>
          <div>
            <div className="text-2xl text-gray-900">{users.filter(u => u.role === 'legal').length}</div>
            <div className="text-sm text-gray-600">Legal</div>
          </div>
          <div>
            <div className="text-2xl text-gray-900">{users.filter(u => u.role === 'technical').length}</div>
            <div className="text-sm text-gray-600">Technical</div>
          </div>
          <div>
            <div className="text-2xl text-gray-900">{users.filter(u => u.role === 'medical').length}</div>
            <div className="text-sm text-gray-600">Medical</div>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      {showContactModal && selectedUser && (
        <ContactUserModal
          user={selectedUser}
          onClose={() => {
            setShowContactModal(false);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
}