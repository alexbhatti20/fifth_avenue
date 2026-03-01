'use client';

import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import OfferFormClient from '../add/OfferFormClient';
import { toast } from 'sonner';

export default function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [offer, setOffer] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const loadData = async () => {
      try {
        const accessToken = localStorage.getItem('sb_access_token') || localStorage.getItem('auth_token');
        const headers = {
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        };
        
        // Fetch offer details and menu data in parallel
        const [offerResponse, menuResponse] = await Promise.all([
          fetch(`/api/offers/${id}`, { headers, credentials: 'include' }),
          fetch('/api/menu', { headers, credentials: 'include' }),
        ]);
        
        if (!offerResponse.ok) {
          const data = await offerResponse.json();
          throw new Error(data.error || 'Failed to load offer');
        }
        
        const offerData = await offerResponse.json();
        
        if (!offerData.offer) {
          router.push('/portal/menu?tab=offers');
          toast.error('Offer not found');
          return;
        }
        
        setOffer(offerData.offer);
        
        if (menuResponse.ok) {
          const menuData = await menuResponse.json();
          setMenuItems(menuData.items || []);
          setDeals(menuData.deals || []);
        }
        
      } catch (err: any) {
        console.error('Error loading offer:', err);
        setError(err.message || 'Failed to load offer');
        toast.error(err.message || 'Failed to load offer');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-500">{error || 'Offer not found'}</p>
        <button 
          onClick={() => router.push('/portal/menu?tab=offers')}
          className="text-orange-500 hover:underline"
        >
          Back to Offers
        </button>
      </div>
    );
  }
  
  return (
    <OfferFormClient 
      menuItems={menuItems}
      deals={deals}
      mode="edit"
      initialOffer={offer}
    />
  );
}
