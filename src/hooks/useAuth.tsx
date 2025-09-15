import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// --- Define the shape of our context ---
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isEmailVerified: boolean; // <-- NEW: State to track verification
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error?: any }>;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  resendConfirmation: () => Promise<{ error?: any }>; // <-- NEW: Function to resend email
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState(false); // <-- NEW

  // --- NEW: A robust function to check verification status ---
  const checkUserVerification = useCallback(async () => {
    // This function will run on load and when the user returns to the tab
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // A user is verified if they have a confirmation timestamp OR if they signed up via OAuth
      const verified = !!user.email_confirmed_at || !!user.app_metadata.provider;
      setIsEmailVerified(verified);
    }
  }, []);

  useEffect(() => {
    // Initial check on page load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const verified = !!currentUser.email_confirmed_at || !!currentUser.app_metadata.provider;
        setIsEmailVerified(verified);
      }
      setLoading(false);
    });

    // Listen for auth state changes (login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          const verified = !!currentUser.email_confirmed_at || !!currentUser.app_metadata.provider;
          setIsEmailVerified(verified);
        } else {
          setIsEmailVerified(false);
        }
        setLoading(false);
      }
    );
    
    // --- NEW: Refresh verification status when user returns to the app ---
    // This handles the case where they verify in another tab.
    window.addEventListener('focus', checkUserVerification);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('focus', checkUserVerification);
    };
  }, [checkUserVerification]);

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

  // --- NEW: The missing function to resend the confirmation email ---
  const resendConfirmation = async () => {
    if (!user || !user.email) return { error: { message: "No user is logged in." } };
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
    });
    return { error };
  };

  // --- Expose the new state and function to the rest of the app ---
  const value = {
    user,
    session,
    loading,
    isEmailVerified, // <-- NEW
    signUp,
    signIn,
    signOut,
    resendConfirmation, // <-- NEW
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
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
