'use client';

import { motion } from 'framer-motion';
import { 
  CheckCircle, Copy, Mail, Users, Plus, 
  PartyPopper, Key, Download, Sparkles 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { EmployeeFormData, ROLE_LABELS, ROLE_COLORS } from './employee-form-utils';
import { useEffect, useState } from 'react';

// CSS-based confetti without external dependency
function Confetti() {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; color: string; delay: number }>>([]);
  
  useEffect(() => {
    const colors = ['#C8102E', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'];
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 2,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute w-3 h-3 rounded-sm"
          style={{ 
            left: `${p.x}%`, 
            top: '-10px',
            backgroundColor: p.color,
          }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ 
            y: window.innerHeight + 100, 
            opacity: 0,
            rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
            x: [0, (Math.random() - 0.5) * 200],
          }}
          transition={{ 
            duration: 3 + Math.random() * 2,
            delay: p.delay,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

interface SuccessStepProps {
  data: EmployeeFormData;
  employeeId: string;
  licenseId: string;
  onAddAnother: () => void;
  onViewEmployees: () => void;
}

export function SuccessStep({ 
  data, 
  employeeId, 
  licenseId, 
  onAddAnother, 
  onViewEmployees 
}: SuccessStepProps) {
  const [showConfetti, setShowConfetti] = useState(true);
  
  useEffect(() => {
    // Hide confetti after animation completes
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const copyAllDetails = () => {
    const details = `
Employee Created Successfully!
-----------------------------
Name: ${data.full_name}
Email: ${data.email}
Phone: ${data.phone}
Role: ${ROLE_LABELS[data.role]}
Employee ID: ${employeeId}
License Key: ${licenseId}

Portal Activation:
Visit: ${window.location.origin}/portal/activate
Enter License Key: ${licenseId}
    `.trim();
    
    navigator.clipboard.writeText(details);
    toast.success('All details copied to clipboard');
  };

  return (
    <div className="space-y-8">
      {/* Confetti Animation */}
      {showConfetti && <Confetti />}
      
      {/* Success Header */}
      <motion.div 
        className="text-center py-6"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
      >
        <div className="w-20 h-20 mx-auto rounded-full bg-green-500/10 flex items-center justify-center mb-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <CheckCircle className="h-10 w-10 text-green-500" />
          </motion.div>
        </div>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 flex items-center justify-center gap-2">
            <PartyPopper className="h-6 w-6" />
            Employee Created Successfully!
          </h2>
          <p className="text-muted-foreground mt-2">
            Welcome email has been sent to {data.email}
          </p>
        </motion.div>
      </motion.div>

      {/* Employee Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-2 border-green-500/50 bg-gradient-to-br from-green-500/5 to-background">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <Avatar className="h-20 w-20 border-4 border-green-500 shadow-lg">
                <AvatarImage src={data.photo_url || undefined} />
                <AvatarFallback className="text-2xl bg-green-500 text-white">
                  {data.full_name?.charAt(0)?.toUpperCase() || 'E'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl font-bold">{data.full_name}</h3>
                <p className="text-muted-foreground">{data.email}</p>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                  <Badge className={ROLE_COLORS[data.role]}>{ROLE_LABELS[data.role]}</Badge>
                  <Badge variant="outline" className="font-mono">{employeeId}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Credentials Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-2 border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Key className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Activation Credentials</h3>
            </div>
            
            <div className="space-y-4">
              {/* Employee ID */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div>
                  <p className="text-xs text-muted-foreground">Employee ID</p>
                  <p className="font-mono font-bold text-lg">{employeeId}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(employeeId, 'Employee ID')}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy
                </Button>
              </div>

              {/* License Key */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/30">
                <div>
                  <p className="text-xs text-muted-foreground">License Key</p>
                  <p className="font-mono font-bold text-lg text-primary">{licenseId}</p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => copyToClipboard(licenseId, 'License Key')}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy
                </Button>
              </div>
            </div>

            <Separator className="my-4" />

            <Button 
              variant="outline" 
              className="w-full"
              onClick={copyAllDetails}
            >
              <Download className="h-4 w-4 mr-2" /> Copy All Details
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Email Info */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30"
      >
        <div className="flex gap-3">
          <Mail className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-700 dark:text-blue-400">
              Welcome Email Sent
            </p>
            <p className="text-muted-foreground mt-1">
              An email has been sent to <strong>{data.email}</strong> with:
            </p>
            <ul className="list-disc list-inside mt-2 text-muted-foreground space-y-1">
              <li>Their employee ID and license key</li>
              <li>Instructions to activate their portal account</li>
              <li>Role and permissions information</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <Button 
          variant="outline" 
          className="flex-1"
          onClick={onAddAnother}
        >
          <Plus className="h-4 w-4 mr-2" /> Add Another Employee
        </Button>
        <Button 
          className="flex-1"
          onClick={onViewEmployees}
        >
          <Users className="h-4 w-4 mr-2" /> View All Employees
        </Button>
      </motion.div>
    </div>
  );
}
