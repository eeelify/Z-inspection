import { User } from '../types';

const STORAGE_KEY = 'currentUser';

/**
 * Saves the user object to localStorage.
 * @param user The user object to save.
 */
export const saveUser = (user: User): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch (error) {
        console.error('Error saving user to localStorage:', error);
    }
};

/**
 * Loads the user object from localStorage.
 * @returns The user object if found and valid, otherwise null.
 */
export const loadUser = (): User | null => {
    try {
        const storedUser = localStorage.getItem(STORAGE_KEY);
        if (!storedUser) return null;
        return JSON.parse(storedUser) as User;
    } catch (error) {
        console.error('Error loading user from localStorage:', error);
        return null;
    }
};

/**
 * Removes the user object from localStorage.
 */
export const clearUser = (): void => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Error clearing user from localStorage:', error);
    }
};
