
import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FileText, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import TwoFactorAuth from '@/components/TwoFactorAuth';

const Auth = () => {
  const { user, signIn, signUp, loading, verify2FA, sendVerificationCode } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorEmail, setTwoFactorEmail] = useState('');
  const [isVerification, setIsVerification] = useState(false);

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
            toast({
              title: "Email Verified!",
              description: "You can now sign in to your account."
            });
            setIsLogin(true);
          } else {
            // For login 2FA, user should be authenticated now
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
          toast({
            title: "Account Created!",
            description: "You can now sign in to your account."
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="bg-blue-600 p-2 rounded-lg">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">AI-Powered Business Automation Platform</h1>
          </div>
          <p className="text-gray-600">
            {isLogin ? 'Welcome back!' : 'Join thousands of businesses'}
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
  );
};

export default Auth;
