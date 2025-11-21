import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '../lib/supabaseClient';

interface UserState {
    user: User | null;
    profile: Profile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}

const initialState: UserState = {
    user: null,
    profile: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
};

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<User | null>) => {
            state.user = action.payload;
            state.isAuthenticated = !!action.payload;
            state.isLoading = false;
        },
        setProfile: (state, action: PayloadAction<Profile | null>) => {
            state.profile = action.payload;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        },
        clearUser: (state) => {
            state.user = null;
            state.profile = null;
            state.isAuthenticated = false;
            state.error = null;
        },
        updateProfile: (state, action: PayloadAction<Partial<Profile>>) => {
            if (state.profile) {
                state.profile = { ...state.profile, ...action.payload };
            }
        },
    },
});

export const {
    setUser,
    setProfile,
    setLoading,
    setError,
    clearUser,
    updateProfile,
} = userSlice.actions;

export default userSlice.reducer;
