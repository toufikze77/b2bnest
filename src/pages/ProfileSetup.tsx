import React, { useState, useEffect } from 'react';
import { User, MapPin, Building2, Briefcase, Globe, Award, Plus, Save, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const ProfileSetup = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: '',
    headline: '',
    location: '',
    industry: '',
    company: '',
    position: '',
    bio: '',
    experience_years: '',
    skills: '',
    website: '',
    linkedin_url: '',
    twitter_url: ''
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  const industries = [
    'Technology', 'Healthcare', 'Finance', 'Education', 'Marketing',
    'Sales', 'Manufacturing', 'Retail', 'Consulting', 'Real Estate',
    'Legal', 'Media', 'Non-profit', 'Government', 'Other'
  ];

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/auth');
        return;
      }
      setUser(user);
      fetchProfile(user.id);
    });
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setProfileData({
          full_name: data.full_name || '',
          headline: data.headline || '',
          location: data.location || '',
          industry: data.industry || '',
          company: data.company || '',
          position: data.position || '',
          bio: data.bio || '',
          experience_years: data.experience_years?.toString() || '',
          skills: data.skills?.join(', ') || '',
          website: data.website || '',
          linkedin_url: data.linkedin_url || '',
          twitter_url: data.twitter_url || ''
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const skillsArray = profileData.skills
        .split(',')
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: profileData.full_name,
          headline: profileData.headline,
          location: profileData.location,
          industry: profileData.industry,
          company: profileData.company,
          position: profileData.position,
          bio: profileData.bio,
          experience_years: profileData.experience_years ? parseInt(profileData.experience_years) : null,
          skills: skillsArray,
          website: profileData.website,
          linkedin_url: profileData.linkedin_url,
          twitter_url: profileData.twitter_url,
          is_public: true
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your profile has been updated."
      });

      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getUserInitials = () => {
    const name = profileData.full_name || user?.email || 'User';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Complete Your Professional Profile</h1>
          <p className="text-gray-600 text-lg">
            Build your professional presence and connect with other business professionals
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Preview */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg">Profile Preview</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <Avatar className="w-24 h-24 mx-auto mb-4">
                  <AvatarFallback className="text-xl">{getUserInitials()}</AvatarFallback>
                </Avatar>
                
                <h3 className="font-semibold text-lg mb-1">
                  {profileData.full_name || 'Your Name'}
                </h3>
                
                {profileData.headline && (
                  <p className="text-gray-600 text-sm mb-2">{profileData.headline}</p>
                )}
                
                {profileData.company && profileData.position && (
                  <p className="text-gray-500 text-sm mb-2">
                    {profileData.position} at {profileData.company}
                  </p>
                )}
                
                {profileData.location && (
                  <p className="text-gray-500 text-sm flex items-center justify-center gap-1 mb-3">
                    <MapPin className="h-3 w-3" />
                    {profileData.location}
                  </p>
                )}

                {profileData.skills && (
                  <div className="flex flex-wrap gap-1 justify-center mb-4">
                    {profileData.skills.split(',').slice(0, 3).map((skill, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {skill.trim()}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="text-sm text-gray-500">
                  Ready to connect with professionals worldwide!
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Profile Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      placeholder="John Doe"
                      value={profileData.full_name}
                      onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="headline">Professional Headline</Label>
                    <Input
                      id="headline"
                      placeholder="Software Engineer | Tech Enthusiast"
                      value={profileData.headline}
                      onChange={(e) => setProfileData(prev => ({ ...prev, headline: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="San Francisco, CA"
                      value={profileData.location}
                      onChange={(e) => setProfileData(prev => ({ ...prev, location: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="industry">Industry</Label>
                    <Select value={profileData.industry} onValueChange={(value) => setProfileData(prev => ({ ...prev, industry: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {industries.map((industry) => (
                          <SelectItem key={industry} value={industry.toLowerCase()}>
                            {industry}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="bio">Professional Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell us about your professional background, interests, and goals..."
                    rows={3}
                    value={profileData.bio}
                    onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Work Experience */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Work Experience
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="company">Current Company</Label>
                    <Input
                      id="company"
                      placeholder="Google"
                      value={profileData.company}
                      onChange={(e) => setProfileData(prev => ({ ...prev, company: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="position">Current Position</Label>
                    <Input
                      id="position"
                      placeholder="Senior Software Engineer"
                      value={profileData.position}
                      onChange={(e) => setProfileData(prev => ({ ...prev, position: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="experience_years">Years of Experience</Label>
                  <Input
                    id="experience_years"
                    type="number"
                    placeholder="5"
                    value={profileData.experience_years}
                    onChange={(e) => setProfileData(prev => ({ ...prev, experience_years: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="skills">Skills (comma separated)</Label>
                  <Input
                    id="skills"
                    placeholder="JavaScript, React, Node.js, Python, Machine Learning"
                    value={profileData.skills}
                    onChange={(e) => setProfileData(prev => ({ ...prev, skills: e.target.value }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Add your professional skills separated by commas
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Links & Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Links & Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="website">Personal Website</Label>
                  <Input
                    id="website"
                    placeholder="https://johndoe.com"
                    value={profileData.website}
                    onChange={(e) => setProfileData(prev => ({ ...prev, website: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="linkedin_url">LinkedIn Profile</Label>
                    <Input
                      id="linkedin_url"
                      placeholder="https://linkedin.com/in/johndoe"
                      value={profileData.linkedin_url}
                      onChange={(e) => setProfileData(prev => ({ ...prev, linkedin_url: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="twitter_url">Twitter Profile</Label>
                    <Input
                      id="twitter_url"
                      placeholder="https://twitter.com/johndoe"
                      value={profileData.twitter_url}
                      onChange={(e) => setProfileData(prev => ({ ...prev, twitter_url: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button onClick={saveProfile} disabled={saving} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Complete Profile'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/dashboard')}
                disabled={saving}
              >
                Skip for Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;