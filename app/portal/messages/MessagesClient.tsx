'use client';

import { useState, useMemo, useCallback, useTransition } from 'react';
import {
  Mail,
  MailOpen,
  Reply,
  Search,
  MoreVertical,
  Trash2,
  Send,
  RefreshCw,
  Archive,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  MessageSquare,
  Phone,
  User,
  Clock,
  CheckCircle,
  Filter,
  ArrowUp,
  ArrowDown,
  InboxIcon,
  Star,
  Flag,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { usePortalAuth } from '@/hooks/usePortal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { ContactMessageServer, ContactMessageStatsServer } from '@/lib/server-queries';
import {
  updateContactMessageStatusAction,
  updateContactMessagePriorityAction,
  replyToContactMessageAction,
  bulkDeleteContactMessagesAction,
  bulkUpdateContactStatusAction,
} from '@/lib/actions';

// Types
type MessageStatus = 'unread' | 'read' | 'replied' | 'archived';
type StatusFilter = MessageStatus | 'all';
type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';
type SortBy = 'recent' | 'oldest' | 'priority';

interface MessagesClientProps {
  initialMessages: ContactMessageServer[];
  initialStats: ContactMessageStatsServer | null;
  initialTotalCount: number;
  initialHasMore: boolean;
}

// Reply Templates
const REPLY_TEMPLATES = [
  { id: 'thank', name: 'Thank You', text: 'Thank you for reaching out to us! We appreciate your message and value your feedback. If you have any other questions, please don\'t hesitate to contact us.' },
  { id: 'received', name: 'Message Received', text: 'We have received your message and our team is looking into it. We will get back to you with a detailed response within 24-48 hours.' },
  { id: 'apology', name: 'Apology', text: 'We sincerely apologize for any inconvenience caused. Your satisfaction is our priority, and we are working to resolve this issue as quickly as possible.' },
  { id: 'followup', name: 'Follow-up', text: 'Thank you for following up. We are still working on your request and will update you as soon as we have more information.' },
  { id: 'resolved', name: 'Issue Resolved', text: 'We are pleased to inform you that your issue has been resolved. Thank you for your patience. Please let us know if there\'s anything else we can help with.' },
];

// Status Badge Component
function StatusBadge({ status }: { status: StatusFilter }) {
  const configs: Record<StatusFilter, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: any; label: string }> = {
    unread: { variant: 'default', icon: Mail, label: 'Unread' },
    read: { variant: 'secondary', icon: MailOpen, label: 'Read' },
    replied: { variant: 'outline', icon: CheckCircle, label: 'Replied' },
    archived: { variant: 'secondary', icon: Archive, label: 'Archived' },
    all: { variant: 'outline', icon: InboxIcon, label: 'All' },
  };

  const config = configs[status] || configs.read;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

// Priority Badge Component
function PriorityBadge({ priority }: { priority: MessagePriority }) {
  const configs: Record<MessagePriority, { color: string; label: string }> = {
    low: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', label: 'Low' },
    normal: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Normal' },
    high: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', label: 'High' },
    urgent: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Urgent' },
  };

  const config = configs[priority] || configs.normal;

  return (
    <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', config.color)}>
      {config.label}
    </span>
  );
}

// Stats Overview Component
function StatsOverview({ stats }: { stats: ContactMessageStatsServer | null }) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <InboxIcon className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
              <Mail className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.unread}</p>
              <p className="text-xs text-muted-foreground">Unread</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.replied}</p>
              <p className="text-xs text-muted-foreground">Replied</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.urgent + stats.high_priority}</p>
              <p className="text-xs text-muted-foreground">High Priority</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="hidden lg:block">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Clock className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.avg_response_time_hours || '-'}h</p>
              <p className="text-xs text-muted-foreground">Avg Response</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Message Card Component
function MessageCard({
  message,
  isSelected,
  onSelect,
  onView,
  onReply,
  onUpdateStatus,
  onUpdatePriority,
  onDelete,
  isAdmin,
}: {
  message: ContactMessageServer;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onView: () => void;
  onReply: () => void;
  onUpdateStatus: (status: MessageStatus) => void;
  onUpdatePriority: (priority: MessagePriority) => void;
  onDelete: () => void;
  isAdmin: boolean;
}) {
  const timeAgo = useMemo(() => {
    const date = new Date(message.created_at);
    const diffMins = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }, [message.created_at]);

  const truncatedMessage = message.message.length > 150 
    ? message.message.substring(0, 150) + '...' 
    : message.message;

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Don't trigger view if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button, [role="menuitem"], [role="checkbox"], [data-state]')) return;
    onView();
  }, [onView]);

  return (
    <Card 
      onClick={handleCardClick}
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary',
        message.status === 'unread' && 'border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10',
        message.priority === 'urgent' && 'border-l-4 border-l-red-500',
        message.priority === 'high' && message.status !== 'unread' && 'border-l-4 border-l-orange-500',
        message.status === 'archived' && 'opacity-60'
      )}
    >
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <Checkbox 
            checked={isSelected} 
            onCheckedChange={onSelect}
          />
          
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className={cn(
              message.priority === 'urgent' && 'bg-red-100 text-red-700',
              message.priority === 'high' && 'bg-orange-100 text-orange-700'
            )}>
              {message.name[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn(
                  'font-medium truncate',
                  message.status === 'unread' && 'font-bold'
                )}>
                  {message.name}
                </span>
                <StatusBadge status={message.status} />
                <PriorityBadge priority={message.priority} />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{timeAgo}</span>
            </div>
            
            {message.subject && (
              <p className="text-sm font-medium text-muted-foreground mb-1">{message.subject}</p>
            )}
            
            <p className="text-sm text-muted-foreground line-clamp-2">{truncatedMessage}</p>
            
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {message.email}
              </span>
              {message.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {message.phone}
                </span>
              )}
              {message.customer && (
                <Badge variant="outline" className="text-xs">
                  <User className="h-3 w-3 mr-1" />
                  Customer ({message.customer.total_orders} orders)
                </Badge>
              )}
            </div>
            
            {message.status === 'replied' && message.replied_at && (
              <div className="mt-2 p-2 rounded bg-green-50 dark:bg-green-900/20 text-xs">
                <span className="text-green-600 dark:text-green-400">
                  Replied {new Date(message.replied_at).toLocaleString()} 
                  {message.replied_by && ` by ${message.replied_by.name}`}
                </span>
              </div>
            )}
          </div>
          
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50">
              <DropdownMenuItem onSelect={() => setTimeout(onView, 0)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTimeout(onReply, 0)}>
                <Reply className="h-4 w-4 mr-2" />
                Reply
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onUpdateStatus('read')} disabled={message.status === 'read'}>
                <MailOpen className="h-4 w-4 mr-2" />
                Mark as Read
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onUpdateStatus('unread')} disabled={message.status === 'unread'}>
                <Mail className="h-4 w-4 mr-2" />
                Mark as Unread
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onUpdateStatus('archived')}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onUpdatePriority('urgent')}>
                <Flag className="h-4 w-4 mr-2 text-red-500" />
                Mark Urgent
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onUpdatePriority('high')}>
                <Flag className="h-4 w-4 mr-2 text-orange-500" />
                Mark High Priority
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onUpdatePriority('normal')}>
                <Flag className="h-4 w-4 mr-2" />
                Normal Priority
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setTimeout(onDelete, 0)} className="text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

// Reply Dialog Component
function ReplyDialog({
  open,
  onOpenChange,
  message,
  onSendReply,
  replierName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ContactMessageServer | null;
  onSendReply: (reply: string, sendVia: 'email' | 'phone' | 'both') => Promise<void>;
  replierName: string;
}) {
  const [replyText, setReplyText] = useState('');
  const [sendVia, setSendVia] = useState<'email' | 'phone' | 'both'>('email');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!replyText.trim()) {
      toast.error('Please enter a reply message');
      return;
    }
    
    setIsSending(true);
    try {
      await onSendReply(replyText.trim(), sendVia);
      setReplyText('');
      onOpenChange(false);
    } finally {
      setIsSending(false);
    }
  };

  const applyTemplate = (templateText: string) => {
    setReplyText(templateText);
  };

  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Reply className="h-5 w-5" />
            Reply to {message.name}
          </DialogTitle>
          <DialogDescription>
            Send a reply to <strong>{message.email}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Original Message */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 mb-2 text-sm">
              <Avatar className="h-6 w-6">
                <AvatarFallback>{message.name[0]}</AvatarFallback>
              </Avatar>
              <span className="font-medium">{message.name}</span>
              <span className="text-muted-foreground">
                {new Date(message.created_at).toLocaleString()}
              </span>
            </div>
            {message.subject && (
              <p className="text-sm font-medium mb-1">Subject: {message.subject}</p>
            )}
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{message.message}</p>
          </div>
          
          {/* Reply Templates */}
          <div className="space-y-2">
            <Label className="text-sm">Quick Templates</Label>
            <div className="flex flex-wrap gap-2">
              {REPLY_TEMPLATES.map((template) => (
                <Button
                  key={template.id}
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(template.text)}
                >
                  {template.name}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Reply Input */}
          <div className="space-y-2">
            <Label htmlFor="reply">Your Reply</Label>
            <Textarea
              id="reply"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your reply here..."
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Signed as: {replierName}
            </p>
          </div>
          
          {/* Send Via */}
          <div className="space-y-2">
            <Label>Send Via</Label>
            <Select value={sendVia} onValueChange={(v) => setSendVia(v as typeof sendVia)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email Only</SelectItem>
                {message.phone && <SelectItem value="phone">Phone Only (Log only)</SelectItem>}
                {message.phone && <SelectItem value="both">Both Email & Phone</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !replyText.trim()}>
            {isSending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Reply
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Message Detail Dialog
function MessageDetailDialog({
  open,
  onOpenChange,
  message,
  onReply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ContactMessageServer | null;
  onReply: () => void;
}) {
  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Message from {message.name}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <StatusBadge status={message.status} />
            <PriorityBadge priority={message.priority} />
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Sender Info */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>{message.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1 text-sm">
                  <p className="font-medium text-base">{message.name}</p>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${message.email}`} className="hover:underline text-primary">{message.email}</a>
                  </p>
                  {message.phone && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <a href={`tel:${message.phone}`} className="hover:underline text-primary">{message.phone}</a>
                    </p>
                  )}
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              
              {message.customer && (
                <div className="mt-3 p-2 rounded bg-muted/50 text-sm">
                  <span className="font-medium">Registered Customer:</span>
                  <span className="ml-2">{message.customer.name}</span>
                  <Badge variant="outline" className="ml-2">
                    {message.customer.total_orders} orders
                  </Badge>
                  {message.customer.is_verified && (
                    <Badge variant="secondary" className="ml-1">Verified</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Message Content */}
          <div className="space-y-2">
            {message.subject && (
              <div>
                <Label className="text-muted-foreground">Subject</Label>
                <p className="font-medium">{message.subject}</p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">Message</Label>
              <div className="mt-1 p-4 rounded-lg bg-muted/30 border whitespace-pre-wrap">
                {message.message}
              </div>
            </div>
          </div>
          
          {/* Reply Section */}
          {message.status === 'replied' && message.reply_message && (
            <div className="space-y-2">
              <Label className="text-green-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Reply Sent
              </Label>
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="text-sm text-muted-foreground mb-2">
                  {message.replied_by && `By ${message.replied_by.name} • `}
                  {message.replied_at && new Date(message.replied_at).toLocaleString()}
                  {message.reply_sent_via && ` • via ${message.reply_sent_via}`}
                </div>
                <p className="whitespace-pre-wrap">{message.reply_message}</p>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {message.status !== 'replied' && (
            <Button onClick={onReply}>
              <Reply className="h-4 w-4 mr-2" />
              Reply
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Component
export default function MessagesClient({
  initialMessages,
  initialStats,
  initialTotalCount,
  initialHasMore,
}: MessagesClientProps) {
  const router = useRouter();
  const { employee, role, isLoading } = usePortalAuth();
  const [isPending, startTransition] = useTransition();
  
  // State
  const [messages, setMessages] = useState(initialMessages);
  const [stats, setStats] = useState(initialStats);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessageServer | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showReplyDialog, setShowReplyDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Derived state
  const isUserAdmin = role === 'admin';
  const isUserManager = role === 'manager' || isUserAdmin;

  // Filter and sort messages
  const filteredMessages = useMemo(() => {
    let filtered = [...messages];
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => m.status === statusFilter);
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query) ||
        m.message.toLowerCase().includes(query) ||
        m.subject?.toLowerCase().includes(query) ||
        m.phone?.includes(query)
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'priority') {
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return 0;
    });
    
    return filtered;
  }, [messages, statusFilter, searchQuery, sortBy]);

  // Handlers
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [router]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredMessages.map(m => m.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [filteredMessages]);

  const handleSelectMessage = useCallback((id: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleUpdateStatus = useCallback(async (messageId: string, newStatus: MessageStatus) => {
    startTransition(async () => {
      const result = await updateContactMessageStatusAction(messageId, newStatus);
      if (result.success) {
        setMessages(prev => prev.map(m => 
          m.id === messageId ? { ...m, status: newStatus as ContactMessageServer['status'] } : m
        ));
        toast.success(`Message marked as ${newStatus}`);
      } else {
        toast.error(result.error || 'Failed to update status');
      }
    });
  }, []);

  const handleUpdatePriority = useCallback(async (messageId: string, newPriority: MessagePriority) => {
    startTransition(async () => {
      const result = await updateContactMessagePriorityAction(messageId, newPriority);
      if (result.success) {
        setMessages(prev => prev.map(m => 
          m.id === messageId ? { ...m, priority: newPriority } : m
        ));
        toast.success(`Priority updated to ${newPriority}`);
      } else {
        toast.error(result.error || 'Failed to update priority');
      }
    });
  }, []);

  const handleReply = useCallback(async (replyText: string, sendVia: 'email' | 'phone' | 'both') => {
    if (!selectedMessage || !employee) return;
    
    const result = await replyToContactMessageAction(
      selectedMessage.id,
      replyText,
      employee.id,
      employee.name,
      selectedMessage.message,
      selectedMessage.subject,
      sendVia
    );
    
    if (result.success) {
      setMessages(prev => prev.map(m => 
        m.id === selectedMessage.id ? { 
          ...m, 
          status: 'replied' as const,
          reply_message: replyText,
          replied_at: new Date().toISOString(),
          replied_by: { id: employee.id, name: employee.name, role: employee.role }
        } : m
      ));
      
      if (result.emailSent) {
        toast.success('Reply sent successfully via email!');
      } else {
        toast.success('Reply saved. Email sending may have failed.');
      }
    } else {
      toast.error(result.error || 'Failed to send reply');
    }
  }, [selectedMessage, employee]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    
    startTransition(async () => {
      const result = await bulkDeleteContactMessagesAction(Array.from(selectedIds));
      if (result.success) {
        setMessages(prev => prev.filter(m => !selectedIds.has(m.id)));
        setSelectedIds(new Set());
        setShowDeleteDialog(false);
        toast.success(`${result.deletedCount} message(s) deleted`);
      } else {
        toast.error(result.error || 'Failed to delete messages');
      }
    });
  }, [selectedIds]);

  const handleBulkStatusUpdate = useCallback(async (status: MessageStatus) => {
    if (selectedIds.size === 0) return;
    
    startTransition(async () => {
      const result = await bulkUpdateContactStatusAction(Array.from(selectedIds), status);
      if (result.success) {
        setMessages(prev => prev.map(m => 
          selectedIds.has(m.id) ? { ...m, status: status as ContactMessageServer['status'] } : m
        ));
        setSelectedIds(new Set());
        toast.success(`${result.updatedCount} message(s) updated`);
      } else {
        toast.error(result.error || 'Failed to update messages');
      }
    });
  }, [selectedIds]);

  const handleViewMessage = useCallback((message: ContactMessageServer) => {
    setSelectedMessage(message);
    setShowDetailDialog(true);
    
    // Mark as read if unread
    if (message.status === 'unread') {
      handleUpdateStatus(message.id, 'read');
    }
  }, [handleUpdateStatus]);

  const handleOpenReply = useCallback((message: ContactMessageServer) => {
    setSelectedMessage(message);
    setShowReplyDialog(true);
  }, []);

  // Auth check
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isUserManager) {
    return (
      <Card className="max-w-md mx-auto mt-20">
        <CardHeader>
          <CardTitle className="text-red-600">Access Denied</CardTitle>
          <CardDescription>
            Only admins and managers can access the messages page.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="h-7 w-7" />
            Contact Messages
          </h1>
          <p className="text-muted-foreground">
            Manage customer inquiries and feedback
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <StatsOverview stats={stats} />

      {/* Filters & Actions */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full lg:w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Messages</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="replied">Replied</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Sort */}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-full lg:w-[140px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">
                  <span className="flex items-center gap-2">
                    <ArrowDown className="h-4 w-4" /> Recent First
                  </span>
                </SelectItem>
                <SelectItem value="oldest">
                  <span className="flex items-center gap-2">
                    <ArrowUp className="h-4 w-4" /> Oldest First
                  </span>
                </SelectItem>
                <SelectItem value="priority">
                  <span className="flex items-center gap-2">
                    <Flag className="h-4 w-4" /> Priority
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-muted/50 rounded-lg">
              <Checkbox 
                checked={selectedIds.size === filteredMessages.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Separator orientation="vertical" className="h-6 mx-2" />
              <Button size="sm" variant="outline" onClick={() => handleBulkStatusUpdate('read')}>
                <MailOpen className="h-4 w-4 mr-1" />
                Mark Read
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkStatusUpdate('archived')}>
                <Archive className="h-4 w-4 mr-1" />
                Archive
              </Button>
              {isUserAdmin && (
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Messages List */}
      <div className="space-y-3">
        {filteredMessages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <InboxIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No messages found</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== 'all' 
                  ? 'Try adjusting your filters'
                  : 'No contact messages yet'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredMessages.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              isSelected={selectedIds.has(message.id)}
              onSelect={(selected) => handleSelectMessage(message.id, selected)}
              onView={() => handleViewMessage(message)}
              onReply={() => handleOpenReply(message)}
              onUpdateStatus={(status) => handleUpdateStatus(message.id, status)}
              onUpdatePriority={(priority) => handleUpdatePriority(message.id, priority)}
              onDelete={() => {
                setSelectedIds(new Set([message.id]));
                setShowDeleteDialog(true);
              }}
              isAdmin={isUserAdmin}
            />
          ))
        )}
      </div>

      {/* Message Detail Dialog */}
      <MessageDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        message={selectedMessage}
        onReply={() => {
          setShowDetailDialog(false);
          setShowReplyDialog(true);
        }}
      />

      {/* Reply Dialog */}
      <ReplyDialog
        open={showReplyDialog}
        onOpenChange={setShowReplyDialog}
        message={selectedMessage}
        onSendReply={handleReply}
        replierName={employee?.name || 'Staff'}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} message(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected messages will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
