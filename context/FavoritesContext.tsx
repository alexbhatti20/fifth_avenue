"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
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

  // Load favorites on mount or user change
  useEffect(() => {
    if (user) {
      loadFavoriteIds();
    } else {
      // Load from local storage for guests
      loadGuestFavorites();
    }
  }, [user]);

  // Load just the IDs (fast initial load)
  const loadFavoriteIds = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_favorite_ids", {
        p_customer_id: user.id,
      });

      if (error) throw error;
      
      setFavorites(data || []);
      setIsInitialized(true);
    } catch (error) {
      console.error("Error loading favorite IDs:", error);
      // Fallback to local storage
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
    } catch (error) {
      console.error("Error loading guest favorites:", error);
    }
    setIsLoading(false);
    setIsInitialized(true);
  }, []);

  // Save guest favorites to local storage
  const saveGuestFavorites = useCallback((items: FavoriteItem[]) => {
    try {
      localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("Error saving guest favorites:", error);
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

      // If logged in, sync with server
      if (user) {
        try {
          const { data, error } = await supabase.rpc("toggle_favorite", {
            p_customer_id: user.id,
            p_item_id: itemId,
            p_item_type: itemType,
          });

          if (error) throw error;
          
          // Server is source of truth, update from response
          const serverFavorites = (data?.favorites || []).map((f: any) => ({
            id: f.id,
            type: f.type,
          }));
          setFavorites(serverFavorites);
          
          return data?.action === "added";
        } catch (error) {
          console.error("Error toggling favorite:", error);
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

  // Load full favorite details (for favorites page)
  const loadFavoriteDetails = useCallback(async () => {
    if (!user) {
      // For guests, we'd need to fetch from menu_items directly
      // For now, just clear details
      setFavoritesDetails([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_customer_favorites", {
        p_customer_id: user.id,
      });

      if (error) throw error;
      
      // RPC returns jsonb array directly, ensure it's parsed correctly
      const details = Array.isArray(data) ? data : [];
      console.log("[Favorites] Loaded details:", details);
      setFavoritesDetails(details);
    } catch (error) {
      console.error("Error loading favorite details:", error);
      setFavoritesDetails([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Clear all favorites
  const clearAllFavorites = useCallback(async () => {
    // Optimistic update
    setFavorites([]);
    setFavoritesDetails([]);

    if (user) {
      try {
        const { error } = await supabase.rpc("clear_all_favorites", {
          p_customer_id: user.id,
        });
        if (error) throw error;
      } catch (error) {
        console.error("Error clearing favorites:", error);
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
