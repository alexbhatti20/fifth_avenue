"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

// Types
interface FavoriteItem {
  id: string;
  type: "menu_item" | "deal";
}

interface FavoriteDetails {
  id: string;
  type: "menu_item" | "deal";
  name: string;
  description: string;
  price: number;
  original_price?: number;
  image_url: string;
  is_available: boolean;
  category: string;
  added_at: string;
  rating?: number;
  is_featured?: boolean;
}

interface FavoritesContextType {
  favorites: FavoriteItem[];
  favoritesDetails: FavoriteDetails[];
  isLoading: boolean;
  isFavorite: (itemId: string, itemType?: "menu_item" | "deal") => boolean;
  toggleFavorite: (itemId: string, itemType?: "menu_item" | "deal") => Promise<boolean>;
  loadFavoriteDetails: () => Promise<void>;
  clearAllFavorites: () => Promise<void>;
  favoritesCount: number;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

// Local storage key for guest favorites
const GUEST_FAVORITES_KEY = "zoiro_guest_favorites";

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [favoritesDetails, setFavoritesDetails] = useState<FavoriteDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const hasFetchedRef = React.useRef(false);
  const lastUserIdRef = React.useRef<string | null>(null);

  // Load favorites on mount or user change
  useEffect(() => {
    // Prevent duplicate fetches for same user
    if (user && lastUserIdRef.current === user.id && hasFetchedRef.current) return;
    
    if (user) {
      lastUserIdRef.current = user.id;
      hasFetchedRef.current = false; // Reset for new user
      loadFavoriteIds();
    } else {
      lastUserIdRef.current = null;
      hasFetchedRef.current = false;
      // Load from local storage for guests
      loadGuestFavorites();
    }
  }, [user]);

  // Load just the IDs (fast initial load) - uses API route to hide from Network tab
  const loadFavoriteIds = useCallback(async () => {
    if (!user || hasFetchedRef.current) return;
    
    hasFetchedRef.current = true;
    setIsLoading(true);
    try {
      const res = await fetch("/api/favorites");
      const { data, error } = await res.json();

      if (error) throw new Error(error);
      
      setFavorites(data || []);
      setIsInitialized(true);
    } catch {
      // Fallback to local storage on error
      hasFetchedRef.current = false; // Allow retry
      loadGuestFavorites();
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load guest favorites from local storage
  const loadGuestFavorites = useCallback(() => {
    try {
      const stored = localStorage.getItem(GUEST_FAVORITES_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch {
      // Failed to load - start with empty favorites
    }
    setIsLoading(false);
    setIsInitialized(true);
  }, []);

  // Save guest favorites to local storage
  const saveGuestFavorites = useCallback((items: FavoriteItem[]) => {
    try {
      localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(items));
    } catch {
      // Failed to save - non-critical
    }
  }, []);

  // Check if an item is favorited (instant, no API call)
  const isFavorite = useCallback(
    (itemId: string, itemType: "menu_item" | "deal" = "menu_item") => {
      return favorites.some((f) => f.id === itemId && f.type === itemType);
    },
    [favorites]
  );

  // Toggle favorite with optimistic update
  const toggleFavorite = useCallback(
    async (itemId: string, itemType: "menu_item" | "deal" = "menu_item"): Promise<boolean> => {
      const isCurrentlyFavorite = isFavorite(itemId, itemType);
      
      // Optimistic update
      if (isCurrentlyFavorite) {
        setFavorites((prev) => prev.filter((f) => !(f.id === itemId && f.type === itemType)));
        setFavoritesDetails((prev) => prev.filter((f) => !(f.id === itemId && f.type === itemType)));
      } else {
        setFavorites((prev) => [{ id: itemId, type: itemType }, ...prev]);
      }

      // If logged in, sync with server via API route
      if (user) {
        try {
          const res = await fetch("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId, itemType }),
          });
          const { data, error } = await res.json();

          if (error) throw new Error(error);
          
          // Server is source of truth, update from response
          const serverFavorites = (data?.favorites || []).map((f: any) => ({
            id: f.id,
            type: f.type,
          }));
          setFavorites(serverFavorites);
          
          return data?.action === "added";
        } catch {
          // Revert optimistic update on error
          if (isCurrentlyFavorite) {
            setFavorites((prev) => [{ id: itemId, type: itemType }, ...prev]);
          } else {
            setFavorites((prev) => prev.filter((f) => !(f.id === itemId && f.type === itemType)));
          }
          return isCurrentlyFavorite;
        }
      } else {
        // Guest user - save to local storage
        const newFavorites = isCurrentlyFavorite
          ? favorites.filter((f) => !(f.id === itemId && f.type === itemType))
          : [{ id: itemId, type: itemType }, ...favorites];
        saveGuestFavorites(newFavorites);
        return !isCurrentlyFavorite;
      }
    },
    [user, favorites, isFavorite, saveGuestFavorites]
  );

  const hasLoadedDetailsRef = React.useRef(false);

  // Load full favorite details (for favorites page)
  const loadFavoriteDetails = useCallback(async () => {
    if (!user) {
      // For guests, we'd need to fetch from menu_items directly
      // For now, just clear details
      setFavoritesDetails([]);
      return;
    }
    
    // Prevent duplicate fetches
    if (hasLoadedDetailsRef.current && favoritesDetails.length > 0) return;
    hasLoadedDetailsRef.current = true;

    setIsLoading(true);
    try {
      const res = await fetch("/api/favorites/details");
      const { data, error } = await res.json();

      if (error) throw new Error(error);
      
      // RPC returns jsonb array directly, ensure it's parsed correctly
      const details = Array.isArray(data) ? data : [];
      setFavoritesDetails(details);
    } catch {
      hasLoadedDetailsRef.current = false; // Allow retry on error
      setFavoritesDetails([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, favoritesDetails.length]);

  // Clear all favorites
  const clearAllFavorites = useCallback(async () => {
    // Optimistic update
    setFavorites([]);
    setFavoritesDetails([]);

    if (user) {
      try {
        const res = await fetch("/api/favorites/clear", { method: "POST" });
        const { error } = await res.json();
        if (error) throw new Error(error);
      } catch {
        // Reload on error
        loadFavoriteIds();
      }
    } else {
      saveGuestFavorites([]);
    }
  }, [user, loadFavoriteIds, saveGuestFavorites]);

  const favoritesCount = useMemo(() => favorites.length, [favorites]);

  const value = useMemo(
    () => ({
      favorites,
      favoritesDetails,
      isLoading,
      isFavorite,
      toggleFavorite,
      loadFavoriteDetails,
      clearAllFavorites,
      favoritesCount,
    }),
    [favorites, favoritesDetails, isLoading, isFavorite, toggleFavorite, loadFavoriteDetails, clearAllFavorites, favoritesCount]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
