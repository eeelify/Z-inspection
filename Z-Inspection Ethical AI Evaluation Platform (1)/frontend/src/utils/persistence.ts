const KEYS = {
    VIEW_STATE: 'app_view_state',
    USER_DASHBOARD_TAB: 'user_dashboard_tab',
    ADMIN_DASHBOARD_TAB: 'admin_dashboard_tab',
    USE_CASE_OWNER_TAB: 'use_case_owner_tab'
};

export interface ViewState {
    currentView: string;
    selectedProject: any | null;
    selectedTension: any | null;
    selectedOwner: any | null;
    selectedUseCase: any | null;
    selectedReportId: string | null;
}

export const saveViewState = (state: ViewState) => {
    try {
        localStorage.setItem(KEYS.VIEW_STATE, JSON.stringify(state));
    } catch (error) {
        console.error('Error saving view state:', error);
    }
};

export const loadViewState = (): ViewState | null => {
    try {
        const stored = localStorage.getItem(KEYS.VIEW_STATE);
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.error('Error loading view state:', error);
        return null;
    }
};

export const clearViewState = () => {
    localStorage.removeItem(KEYS.VIEW_STATE);
};

export const saveUserDashboardTab = (tab: string) => {
    localStorage.setItem(KEYS.USER_DASHBOARD_TAB, tab);
};

export const loadUserDashboardTab = (defaultTab: string = 'assigned'): string => {
    return localStorage.getItem(KEYS.USER_DASHBOARD_TAB) || defaultTab;
};

export const saveAdminDashboardTab = (tab: string) => {
    localStorage.setItem(KEYS.ADMIN_DASHBOARD_TAB, tab);
};

export const loadAdminDashboardTab = (defaultTab: string = 'dashboard'): string => {
    return localStorage.getItem(KEYS.ADMIN_DASHBOARD_TAB) || defaultTab;
};
