
import { useState, useEffect } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FileText, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import TwoFactorAuth from '@/components/TwoFactorAuth';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const { user, signIn, signUp, loading, verify2FA, sendVerificationCode, signInWithOAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorEmail, setTwoFactorEmail] = useState('');
  const [isVerification, setIsVerification] = useState(false);
  
  // Check for invitation parameters
  const isInvited = searchParams.get('invited') === 'true';
  const invitationOrgId = searchParams.get('org');
  
  // Auto-switch to signup for invited users
  useEffect(() => {
    if (isInvited && invitationOrgId) {
      setIsLogin(false); // Switch to signup mode for invited users
      toast({
        title: "Welcome!",
        description: "You've been invited to join an organization. Please create your account.",
      });
    }
  }, [isInvited, invitationOrgId]);

  // Debug effect to track state changes
  useEffect(() => {
    console.log('🔒 State changed:', { showTwoFactor, twoFactorEmail, isVerification });
  }, [showTwoFactor, twoFactorEmail, isVerification]);

  // Redirect if already authenticated
  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  // Show 2FA screen if needed
  console.log('🔒 Auth state check:', { showTwoFactor, twoFactorEmail, isVerification });
  console.log('🔒 showTwoFactor type:', typeof showTwoFactor, 'value:', showTwoFactor);
  if (showTwoFactor) {
    console.log('🔒 Rendering TwoFactorAuth component');
    return (
      <TwoFactorAuth 
        email={twoFactorEmail}
        isVerification={isVerification}
        onSuccess={() => {
          setShowTwoFactor(false);
          setTwoFactorEmail('');
          setIsVerification(false);
          if (isVerification) {
            // Handle invitation acceptance after email verification for signup
            if (isInvited && invitationOrgId) {
              setTimeout(() => handleInvitationAcceptance(invitationOrgId), 1000);
            }
            toast({
              title: "Email Verified!",
              description: isInvited ? "Welcome to the organization! You can now access the team." : "You can now sign in to your account."
            });
            setIsLogin(true);
          } else {
            // For login 2FA, user should be authenticated now
            if (isInvited && invitationOrgId) {
              setTimeout(() => handleInvitationAcceptance(invitationOrgId), 1000);
            }
            window.location.href = '/';
          }
        }}
        onBack={() => {
          setShowTwoFactor(false);
          setTwoFactorEmail('');
          setIsVerification(false);
        }}
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔥 Form submitted!', { isLogin, email, password, fullName });
    console.log('🔥 Current auth state:', { showTwoFactor, twoFactorEmail, isVerification });
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error, needs2FA, email: userEmail } = await signIn(email, password);
        if (error) {
          toast({
            title: "Sign In Failed",
            description: error.message,
            variant: "destructive"
          });
        } else if (needs2FA) {
          console.log('🔥 Setting 2FA state:', { userEmail, email });
          const emailToUse = userEmail || email;
          console.log('🔥 Email to use for 2FA:', emailToUse);
          setTwoFactorEmail(emailToUse);
          setIsVerification(false);
          console.log('🔥 About to set showTwoFactor to true');
          setShowTwoFactor(true);
          console.log('🔥 showTwoFactor set to true');
          toast({
            title: "2FA Required",
            description: "Please check your email for the verification code."
          });
        } else {
          // Handle invitation acceptance for login
          if (isInvited && invitationOrgId) {
            await handleInvitationAcceptance(invitationOrgId);
          }
          toast({
            title: "Welcome back!",
            description: "You have been signed in successfully."
          });
        }
      } else {
        if (!fullName.trim()) {
          toast({
            title: "Full Name Required",
            description: "Please enter your full name",
            variant: "destructive"
          });
          return;
        }
        
        const { error, needsVerification } = await signUp(email, password, fullName, companyName);
        if (error) {
          toast({
            title: "Sign Up Failed",
            description: error.message,
            variant: "destructive"
          });
        } else if (needsVerification) {
          console.log('Setting verification state:', { email });
          setTwoFactorEmail(email);
          setIsVerification(true);
          setShowTwoFactor(true);
          toast({
            title: "Verify Your Email",
            description: "Please check your email for the verification code."
          });
        } else {
          // Handle invitation acceptance for signup
          if (isInvited && invitationOrgId) {
            await handleInvitationAcceptance(invitationOrgId);
          }
          toast({
            title: "Account Created!",
            description: isInvited ? "Welcome to the organization! You can now access the team." : "You can now sign in to your account."
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvitationAcceptance = async (organizationId: string) => {
    try {
      console.log('Accepting invitation for organization:', organizationId);
      
      // Get current user - need to fetch fresh user data
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser?.id) {
        console.error('No authenticated user found');
        return;
      }
      
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .single();
        
      if (existingMember) {
        console.log('User is already a member of this organization');
        return;
      }
      
      // Add user to organization
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: currentUser.id,
          role: 'member',
          is_active: true
        });

      if (memberError) {
        console.error('Error adding user to organization:', memberError);
        toast({
          title: "Error",
          description: "Failed to join organization. Please contact your admin.",
          variant: "destructive"
        });
      } else {
        console.log('Successfully added user to organization');
        toast({
          title: "Success!",
          description: "You've been added to the organization team!",
        });
      }
    } catch (error) {
      console.error('Error handling invitation:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Column - Auth Form */}
          <div className="flex items-center justify-center min-h-screen lg:min-h-0 lg:py-8">
            <div className="w-full max-w-md">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <div className="bg-blue-600 p-2 rounded-lg">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">B2BNEST</h1>
                </div>
                <p className="text-gray-600">
                  {isLogin ? 'Welcome back!' : 'Get started with professional business forms and tools'}
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{isLogin ? 'Sign In' : 'Create Account'}</CardTitle>
                  <CardDescription>
                    {isLogin 
                      ? 'Enter your credentials to access your account' 
                      : 'Get started with professional business forms'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="fullName">Full Name</Label>
                          <Input
                            id="fullName"
                            type="text"
                            placeholder="Enter your full name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required={!isLogin}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="companyName">Company Name (Optional)</Label>
                          <Input
                            id="companyName"
                            type="text"
                            placeholder="Enter your company name"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isSubmitting || loading}
                    >
                      {isSubmitting ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </Button>
                  </form>

                  {/* OAuth Section */}
                  <div className="mt-6">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">Or continue with</span>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={async () => {
                          try {
                            const { error } = await signInWithOAuth('google');
                            if (error) {
                              toast({
                                title: "Google Sign-In Failed",
                                description: error.message,
                                variant: "destructive"
                              });
                            } else if (isInvited && invitationOrgId) {
                              // Handle invitation after OAuth login
                              setTimeout(() => handleInvitationAcceptance(invitationOrgId), 2000);
                            }
                          } catch (err) {
                            toast({
                              title: "Error",
                              description: "An unexpected error occurred",
                              variant: "destructive"
                            });
                          }
                        }}
                        disabled={loading}
                      >
                        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                          <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google
                      </Button>
                    </div>
                  </div>


                  <div className="mt-6 text-center space-y-2">
                    <button
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-blue-600 hover:text-blue-700 text-sm block w-full"
                    >
                      {isLogin 
                        ? "Don't have an account? Sign up" 
                        : 'Already have an account? Sign in'
                      }
                    </button>
                    {isLogin && (
                      <Link 
                        to="/forgot-password" 
                        className="text-blue-600 hover:text-blue-700 text-sm block"
                      >
                        Forgot your password?
                      </Link>
                    )}
                  </div>

                  {!isLogin && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-md flex items-start space-x-2">
                      <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-700">
                        You'll receive an email verification link after signing up. 
                        Please check your inbox and click the link to activate your account.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Auth;
