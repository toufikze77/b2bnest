import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { TWO_STEP_STATUS, TWO_STEP_NOT_ACTIVE, TWO_STEP_COMING_SOON } from '@/lib/twoStep';
import { useUserSettings } from '@/hooks/useUserSettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Shield, Key, Eye, EyeOff, Globe, Clock, DollarSign, Calendar, MessageSquare, Lightbulb } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';
import FeedbackForm from '@/components/FeedbackForm';
import { CURRENCIES } from '@/utils/currencyUtils';
import { COUNTRIES, LANGUAGES, TIMEZONES, DATE_FORMATS, TIME_FORMATS, UserSettings } from '@/utils/userSettingsUtils';

const AccountSettings = () => {
  const { user, updatePassword } = useAuth();
  // Saving goes through the shared settings context so every screen picks up the new currency at once.
  const { updateSettings: saveSharedSettings } = useUserSettings();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  

  // User Settings State
  const [userSettings, setUserSettings] = useState<UserSettings>({
    // Empty until the profile loads: the picker shows "Select currency" rather than pretending USD is saved.
    currency_code: '',
    timezone: 'UTC',
    country_code: 'US',
    language_code: 'en',
    date_format: 'MM/DD/YYYY',
    time_format: '12h'
  });
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  useEffect(() => {
    fetchUserSettings();
    fetchAvatar();
  }, [user]);

  const fetchAvatar = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    if (data?.avatar_url) setAvatarUrl(data.avatar_url);
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
          currency_code: data.currency_code || '',
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
      // Writes to profiles and updates the shared context (throws on failure).
      await saveSharedSettings(newSettings);

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
    <Tabs defaultValue="account" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
        <TabsTrigger value="preferences">Preferences</TabsTrigger>
        <TabsTrigger value="feedback">Feedback</TabsTrigger>
      </TabsList>

      <TabsContent value="account" className="space-y-6">
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
                    .upsert({ id: user.id, email: user.email, avatar_url: url }, { onConflict: 'id' });

                  if (error) {
                    console.error('Error updating avatar:', error);
                    toast({
                      title: "Error",
                      description: "Failed to update profile picture. Please try again.",
                      variant: "destructive"
                    });
                    return;
                  }

                  setAvatarUrl(url);
                  window.dispatchEvent(new CustomEvent('profile-avatar-updated', { detail: { userId: user.id, url } }));
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
              currentImageUrl={avatarUrl}
              label="Profile Picture"
              maxSize={2}
            />

          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="security" className="space-y-6">
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

        {/* Two-step sign-in: not enforced at sign-in yet, so it cannot be switched on here (src/lib/twoStep.ts). */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Two-step sign-in
            </CardTitle>
            <CardDescription>{TWO_STEP_NOT_ACTIVE}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="two-step-switch">Turn on two-step sign-in</Label>
                <p className="text-sm text-muted-foreground">{TWO_STEP_COMING_SOON}</p>
              </div>
              <Switch id="two-step-switch" checked={false} disabled aria-describedby="two-step-note" />
            </div>
            <p id="two-step-note" className="text-sm text-muted-foreground">{TWO_STEP_STATUS}.</p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="preferences" className="space-y-6">
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
            {/* ... keep existing code ... */}
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
      </TabsContent>

      <TabsContent value="feedback" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FeedbackForm type="feedback" />
          <FeedbackForm type="feature_request" />
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default AccountSettings;