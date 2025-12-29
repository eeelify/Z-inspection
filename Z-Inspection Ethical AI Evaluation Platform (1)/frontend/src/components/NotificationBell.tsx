import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, Check } from 'lucide-react';
import { api } from '../api';

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  url: string;
  createdAt: string;
  isRead: boolean;
  actorId?: {
    name: string;
    role: string;
  };
  projectId?: {
    title: string;
  };
}

interface NotificationBellProps {
  currentUser: { id: string };
  onNotificationClick?: (url: string) => void;
  onNavigate?: (view: string, params?: any) => void;
}

export function NotificationBell({ currentUser, onNotificationClick, onNavigate }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!currentUser?.id) return;
    
    try {
      setLoading(true);
      const response = await fetch(api(`/api/notifications?userId=${currentUser.id}&limit=50`));
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    
    // Also listen for custom events (e.g., when new notification is created)
    const handleNewNotification = () => {
      fetchNotifications();
    };
    window.addEventListener('notification:new', handleNewNotification);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('notification:new', handleNewNotification);
    };
  }, [currentUser?.id]);

  // Calculate dropdown position based on bell button position
  const updateDropdownPosition = () => {
    if (bellButtonRef.current) {
      const rect = bellButtonRef.current.getBoundingClientRect();
      const DROPDOWN_WIDTH = 360;
      const PADDING = 8;
      const GAP = 8; // Gap between bell and dropdown
      
      // Align dropdown's right edge to bell's right edge (opens leftward)
      let left = rect.right - DROPDOWN_WIDTH;
      
      // Ensure it doesn't overflow right edge of viewport
      const maxLeft = window.innerWidth - DROPDOWN_WIDTH - PADDING;
      left = Math.min(left, maxLeft);
      
      // Ensure it doesn't overflow left edge of viewport
      left = Math.max(PADDING, left);
      
      setDropdownPosition({
        top: rect.bottom + GAP, // Gap below bell
        left: left
      });
    }
  };

  // Update position when dropdown opens or window resizes/scrolls
  useEffect(() => {
    if (showDropdown) {
      updateDropdownPosition();
      
      const handleResize = () => updateDropdownPosition();
      const handleScroll = () => updateDropdownPosition();
      
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true); // Capture scroll events from all elements
      
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [showDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        bellButtonRef.current?.contains(event.target as Node) ||
        dropdownRef.current?.contains(event.target as Node)
      ) {
        return; // Click is inside bell or dropdown, don't close
      }
      setShowDropdown(false);
    };

    if (showDropdown) {
      // Use capture phase to catch clicks before they bubble
      document.addEventListener('mousedown', handleClickOutside, true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [showDropdown]);

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(api(`/api/notifications/${notificationId}/read`), {
        method: 'POST'
      });
      if (response.ok) {
        // Update local state
        setNotifications(prev => 
          prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(api('/api/notifications/read-all'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      markAsRead(notification._id);
    }

    // Close dropdown
    setShowDropdown(false);

    // Parse URL and navigate using App's navigation system
    const url = notification.url;
    
    // Parse notification URL patterns
    // Pattern: /projects/:projectId/tensions/:tensionId?tab=...
    const projectTensionMatch = url.match(/\/projects\/([^/]+)\/tensions\/([^/?]+)(\?tab=([^&]+))?/);
    if (projectTensionMatch) {
      const projectId = projectTensionMatch[1];
      const tensionId = projectTensionMatch[2];
      const tab = projectTensionMatch[4] || 'evidence';
      
      if (onNavigate) {
        // Use App's navigation system
        onNavigate('project-detail', { projectId, tensionId, tab });
      } else if (onNotificationClick) {
        onNotificationClick(url);
      }
      return;
    }
    
    // Pattern: /admin/projects/:projectId/evaluations
    const adminProjectMatch = url.match(/\/admin\/projects\/([^/]+)\/evaluations/);
    if (adminProjectMatch) {
      const projectId = adminProjectMatch[1];
      if (onNavigate) {
        onNavigate('project-detail', { projectId });
      } else if (onNotificationClick) {
        onNotificationClick(url);
      }
      return;
    }
    
    // Pattern: /projects/:projectId
    const projectMatch = url.match(/\/projects\/([^/]+)/);
    if (projectMatch) {
      const projectId = projectMatch[1];
      if (onNavigate) {
        onNavigate('project-detail', { projectId });
      } else if (onNotificationClick) {
        onNotificationClick(url);
      }
      return;
    }
    
    // Fallback: use onNotificationClick or window.location
    if (onNotificationClick) {
      onNotificationClick(url);
    } else if (url.startsWith('/')) {
      // Only use window.location as last resort
      console.warn('Notification URL not recognized, using window.location:', url);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'tension_created':
      case 'tension_commented':
      case 'tension_evidence_added':
      case 'tension_voted':
        return '⚡';
      case 'evaluation_started':
      case 'evaluation_submitted':
        return '📝';
      default:
        return '🔔';
    }
  };

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showDropdown) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showDropdown]);

  return (
    <>
      <div className="relative">
        <button
          ref={bellButtonRef}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
          className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
          aria-label="Notifications"
          type="button"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {showDropdown && dropdownPosition && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex flex-col z-[9999]"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: '360px',
            maxWidth: 'calc(100vw - 16px)',
            maxHeight: '420px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setShowDropdown(false)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1 min-h-0" style={{ maxHeight: 'calc(420px - 60px)' }}>
            {loading ? (
              <div className="p-6 text-center text-gray-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm mt-2">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <button
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      !notification.isRead ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="text-xl flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className={`text-sm font-medium ${
                              !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </div>
                            <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {notification.message}
                            </div>
                            {notification.projectId && (
                              <div className="text-xs text-gray-500 mt-1">
                                {notification.projectId.title}
                              </div>
                            )}
                          </div>
                          {!notification.isRead && (
                            <div className="ml-2 w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1"></div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="text-xs text-gray-400">
                            {formatTime(notification.createdAt)}
                          </div>
                          {notification.actorId && (
                            <div className="text-xs text-gray-500">
                              {notification.actorId.name} ({notification.actorId.role})
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

