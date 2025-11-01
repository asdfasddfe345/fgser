// src/hooks/useIsAdmin.ts
import { useAuth } from '../contexts/AuthContext';

export const useIsAdmin = () => {
  const { user } = useAuth();
  
  const isAdmin = user?.role === 'admin' || user?.email === 'primoboostai@gmail.com';
  
  return isAdmin;
};
