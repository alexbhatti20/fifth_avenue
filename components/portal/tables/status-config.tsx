'use client';

import { CheckCircle, Users, Clock, RefreshCw, XCircle } from 'lucide-react';
import type { TableStatus } from '@/types/portal';

// ==========================================
// STATUS CONFIGURATION
// ==========================================

export const STATUS_CONFIG: Record<
  TableStatus,
  {
    color: string;
    bgColor: string;
    gradientFrom: string;
    gradientTo: string;
    label: string;
    icon: React.ReactNode;
  }
> = {
  available: {
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-green-600',
    label: 'Available',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  occupied: {
    color: 'text-red-500',
    bgColor: 'bg-red-500/10 border-red-500/30',
    gradientFrom: 'from-red-500',
    gradientTo: 'to-orange-600',
    label: 'Occupied',
    icon: <Users className="h-4 w-4" />,
  },
  reserved: {
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
    gradientFrom: 'from-amber-500',
    gradientTo: 'to-yellow-600',
    label: 'Reserved',
    icon: <Clock className="h-4 w-4" />,
  },
  cleaning: {
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
    gradientFrom: 'from-blue-500',
    gradientTo: 'to-cyan-600',
    label: 'Cleaning',
    icon: <RefreshCw className="h-4 w-4" />,
  },
  out_of_service: {
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-500/10 border-zinc-500/30',
    gradientFrom: 'from-zinc-500',
    gradientTo: 'to-gray-600',
    label: 'Out of Service',
    icon: <XCircle className="h-4 w-4" />,
  },
};
