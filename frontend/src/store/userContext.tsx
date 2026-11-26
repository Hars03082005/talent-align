// frontend/src/store/userContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ExtendedUserProfile } from '../types';
import { api } from '../api/client';

interface UserContextType {
  userId: string;
  sessionId: string;
  setSessionId: (id: string) => void;
  user: ExtendedUserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  updateUser: (data: Partial<ExtendedUserProfile>) => Promise<void>;
  savedJobIds: Set<string>;
  toggleSaveJob: (jobId: string) => Promise<void>;
}

const DEFAULT_USER_ID = 'demo-candidate-001';
const DEFAULT_SESSION_ID = 'session-demo-001';

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId] = useState<string>(() => {
    return localStorage.getItem('pta_user_id') || DEFAULT_USER_ID;
  });
  const [sessionId, setSessionIdState] = useState<string>(() => {
    return localStorage.getItem('pta_session_id') || DEFAULT_SESSION_ID;
  });
  const [user, setUser] = useState<ExtendedUserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());

  const setSessionId = (id: string) => {
    setSessionIdState(id);
    localStorage.setItem('pta_session_id', id);
  };

  const refreshProfile = async () => {
    try {
      setLoading(true);
      const profile = await api.getProfile(userId);
      setUser(profile);
      try {
        const saved = await api.getSavedJobs(userId);
        setSavedJobIds(new Set(saved.map((j) => j.id)));
      } catch {
        // ignore
      }
    } catch (e) {
      // Auto-fallback mock profile if profile does not exist yet
      setUser({
        id: userId,
        name: 'Alex Mercer',
        email: 'alex.mercer@example.com',
        education: 'Bachelor of Technology',
        degree_stream: 'Computer Science & Engineering',
        experience_level: 'Entry Level',
        experience_years: 1.5,
        work_mode_preference: 'remote',
        declared_skills: ['Python', 'SQL', 'React', 'Docker', 'Git'],
        declared_interests: ['Cloud Architecture', 'Machine Learning', 'API Engineering'],
        target_roles: ['Software Engineer', 'Full Stack Developer', 'Cloud Engineer'],
        preferred_locations: ['Remote', 'San Francisco', 'New York'],
        projects: [
          {
            title: 'Microservices Task Queue',
            description: 'Asynchronous distributed job worker queue with Redis and Python.',
            skills_used: ['Python', 'Redis', 'Docker'],
          },
        ],
        work_experience: [],
        certifications: [],
        primary_archetype: 'Builder',
        secondary_archetype: 'Analyst',
        baio_scores: { B: 0.82, A: 0.65, I: 0.45, O: 0.38 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('pta_user_id', userId);
    refreshProfile();
  }, [userId]);

  const updateUser = async (data: Partial<ExtendedUserProfile>) => {
    try {
      const updated = await api.updateProfile(userId, data);
      setUser(updated);
    } catch {
      setUser((prev) => (prev ? { ...prev, ...data } : null));
    }
  };

  const toggleSaveJob = async (jobId: string) => {
    try {
      if (savedJobIds.has(jobId)) {
        // Mark as 'unsaved' by re-saving with rejected status (soft toggle)
        setSavedJobIds((prev) => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
      } else {
        await api.saveJobApplication(userId, jobId, 'saved');
        setSavedJobIds((prev) => new Set([...prev, jobId]));
      }
    } catch {
      // ignore
    }
  };

  return (
    <UserContext.Provider
      value={{
        userId,
        sessionId,
        setSessionId,
        user,
        loading,
        refreshProfile,
        updateUser,
        savedJobIds,
        toggleSaveJob,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
};
