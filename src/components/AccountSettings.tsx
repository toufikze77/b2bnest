import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Shield, Key, Mail, Eye, EyeOff, Globe, Clock, DollarSign, Calendar } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';
import { CURRENCIES } from '@/utils/currencyUtils';
import { COUNTRIES, LANGUAGES, TIMEZONES, DATE_FORMATS, TIME_FORMATS, UserSettings } from '@/utils/userSettingsUtils';

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

  // User Settings State
  const [userSettings, setUserSettings] = useState<UserSettings>({
    currency_code: 'USD',
    timezone: 'UTC',
    country_code: 'US',
    language_code: 'en',
    date_format: 'MM/DD/YYYY',
    time_format: '12h'
  });
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  useEffect(() => {
    fetchUser2FASettings();
    fetchUserSettings();
  }, [user]);

  const fetchUser2FASettings = async () => {
    if (!user) {
      console.log('No user found for 2FA settings fetch');
      return;
    }
    
    console.log('Fetching 2FA settings for user:', user.id);
    
    try {
      const { data, error } = await supabase
        .from('user_2fa_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('2FA settings fetch result:', { data, error });

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching 2FA settings:', error);
        toast({
          title: "Error",
          description: "Failed to load 2FA settings. Please refresh the page.",
          variant: "destructive"
        });
        return;
      }

      if (data) {
        console.log('Setting 2FA enabled to:', data.is_enabled);
        setIs2FAEnabled(data.is_enabled);
      } else {
        console.log('No 2FA settings found, defaulting to disabled');
        setIs2FAEnabled(false);
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to load 2FA settings. Please refresh the page.",
        variant: "destructive"
      });
    }
  };

  const fetchUserSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('currency_code, timezone, country_code, language_code, date_format, time_format')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user settings:', error);
        return;
      }

      if (data) {
        setUserSettings({
          currency_code: data.currency_code || 'USD',
          timezone: data.timezone || 'UTC',
          country_code: data.country_code || 'US',
          language_code: data.language_code || 'en',
          date_format: data.date_format || 'MM/DD/YYYY',
          time_format: data.time_format || '12h'
        });
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
    }
  };

  const updateUserSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;

    setIsUpdatingSettings(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(newSettings)
        .eq('id', user.id);

      if (error) {
        console.error('Error updating user settings:', error);
        toast({
          title: "Error",
          description: "Failed to update settings. Please try again.",
          variant: "destructive"
        });
        return;
      }

      setUserSettings(prev => ({ ...prev, ...newSettings }));
      toast({
        title: "Settings Updated",
        description: "Your preferences have been saved successfully."
      });
    } catch (error) {
      console.error('Error updating user settings:', error);
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingSettings(false);
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
    if (!user) {
      console.log('No user found for 2FA code generation');
      return;
    }
    
    console.log('Generating 2FA code for user:', user.id);
    setIsLoading2FA(true);
    
    try {
      // Generate a simple 6-digit code and store it locally for verification
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      console.log('Inserting 2FA code:', { code, user_id: user.id, expires_at: expiresAt.toISOString() });

      // Store code in database
      const { data: insertData, error: codeError } = await supabase
        .from('user_2fa_codes')
        .insert({
          user_id: user.id,
          code,
          code_type: 'setup_2fa',
          expires_at: expiresAt.toISOString()
        })
        .select();

      console.log('2FA code insert result:', { insertData, codeError });

      if (codeError) {
        console.error('Database error inserting 2FA code:', codeError);
        throw codeError;
      }

      // Send code via browser notification or store for demo purposes
      // For a production app, you'd integrate with a free email service
      setIsVerifying2FA(true);
      toast({
        title: "Verification Code Generated",
        description: `Your verification code is: ${code} (This is for demo - in production this would be sent via email)`,
        duration: 10000
      });
    } catch (error) {
      console.error('Error generating 2FA code:', error);
      toast({
        title: "Error", 
        description: `Failed to generate verification code: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading2FA(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!user || verificationCode.length !== 6) {
      console.log('Invalid verification attempt:', { user: !!user, codeLength: verificationCode.length });
      return;
    }
    
    console.log('Verifying 2FA code:', verificationCode, 'for user:', user.id);
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

      console.log('Code verification result:', { codeData, codeError });

      if (codeError || !codeData) {
        console.error('Code verification failed:', codeError);
        toast({
          title: "Error",
          description: "Invalid or expired verification code.",
          variant: "destructive"
        });
        return;
      }

      // Mark code as used
      const { error: updateError } = await supabase
        .from('user_2fa_codes')
        .update({ used: true })
        .eq('id', codeData.id);

      console.log('Code update result:', updateError);

      // Enable 2FA
      const { data: settingsData, error: settingsError } = await supabase
        .from('user_2fa_settings')
        .upsert({
          user_id: user.id,
          is_enabled: true,
          email_verified: true
        })
        .select();

      console.log('Settings upsert result:', { settingsData, settingsError });

      if (settingsError) {
        console.error('Settings update failed:', settingsError);
        throw settingsError;
      }

      setIs2FAEnabled(true);
      setIsVerifying2FA(false);
      setVerificationCode('');
      
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been successfully enabled."
      });

      // Refresh the settings
      fetchUser2FASettings();
    } catch (error) {
      console.error('Error verifying 2FA:', error);
      toast({
        title: "Error",
        description: `Failed to enable 2FA: ${error.message}`,
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
      {/* Profile Picture Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Profile Picture
          </CardTitle>
          <CardDescription>
            Upload a profile picture to personalize your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImageUpload
            onImageUploaded={async (url) => {
              try {
                const { error } = await supabase
                  .from('profiles')
                  .update({ avatar_url: url })
                  .eq('id', user.id);

                if (error) {
                  console.error('Error updating avatar:', error);
                  toast({
                    title: "Error",
                    description: "Failed to update profile picture. Please try again.",
                    variant: "destructive"
                  });
                  return;
                }

                toast({
                  title: "Success",
                  description: "Profile picture updated successfully!"
                });
              } catch (error) {
                console.error('Error updating avatar:', error);
                toast({
                  title: "Error",
                  description: "Failed to update profile picture. Please try again.",
                  variant: "destructive"
                });
              }
            }}
            bucket="user-avatars"
            userId={user.id}
            label="Profile Picture"
            maxSize={2}
          />
        </CardContent>
      </Card>
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

      <Separator />

      {/* Global Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Global Settings
          </CardTitle>
          <CardDescription>
            Configure your global preferences for currency, timezone, language, and formats
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Currency Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <Label className="text-sm font-medium">Currency & Region</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Select
                  value={userSettings.currency_code}
                  onValueChange={(value) => updateUserSettings({ currency_code: value })}
                  disabled={isUpdatingSettings}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(CURRENCIES).map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.symbol} {currency.name} ({currency.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  value={userSettings.country_code}
                  onValueChange={(value) => updateUserSettings({ country_code: value })}
                  disabled={isUpdatingSettings}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(COUNTRIES).map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.flag} {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Language & Timezone */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <Label className="text-sm font-medium">Language & Time</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  value={userSettings.language_code}
                  onValueChange={(value) => updateUserSettings({ language_code: value })}
                  disabled={isUpdatingSettings}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(LANGUAGES).map((language) => (
                      <SelectItem key={language.code} value={language.code}>
                        {language.nativeName} ({language.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={userSettings.timezone}
                  onValueChange={(value) => updateUserSettings({ timezone: value })}
                  disabled={isUpdatingSettings}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((timezone) => (
                      <SelectItem key={timezone.value} value={timezone.value}>
                        {timezone.label} ({timezone.offset})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Date & Time Formats */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <Label className="text-sm font-medium">Date & Time Formats</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-format">Date Format</Label>
                <Select
                  value={userSettings.date_format}
                  onValueChange={(value) => updateUserSettings({ date_format: value })}
                  disabled={isUpdatingSettings}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select date format" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label} - {format.example}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time-format">Time Format</Label>
                <Select
                  value={userSettings.time_format}
                  onValueChange={(value) => updateUserSettings({ time_format: value })}
                  disabled={isUpdatingSettings}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select time format" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_FORMATS.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label} - {format.example}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Settings Preview */}
          <div className="p-4 bg-muted rounded-lg">
            <Label className="text-sm font-medium mb-2 block">Preview</Label>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Current time: {new Date().toLocaleString("en-US", { 
                timeZone: userSettings.timezone,
                hour12: userSettings.time_format === '12h',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
              <p>Currency: {CURRENCIES[userSettings.currency_code as keyof typeof CURRENCIES]?.symbol}1,234.56</p>
              <p>Country: {COUNTRIES[userSettings.country_code as keyof typeof COUNTRIES]?.flag} {COUNTRIES[userSettings.country_code as keyof typeof COUNTRIES]?.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountSettings;