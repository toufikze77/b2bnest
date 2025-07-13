import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Shield, Key, Mail, Eye, EyeOff } from 'lucide-react';

const AccountSettings = () => {
  const { user, updatePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading2FA, setIsLoading2FA] = useState(false);

  useEffect(() => {
    fetchUser2FASettings();
  }, [user]);

  const fetchUser2FASettings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_2fa_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching 2FA settings:', error);
        return;
      }

      if (data) {
        setIs2FAEnabled(data.is_enabled);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords don't match.",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long.",
        variant: "destructive"
      });
      return;
    }

    setIsChangingPassword(true);
    
    try {
      const { error } = await updatePassword(newPassword);
      
      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "Password updated successfully."
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update password.",
        variant: "destructive"
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSend2FACode = async () => {
    if (!user) return;
    
    setIsLoading2FA(true);
    
    try {
      // Generate a simple 6-digit code and store it locally for verification
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store code in database
      const { error: codeError } = await supabase
        .from('user_2fa_codes')
        .insert({
          user_id: user.id,
          code,
          code_type: 'setup_2fa',
          expires_at: expiresAt.toISOString()
        });

      if (codeError) throw codeError;

      // Send code via browser notification or store for demo purposes
      // For a production app, you'd integrate with a free email service
      setIsVerifying2FA(true);
      toast({
        title: "Verification Code Generated",
        description: `Your verification code is: ${code} (This is for demo - in production this would be sent via email)`
      });
    } catch (error) {
      console.error('Error generating 2FA code:', error);
      toast({
        title: "Error", 
        description: "Failed to generate verification code. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading2FA(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!user || verificationCode.length !== 6) return;
    
    setIsLoading2FA(true);
    
    try {
      // Verify the code
      const { data: codeData, error: codeError } = await supabase
        .from('user_2fa_codes')
        .select('*')
        .eq('user_id', user.id)
        .eq('code', verificationCode)
        .eq('code_type', 'setup_2fa')
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

      if (codeError || !codeData) {
        toast({
          title: "Error",
          description: "Invalid or expired verification code.",
          variant: "destructive"
        });
        return;
      }

      // Mark code as used
      await supabase
        .from('user_2fa_codes')
        .update({ used: true })
        .eq('id', codeData.id);

      // Enable 2FA
      const { error: settingsError } = await supabase
        .from('user_2fa_settings')
        .upsert({
          user_id: user.id,
          is_enabled: true,
          email_verified: true
        });

      if (settingsError) throw settingsError;

      setIs2FAEnabled(true);
      setIsVerifying2FA(false);
      setVerificationCode('');
      
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been successfully enabled."
      });
    } catch (error) {
      console.error('Error verifying 2FA:', error);
      toast({
        title: "Error",
        description: "Failed to enable 2FA. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!user) return;
    
    setIsLoading2FA(true);
    
    try {
      const { error } = await supabase
        .from('user_2fa_settings')
        .update({ is_enabled: false })
        .eq('user_id', user.id);

      if (error) throw error;

      setIs2FAEnabled(false);
      toast({
        title: "2FA Disabled",
        description: "Two-factor authentication has been disabled."
      });
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      toast({
        title: "Error",
        description: "Failed to disable 2FA. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading2FA(false);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>Please sign in to access account settings.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Password Reset Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your account password for better security
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPasswords(!showPasswords)}
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            
            <Button type="submit" disabled={isChangingPassword}>
              {isChangingPassword ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* 2FA Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account using email verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable 2FA</Label>
              <p className="text-sm text-muted-foreground">
                {is2FAEnabled 
                  ? "Two-factor authentication is currently enabled" 
                  : "Secure your account with email verification codes"
                }
              </p>
            </div>
            <Switch
              checked={is2FAEnabled}
              onCheckedChange={is2FAEnabled ? handleDisable2FA : handleSend2FACode}
              disabled={isLoading2FA}
            />
          </div>

          {isVerifying2FA && (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                Verification code generated (check the notification above)
              </div>
              
              <div className="space-y-2">
                <Label>Enter 6-digit verification code</Label>
                <InputOTP
                  maxLength={6}
                  value={verificationCode}
                  onChange={setVerificationCode}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={handleVerify2FA}
                  disabled={verificationCode.length !== 6 || isLoading2FA}
                >
                  {isLoading2FA ? "Verifying..." : "Verify & Enable 2FA"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsVerifying2FA(false);
                    setVerificationCode('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {is2FAEnabled && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✓ Two-factor authentication is active. You'll receive verification codes via email when signing in.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountSettings;