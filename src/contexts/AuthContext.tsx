import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../types';

export interface StoreDetails {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    email?: string;
}

interface AuthContextType {
    session: Session | null;
    profile: Profile | null;
    storeName: string | null;
    storeDetails: StoreDetails | null;
    isLoading: boolean;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    profile: null,
    storeName: null,
    storeDetails: null,
    isLoading: true,
    refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [storeName, setStoreName] = useState<string | null>(null);
    const [storeDetails, setStoreDetails] = useState<StoreDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*, stores(id, name, phone, address, email)')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Fetch profile error:', error);
            }

            if (data) {
                setProfile(data as Profile);
                const storeData = (data as any).stores;
                if (storeData) {
                    setStoreName(storeData.name || null);
                    setStoreDetails({
                        id: storeData.id,
                        name: storeData.name,
                        phone: storeData.phone,
                        address: storeData.address,
                        email: storeData.email,
                    });
                }
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        }
    };

    const refreshProfile = async () => {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user?.id) {
            await fetchProfile(currentSession.user.id);
        }
    };

    useEffect(() => {
        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user?.id) {
                fetchProfile(session.user.id).finally(() => setIsLoading(false));
            } else {
                setIsLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
            setSession(currentSession);
            if (currentSession?.user?.id) {
                fetchProfile(currentSession.user.id);
            } else {
                setProfile(null);
                setStoreDetails(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ session, profile, storeName, storeDetails, isLoading, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};
