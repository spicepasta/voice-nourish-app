import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isEmailVerified: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error?: any }>;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  resendConfirmation: () => Promise<{ error?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  const checkUser = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      // Explicitly check for email verification status
      if (currentUser) {
        // A user is verified if they have a confirmation timestamp OR if they signed up via an OAuth provider.
        const verified = !!currentUser.email_confirmed_at || !!currentUser.app_metadata.provider;
        setIsEmailVerified(verified);
      } else {
        setIsEmailVerified(false);
      }
    } catch (error) {
      console.error("Error getting session:", error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    checkUser(); // Initial check

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          const verified = !!currentUser.email_confirmed_at || !!currentUser.app_metadata.provider;
          setIsEmailVerified(verified);
        } else {
          setIsEmailVerified(false);
        }

        // Also refresh user data when they focus the window, to catch verification clicks in other tabs.
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            checkUser();
        }

        if (event === 'INITIAL_SESSION') {
            setLoading(false);
        }
      }
    );

    window.addEventListener('focus', checkUser);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('focus', checkUser);
    };
  }, [checkUser]);

  const signUp = async (email: string, password: string, displayName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resendConfirmation = async () => {
    if (!user) return { error: { message: "No user is logged in." } };
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email!,
    });
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    isEmailVerified,
    signUp,
    signIn,
    signOut,
    resendConfirmation,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
