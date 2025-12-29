import React, { useState, useEffect, useRef } from 'react';
import { X, MessageSquare, ArrowLeft } from 'lucide-react';
import { User, Project } from '../types';
import { api } from '../api';

interface NotificationDetailPanelProps {
  conversation: any;
  currentUser: User;
  users: User[];
  projects: Project[];
  onClose: () => void;
  onOpenChat: (project: Project, otherUser: User) => void;
}

export function NotificationDetailPanel({
  conversation,
  currentUser,
  users,
  projects,
  onClose,
  onOpenChat,
}: NotificationDetailPanelProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const project = projects.find(p => p.id === conversation.projectId) ||
    ({
      id: conversation.projectId,
      title: conversation.projectTitle || 'Project',
    } as any);
  
  const otherUser = users.find(u => u.id === conversation.fromUserId) ||
    ({
      id: conversation.fromUserId,
      name: conversation.fromUserName || 'User',
    } as any);

  const currentUserId = currentUser.id || (currentUser as any)._id;
  const otherUserId = otherUser.id || (otherUser as any)._id;
  const projectId = project.id || (project as any)._id;

  useEffect(() => {
    const fetchMessages = async () => {
      if (!projectId || !currentUserId || !otherUserId) return;

      try {
        setLoading(true);
        const response = await fetch(api(
          `/api/messages/thread?projectId=${projectId}&user1=${currentUserId}&user2=${otherUserId}`
        ));

        if (response.ok) {
          const data = await response.json();
          const formatted = (data || []).map((m: any) => ({
            id: m._id || m.id,
            projectId: m.projectId?._id || m.projectId?.id || m.projectId || projectId,
            text: m.text,
            createdAt: m.createdAt || m.timestamp || new Date().toISOString(),
            readAt: m.readAt ?? null,
            fromUserId: m.fromUserId,
            toUserId: m.toUserId,
          }));

          setMessages(formatted);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    
    // Auto-scroll to bottom on load
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }, 100);
  }, [projectId, currentUserId, otherUserId]);

  const getSenderName = (message: any) => {
    const fromObj = message.fromUserId;
    if (fromObj && typeof fromObj === 'object' && fromObj.name) return fromObj.name;
    const fromId = typeof fromObj === 'object' ? (fromObj._id || fromObj.id) : fromObj;
    return fromId === currentUserId ? currentUser.name : otherUser.name;
  };

  const isFromCurrentUser = (message: any) => {
    const fromObj = message.fromUserId;
    const fromId = typeof fromObj === 'object' ? (fromObj._id || fromObj.id) : fromObj;
    return fromId === currentUserId;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Group messages by date
  const groupMessagesByDate = (msgs: any[]) => {
    if (msgs.length === 0) return [];

    const grouped: Array<{
      date: string;
      messages: any[];
    }> = [];

    let currentDate = '';
    let currentMessages: any[] = [];

    msgs.forEach((msg) => {
      const msgDate = new Date(msg.createdAt).toDateString();
      
      if (msgDate !== currentDate) {
        if (currentMessages.length > 0) {
          grouped.push({ date: currentDate, messages: currentMessages });
        }
        currentDate = msgDate;
        currentMessages = [msg];
      } else {
        currentMessages.push(msg);
      }
    });

    if (currentMessages.length > 0) {
      grouped.push({ date: currentDate, messages: currentMessages });
    }

    return grouped;
  };

  const handleOpenChat = () => {
    if (project && otherUser) {
      onOpenChat(project, otherUser);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center">
            {otherUser.name?.charAt(0) || 'U'}
          </div>
          <div>
            <div className="font-medium text-gray-900">{otherUser.name}</div>
            <div className="text-xs text-gray-500">{project.title}</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleOpenChat}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
          >
            <MessageSquare className="h-4 w-4" />
            Open Chat
          </button>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-gray-50 p-4"
      >
        {loading && messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p>No messages yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-y-4">
            {groupMessagesByDate(messages).map((dateGroup, dateGroupIdx) => (
              <div key={dateGroupIdx}>
                {/* Date separator */}
                <div className="text-center my-4">
                  <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                    {formatDate(dateGroup.date)}
                  </span>
                </div>
                
                {/* Messages for this date */}
                {dateGroup.messages.map((msg, msgIdx) => {
                  const isFromMe = isFromCurrentUser(msg);
                  const senderName = getSenderName(msg);
                  
                  return (
                    <div
                      key={msg.id || msgIdx}
                      className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          isFromMe
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-900 border border-gray-200'
                        }`}
                      >
                        {!isFromMe && (
                          <div className="text-xs font-medium mb-1 opacity-80">
                            {senderName}
                          </div>
                        )}
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {String(msg.text || '').startsWith('[NOTIFICATION]')
                            ? String(msg.text).replace(/^\[NOTIFICATION\]\s*/, '')
                            : msg.text}
                        </div>
                        <div className={`text-xs mt-1 ${
                          isFromMe ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {formatTime(msg.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

