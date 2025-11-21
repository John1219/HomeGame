import { supabase } from '../lib/supabaseClient';
import type { User, AuthError } from '@supabase/supabase-js';

export interface SignUpData {
    email: string;
    password: string;
    username: string;
}

export interface SignInData {
    email: string;
    password: string;
}

/**
 * Authentication service for user management
 */
class AuthService {
    /**
     * Sign up a new user
     */
    async signUp({ email, password, username }: SignUpData): Promise<{
        user: User | null;
        error: AuthError | null;
    }> {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username,
                },
            },
        });

        return { user: data.user, error };
    }

    /**
     * Sign in an existing user
     */
    async signIn({ email, password }: SignInData): Promise<{
        user: User | null;
        error: AuthError | null;
    }> {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        return { user: data.user, error };
    }

    /**
     * Sign out the current user
     */
    async signOut(): Promise<{ error: AuthError | null }> {
        const { error } = await supabase.auth.signOut();
        return { error };
    }

    /**
     * Get the current user session
     */
    async getSession() {
        const { data, error } = await supabase.auth.getSession();
        return { session: data.session, error };
    }

    /**
     * Get the current user
     */
    async getCurrentUser() {
        const { data, error } = await supabase.auth.getUser();
        return { user: data.user, error };
    }

    /**
     * Listen to auth state changes
     */
    onAuthStateChange(callback: (user: User | null) => void) {
        return supabase.auth.onAuthStateChange((_event, session) => {
            callback(session?.user ?? null);
        });
    }

    /**
     * Send password reset email
     */
    async resetPassword(email: string): Promise<{ error: AuthError | null }> {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });
        return { error };
    }

    /**
     * Update user password
     */
    async updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
        const { error } = await supabase.auth.updateUser({
            password: newPassword,
        });
        return { error };
    }

    /**
     * Update user profile
     */
    async updateProfile(userId: string, updates: {
        username?: string;
        avatar_url?: string;
    }): Promise<{ error: Error | null }> {
        try {
            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', userId);

            return { error };
        } catch (error) {
            return { error: error as Error };
        }
    }

    /**
     * Get user profile by ID
     */
    async getProfile(userId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        return { profile: data, error };
    }

    /**
     * Upload avatar image
     */
    async uploadAvatar(userId: string, file: File): Promise<{ avatarUrl: string | null; error: Error | null }> {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}-${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                return { avatarUrl: null, error: uploadError };
            }

            const { data } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            return { avatarUrl: data.publicUrl, error: null };
        } catch (error) {
            return { avatarUrl: null, error: error as Error };
        }
    }
}

export const authService = new AuthService();
