import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, Star, MessageSquare, ShoppingBag, Eye, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuItem, useCart } from "@/context/CartContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useToast } from "@/hooks/use-toast";
import ReviewModal from "./ReviewModal";

interface MenuCardProps {
  item: MenuItem;
  index: number;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 }
  },
  hover: {
    y: -8,
    transition: { type: "spring" as const, stiffness: 400, damping: 20 }
  }
};

export default function MenuCard({ item, index }: MenuCardProps) {
  const { items, addToCart, updateQuantity } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { toast } = useToast();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  const isItemFavorite = isFavorite(item.id, "menu_item");

  // Load review stats from API
  const loadReviewStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/customer/reviews?item_id=${item.id}&limit=1`);
      if (res.ok) {
        const data = await res.json();
        setReviewCount(data.stats?.total_reviews || 0);
        setAvgRating(data.stats?.average_rating || 0);
      }
    } catch (error) {
      }
  }, [item.id]);

  useEffect(() => {
    loadReviewStats();
  }, [loadReviewStats]);

  const refreshReviews = () => {
    loadReviewStats();
  };

  const cartItem = items.find((i) => i.id === item.id);
  const quantity = cartItem?.quantity || 0;

  const handleAddToCart = () => {
    addToCart(item);
    toast({
      title: "Added to cart! 🛒",
      description: `${item.name} has been added to your cart.`,
    });
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTogglingFavorite) return;
    
    setIsTogglingFavorite(true);
    try {
      const added = await toggleFavorite(item.id, "menu_item");
      toast({
        title: added ? "Added to favorites! ❤️" : "Removed from favorites",
        description: added 
          ? `${item.name} has been added to your favorites.`
          : `${item.name} has been removed from your favorites.`,
      });
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const handleUpdateQuantity = (newQuantity: number) => {
    updateQuantity(item.id, newQuantity);
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      transition={{ delay: index * 0.05 }}
      className="group card-elevated overflow-hidden relative bg-card"
    >
      {/* Image Container */}
      <div className="relative h-40 sm:h-48 bg-muted overflow-hidden">
        {/* Skeleton loader */}
        {!isImageLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-muted via-muted/50 to-muted animate-pulse" />
        )}
        
        <motion.img
          src={item.image}
          alt={item.name}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
            isImageLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setIsImageLoaded(true)}
          whileHover={{ scale: 1.1 }}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Badges */}
        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex flex-col gap-1.5 sm:gap-2">
          {item.isPopular && (
            <motion.span 
              className="bg-primary text-primary-foreground text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              🔥 Popular
            </motion.span>
          )}
          {item.isNew && (
            <motion.span 
              className="bg-accent text-accent-foreground text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              ✨ New
            </motion.span>
          )}
        </div>
        
        {/* Discount Badge */}
        {item.originalPrice && (
          <motion.span
            className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-accent text-accent-foreground text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            -{Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}%
          </motion.span>
        )}

        {/* Favorite Heart Button */}
        <motion.button
          onClick={handleToggleFavorite}
          disabled={isTogglingFavorite}
          className={`absolute top-2 sm:top-3 ${item.originalPrice ? 'right-14 sm:right-16' : 'right-2 sm:right-3'} w-8 h-8 sm:w-9 sm:h-9 rounded-full backdrop-blur-sm flex items-center justify-center shadow-lg transition-all z-10 ${
            isItemFavorite 
              ? 'bg-red-500 text-white' 
              : 'bg-white/90 text-gray-600 hover:bg-red-50 hover:text-red-500'
          }`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Heart 
            className={`h-4 w-4 sm:h-5 sm:w-5 transition-all ${
              isItemFavorite ? 'fill-current' : ''
            } ${isTogglingFavorite ? 'animate-pulse' : ''}`} 
          />
        </motion.button>

        {/* Quick Action Buttons - Show on Hover */}
        <motion.div
          className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 flex gap-1.5 sm:gap-2"
          initial={{ opacity: 0, y: 10 }}
          whileHover={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0 }}
        >
          <motion.button
            onClick={() => setShowReviewModal(true)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg hover:bg-white transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-foreground" />
          </motion.button>
        </motion.div>

        {/* Quantity Badge */}
        <AnimatePresence>
          {quantity > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 bg-primary text-primary-foreground text-xs sm:text-sm font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg flex items-center gap-1"
            >
              <ShoppingBag className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              {quantity} in cart
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
          <h3 className="text-base sm:text-xl font-semibold tracking-wide portal-card-title group-hover:opacity-80 transition-opacity line-clamp-1">
            {item.name}
          </h3>
          {/* Rating display */}
          <motion.button
            onClick={() => setShowReviewModal(true)}
            className="flex items-center gap-0.5 sm:gap-1 text-xs sm:text-sm hover:text-primary transition-colors flex-shrink-0"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Star
              className={`h-3 w-3 sm:h-4 sm:w-4 ${
                avgRating > 0 ? "text-accent fill-accent" : "text-muted-foreground/30"
              }`}
            />
            <span className="font-medium">
              {avgRating > 0 ? avgRating.toFixed(1) : "—"}
            </span>
            <span className="text-muted-foreground text-[10px] sm:text-xs">({reviewCount})</span>
          </motion.button>
        </div>
        <p className="text-muted-foreground text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2 leading-relaxed tracking-wide">
          {item.description}
        </p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <motion.span 
              className="text-lg sm:text-xl font-bold portal-heading-static"
              initial={{ scale: 1 }}
              whileHover={{ scale: 1.05 }}
            >
              Rs. {item.price}
            </motion.span>
            {item.originalPrice && (
              <span className="text-[10px] sm:text-sm text-muted-foreground line-through">
                Rs. {item.originalPrice}
              </span>
            )}
          </div>

          <AnimatePresence mode="wait">
            {quantity > 0 ? (
              <motion.div 
                key="quantity-controls"
                className="flex items-center gap-1 sm:gap-2"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
              >
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 sm:h-8 sm:w-8 rounded-full"
                    onClick={() => handleUpdateQuantity(quantity - 1)}
                  >
                    <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </motion.div>
                <motion.span 
                  className="w-6 sm:w-8 text-center font-semibold text-sm sm:text-base"
                  key={quantity}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                >
                  {quantity}
                </motion.span>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary hover:bg-primary/90"
                    onClick={() => handleUpdateQuantity(quantity + 1)}
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div 
                key="add-button"
                whileHover={{ scale: 1.1 }} 
                whileTap={{ scale: 0.9 }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
              >
                <Button
                  size="icon"
                  className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                  onClick={handleAddToCart}
                >
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Review Modal */}
      <ReviewModal
        item={item}
        open={showReviewModal}
        onOpenChange={setShowReviewModal}
        onReviewSubmitted={refreshReviews}
      />
    </motion.div>
  );
}
