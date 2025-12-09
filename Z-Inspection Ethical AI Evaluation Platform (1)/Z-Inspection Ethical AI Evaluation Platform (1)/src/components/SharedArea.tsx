import React, { useState } from 'react';
import { ArrowLeft, Send, Pin, MessageSquare, Hash } from 'lucide-react';
import { User, Project, Message } from '../types';
import { roleColors } from '../utils/constants';
import { formatTime, getUserById, getProjectById } from '../utils/helpers';

interface SharedAreaProps {
  currentUser: User;
  projects: Project[];
  onBack: () => void;
}

const mockMessages: Message[] = [
  {
    id: '1',
    userId: 'admin1',
    text: '📌 Welcome everyone to the Z-Inspection shared discussion area. Please keep discussions focused on ethical evaluation topics.',
    timestamp: '2024-01-22T09:00:00Z',
    isPinned: true
  },
  {
    id: '2',
    userId: 'user1',
    text: 'I have concerns about the fairness metrics being used in the Healthcare AI project. The demographic parity approach might not be suitable for medical diagnostics.',
    timestamp: '2024-01-22T10:30:00Z',
    relatedProject: '1'
  },
  {
    id: '3',
    userId: 'user2',
    text: '@Sarah Johnson That\'s a valid point. In healthcare, we often need to consider equalized odds rather than demographic parity to maintain clinical effectiveness.',
    timestamp: '2024-01-22T10:45:00Z',
    replyTo: '2',
    relatedProject: '1',
    mentions: ['user1']
  },
  {
    id: '4',
    userId: 'user3',
    text: 'From a medical perspective, I agree with both of you. Patient safety should be the primary concern, even if it means accepting some statistical disparities.',
    timestamp: '2024-01-22T11:00:00Z',
    relatedProject: '1'
  },
  {
    id: '5',
    userId: 'admin1',
    text: 'Great discussion! Let\'s document these insights as formal claims in the Healthcare AI project. @Mike Chen could you create a technical claim about the fairness metrics?',
    timestamp: '2024-01-22T11:15:00Z',
    mentions: ['user2'],
    relatedProject: '1'
  }
];

const mockUsers: User[] = [
  { id: 'admin1', email: 'admin@zinspection.com', name: 'Admin User', role: 'admin' },
  { id: 'user1', email: 'legal@zinspection.com', name: 'Sarah Johnson', role: 'legal' },
  { id: 'user2', email: 'technical@zinspection.com', name: 'Mike Chen', role: 'technical' },
  { id: 'user3', email: 'medical@zinspection.com', name: 'Dr. Emily Smith', role: 'medical' }
];

export function SharedArea({ currentUser, projects, onBack }: SharedAreaProps) {
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [newMessage, setNewMessage] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('all');

  const roleColor = roleColors[currentUser.role as keyof typeof roleColors];

  const filteredMessages = selectedProject === 'all' 
    ? messages 
    : messages.filter(msg => msg.relatedProject === selectedProject || msg.isPinned);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message: Message = {
      id: Date.now().toString(),
      userId: currentUser.id,
      text: newMessage,
      timestamp: new Date().toISOString(),
      relatedProject: selectedProject !== 'all' ? selectedProject : undefined
    };

    setMessages([...messages, message]);
    setNewMessage('');
  };

  const togglePin = (messageId: string) => {
    if (currentUser.role === 'admin') {
      setMessages(messages.map(msg => 
        msg.id === messageId ? { ...msg, isPinned: !msg.isPinned } : msg
      ));
    }
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
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Shared Discussion Area
                </h1>
                <p className="text-gray-600">Collaborative space for cross-functional discussions</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Discussions</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.title}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col h-[calc(100vh-73px)]">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {filteredMessages.map(message => {
              const user = getUserById(message.userId, mockUsers);
              const project = message.relatedProject ? getProjectById(message.relatedProject, projects) : null;
              const userColor = user ? roleColors[user.role as keyof typeof roleColors] : '#6B7280';

              return (
                <div key={message.id} className={`${message.isPinned ? 'bg-yellow-50 border border-yellow-200' : 'bg-white border'} rounded-lg p-4 shadow-sm`}>
                  <div className="flex items-start space-x-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0"
                      style={{ backgroundColor: userColor }}
                    >
                      {user?.name.charAt(0) || '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm text-gray-900">{user?.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: userColor }}>
                          {user?.role}
                        </span>
                        <span className="text-xs text-gray-500">{formatTime(message.timestamp)}</span>
                        {message.isPinned && (
                          <Pin className="h-3 w-3 text-yellow-600" />
                        )}
                      </div>

                      {project && (
                        <div className="text-xs text-blue-600 mb-2 flex items-center">
                          <Hash className="h-3 w-3 mr-1" />
                          {project.title}
                        </div>
                      )}

                      <p className="text-gray-800 text-sm leading-relaxed">{message.text}</p>

                      <div className="flex items-center space-x-3 mt-2">
                        <button className="text-xs text-gray-500 hover:text-gray-700">Reply</button>
                        {currentUser.role === 'admin' && (
                          <button
                            onClick={() => togglePin(message.id)}
                            className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
                          >
                            <Pin className="h-3 w-3 mr-1" />
                            {message.isPinned ? 'Unpin' : 'Pin'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredMessages.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg text-gray-900 mb-2">No discussions yet</h3>
                <p className="text-gray-600">Start the conversation by posting the first message.</p>
              </div>
            )}
          </div>
        </div>

        {/* Message Input */}
        <div className="bg-white border-t px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSendMessage} className="flex space-x-4">
              <div className="flex-1">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Share your thoughts${selectedProject !== 'all' ? ` about ${getProjectById(selectedProject, projects)?.title}` : ''}...`}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Use @username to mention someone • Press Enter to send, Shift+Enter for new line
                </div>
              </div>
              
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="px-6 py-3 text-white rounded-lg transition-colors hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
                style={{ backgroundColor: roleColor }}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Guidelines Sidebar */}
      <div className="fixed right-6 top-24 w-72 bg-white rounded-lg shadow-lg border p-4 max-h-96 overflow-y-auto hidden lg:block">
        <h3 className="text-sm mb-3 text-gray-900">Discussion Guidelines</h3>
        <div className="space-y-2 text-xs text-gray-600">
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Keep discussions focused on ethical AI evaluation topics</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Use @mentions to notify specific team members</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Link discussions to relevant projects when possible</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Admins can pin important messages for visibility</span>
          </div>
          <div className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Transform key insights into formal project claims</span>
          </div>
        </div>
      </div>
    </div>
  );
}