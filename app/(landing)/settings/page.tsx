"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Lock,
  Shield,
  Bell,
  Save,
  ArrowLeft,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { isMobile } from "@/lib/utils";
import Navbar from "@/components/custom/Navbar";
import Footer from "@/components/custom/Footer";

const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  
  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  // OTP for password change
  const [otpStep, setOtpStep] = useState<"password" | "otp" | "success">("password");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  
  // 2FA state
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [is2FALoading, setIs2FALoading] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
    }
    setIsMobileDevice(isMobile());
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || "",
        phone: user.phone || "",
        address: user.address || "",
      });
      setIs2FAEnabled(user.is_2fa_enabled || false);
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsProfileLoading(true);
    try {
      // Use RPC for optimized update with validation
      const { data, error } = await supabase.rpc("update_customer_profile", {
        p_customer_id: user.id,
        p_name: profileData.name || null,
        p_phone: profileData.phone || null,
        p_address: profileData.address || null
      });

      if (error) throw error;
      
      const result = data?.[0];
      if (result && !result.success) {
        throw new Error(result.error_message);
      }

      // Update localStorage with new user data
      const updatedUser = {
        ...user,
        name: profileData.name || user.name,
        phone: profileData.phone || user.phone,
        address: profileData.address || user.address,
      };
      localStorage.setItem('user_data', JSON.stringify(updatedUser));

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handleSendPasswordOTP = async () => {
    if (!user) return;

    // Validate passwords
    if (passwordData.newPassword.length < 8) {
      toast({
        title: "Weak Password",
        description: "New password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setIsPasswordLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/send-password-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setOtpSent(true);
      setOtpStep("otp");
      toast({
        title: "OTP Sent",
        description: "Check your email for the verification code.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleVerifyPasswordOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsPasswordLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          otp,
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      setOtpStep("success");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setOtp("");
      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully.",
      });

      // Reset after 2 seconds
      setTimeout(() => {
        setOtpStep("password");
        setOtpSent(false);
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleToggle2FA = async () => {
    if (!user) return;

    setIs2FALoading(true);
    try {
      const { error } = await supabase
        .from("customers")
        .update({ is_2fa_enabled: !is2FAEnabled })
        .eq("id", user.id);

      if (error) throw error;

      setIs2FAEnabled(!is2FAEnabled);
      toast({
        title: is2FAEnabled ? "2FA Disabled" : "2FA Enabled",
        description: is2FAEnabled
          ? "Two-factor authentication has been disabled."
          : "Two-factor authentication has been enabled.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update 2FA setting",
        variant: "destructive",
      });
    } finally {
      setIs2FALoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-16 bg-gradient-to-b from-background to-secondary/20">
        <div className="container-custom max-w-2xl">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            />
            <div className="relative z-10">
              <h1 className="text-3xl font-bold mb-2">Settings</h1>
              <p className="text-muted-foreground">Manage your account settings</p>
            </div>
          </motion.div>

          {/* Settings Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 rounded-xl h-12 bg-gradient-to-r from-secondary/80 to-secondary shadow-md">
                <TabsTrigger value="profile" className="rounded-lg">
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="security" className="rounded-lg">
                  <Lock className="h-4 w-4 mr-2" />
                  Security
                </TabsTrigger>
                <TabsTrigger value="notifications" className="rounded-lg">
                  <Bell className="h-4 w-4 mr-2" />
                  Alerts
                </TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile">
                <motion.div 
                  className="bg-gradient-to-br from-card via-card to-primary/5 rounded-2xl border shadow-lg p-6 relative overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={!isMobileDevice ? { scale: 1.01, boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)" } : {}}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
                  <h2 className="text-lg font-semibold mb-6 relative z-10">Personal Information</h2>
                  <form onSubmit={handleProfileUpdate} className="space-y-4 relative z-10">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          value={user?.email || ""}
                          disabled
                          className="pl-10 bg-secondary/50"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Email cannot be changed
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="name"
                          value={profileData.name}
                          onChange={(e) =>
                            setProfileData({ ...profileData, name: e.target.value })
                          }
                          className="pl-10"
                          placeholder="Your full name"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          value={profileData.phone}
                          onChange={(e) =>
                            setProfileData({ ...profileData, phone: e.target.value })
                          }
                          className="pl-10"
                          placeholder="+92 300 1234567"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Delivery Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <textarea
                          id="address"
                          value={profileData.address}
                          onChange={(e) =>
                            setProfileData({ ...profileData, address: e.target.value })
                          }
                          className="w-full min-h-[100px] pl-10 pt-2 pr-4 pb-2 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Your delivery address"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full rounded-xl"
                      disabled={isProfileLoading}
                    >
                      {isProfileLoading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </form>
                </motion.div>
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security" className="space-y-6">
                {/* Change Password */}
                <motion.div 
                  className="bg-gradient-to-br from-card via-card to-red-500/5 rounded-2xl border shadow-lg p-6 relative overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={!isMobileDevice ? { scale: 1.01, boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)" } : {}}
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/10 rounded-full blur-3xl" />
                  <h2 className="text-lg font-semibold mb-6 relative z-10">Change Password</h2>

                  <AnimatePresence mode="wait">
                    {otpStep === "password" && (
                      <motion.div
                        key="password"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-4 relative z-10"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="currentPassword">Current Password</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="currentPassword"
                              type={showCurrentPassword ? "text" : "password"}
                              value={passwordData.currentPassword}
                              onChange={(e) =>
                                setPasswordData({
                                  ...passwordData,
                                  currentPassword: e.target.value,
                                })
                              }
                              className="pl-10 pr-10"
                              placeholder="Enter current password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showCurrentPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="newPassword">New Password</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="newPassword"
                              type={showNewPassword ? "text" : "password"}
                              value={passwordData.newPassword}
                              onChange={(e) =>
                                setPasswordData({
                                  ...passwordData,
                                  newPassword: e.target.value,
                                })
                              }
                              className="pl-10 pr-10"
                              placeholder="Enter new password (min 8 chars)"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showNewPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword">Confirm New Password</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="confirmPassword"
                              type="password"
                              value={passwordData.confirmPassword}
                              onChange={(e) =>
                                setPasswordData({
                                  ...passwordData,
                                  confirmPassword: e.target.value,
                                })
                              }
                              className="pl-10"
                              placeholder="Confirm new password"
                            />
                          </div>
                        </div>

                        <Button
                          type="button"
                          onClick={handleSendPasswordOTP}
                          className="w-full rounded-xl"
                          disabled={
                            isPasswordLoading ||
                            !passwordData.currentPassword ||
                            !passwordData.newPassword ||
                            !passwordData.confirmPassword
                          }
                        >
                          {isPasswordLoading ? (
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4 mr-2" />
                          )}
                          Send OTP to Verify
                        </Button>
                      </motion.div>
                    )}

                    {otpStep === "otp" && (
                      <motion.form
                        key="otp"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        onSubmit={handleVerifyPasswordOTP}
                        className="space-y-4"
                      >
                        <div className="bg-blue-500/10 text-blue-500 p-4 rounded-xl text-sm">
                          <AlertCircle className="h-4 w-4 inline mr-2" />
                          OTP sent to {user?.email}. Valid for 2 minutes.
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="otp">Enter OTP</Label>
                          <Input
                            id="otp"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="text-center text-2xl tracking-widest"
                            placeholder="000000"
                            maxLength={6}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setOtpStep("password");
                              setOtp("");
                            }}
                            className="flex-1 rounded-xl"
                          >
                            Back
                          </Button>
                          <Button
                            type="submit"
                            className="flex-1 rounded-xl"
                            disabled={isPasswordLoading || otp.length !== 6}
                          >
                            {isPasswordLoading ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-2" />
                            )}
                            Verify & Change
                          </Button>
                        </div>
                      </motion.form>
                    )}

                    {otpStep === "success" && (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-8"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", delay: 0.2 }}
                          className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
                        >
                          <CheckCircle className="w-8 h-8 text-green-500" />
                        </motion.div>
                        <h3 className="text-xl font-semibold mb-2">Password Changed!</h3>
                        <p className="text-muted-foreground">
                          Your password has been updated successfully.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* 2FA Settings */}
                <motion.div 
                  className="bg-gradient-to-br from-card via-card to-green-500/5 rounded-2xl border shadow-lg p-6 relative overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={!isMobileDevice ? { scale: 1.02, boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)" } : {}}
                  transition={{ delay: 0.1 }}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl" />
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Shield className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Two-Factor Authentication</h3>
                        <p className="text-sm text-muted-foreground">
                          Add extra security with OTP on login
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={is2FAEnabled}
                      onCheckedChange={handleToggle2FA}
                      disabled={is2FALoading}
                    />
                  </div>
                </motion.div>
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications">
                <motion.div 
                  className="bg-gradient-to-br from-card via-card to-blue-500/5 rounded-2xl border shadow-lg p-6 relative overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={!isMobileDevice ? { scale: 1.01, boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)" } : {}}
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />
                  <h2 className="text-lg font-semibold mb-6 relative z-10">Notification Preferences</h2>
                  <div className="space-y-4 relative z-10">
                    {[
                      {
                        title: "Order Updates",
                        description: "Get notified about order status changes",
                        defaultChecked: true,
                      },
                      {
                        title: "Promotional Offers",
                        description: "Receive special deals and discounts",
                        defaultChecked: true,
                      },
                      {
                        title: "Loyalty Rewards",
                        description: "Updates about your loyalty points",
                        defaultChecked: true,
                      },
                      {
                        title: "New Menu Items",
                        description: "Be the first to know about new dishes",
                        defaultChecked: false,
                      },
                    ].map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-3 border-b last:border-0"
                      >
                        <div>
                          <h4 className="font-medium">{item.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                        <Switch defaultChecked={item.defaultChecked} />
                      </div>
                    ))}
                  </div>
                </motion.div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </main>
      <Footer />
    </>
  );
}
