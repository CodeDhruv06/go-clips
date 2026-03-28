import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;
type AccountStatus = Profile['account_status'] | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isInstagramConnected: boolean;
  accountStatus: AccountStatus;

  sendSignUpOtp: (email: string) => Promise<{ error: Error | null }>;
  verifySignUpOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
  completeSignUp: (email: string, name: string, password: string) => Promise<{ error: Error | null }>;

  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BLOCKED_STATUS_MESSAGES: Record<string, string> = {
  banned: 'This account has been banned.',
  suspended: 'This account is suspended.',
};

interface SignUpOtpResponse {
  error?: string;
  message?: string;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // ================= PROFILE =================

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error(error.message);
      setProfile(null);
      return null;
    }

    setProfile(data);
    return data;
  };

  const checkAdmin = async (userId: string) => {
    const { data } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });

    setIsAdmin(data === true);
  };

  const hydrateUserState = async (session: Session | null) => {
    setSession(session);
    setUser(session?.user ?? null);

    if (!session?.user) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }

    await Promise.all([
      fetchProfile(session.user.id),
      checkAdmin(session.user.id),
    ]);
  };

  const refreshProfile = async () => {
    if (!user) return;
    await fetchProfile(user.id);
    await checkAdmin(user.id);
  };

  // ================= INIT =================

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      hydrateUserState(data.session);
      setLoading(false);
    });

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
        hydrateUserState(session);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  // ================= OTP FLOW =================

  const invokeSignUpOtp = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke<SignUpOtpResponse>('signup-otp', {
      body: payload,
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    if (data?.error) {
      return { error: new Error(data.error) };
    }

    return { error: null };
  };

  // SEND OTP
  const sendSignUpOtp = async (email: string) => {
    return invokeSignUpOtp({
      action: 'send',
      email: email.trim().toLowerCase(),
    });
  };

  // VERIFY OTP
  const verifySignUpOtp = async (email: string, token: string) => {
    return invokeSignUpOtp({
      action: 'verify',
      email: email.trim().toLowerCase(),
      otp: token.trim().toUpperCase(),
    });
  };

  // COMPLETE PROFILE
  const completeSignUp = async (email: string, name: string, password: string) => {
    const signUpResult = await invokeSignUpOtp({
      action: 'complete',
      email: email.trim().toLowerCase(),
      name: name.trim(),
      password,
    });

    if (signUpResult.error) {
      return signUpResult;
    }

    const signInResult = await signIn(email, password);
    if (signInResult.error) {
      return signInResult;
    }

    await refreshProfile();
    return { error: null };
  };

  // ================= LOGIN =================

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) return { error };

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    if (!user) return { error: new Error('Session not found') };

    const profile = await fetchProfile(user.id);

    if (!profile || profile.account_status !== 'active') {
      await supabase.auth.signOut();
      return { error: new Error('Account not active') };
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setIsAdmin(false);
  };

  const isInstagramConnected =
    profile?.instagram_connection_status === 'approved';

  const accountStatus = profile?.account_status ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isAdmin,
        isInstagramConnected,
        accountStatus,
        sendSignUpOtp,
        verifySignUpOtp,
        completeSignUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
