import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Shield, Mail, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface TwoFactorAuthProps {
  email: string;
  isVerification?: boolean;
  onSuccess: () => void;
  onBack: () => void;
}

const TwoFactorAuth = ({ email, isVerification = false, onSuccess, onBack }: TwoFactorAuthProps) => {
  const { verify2FA, sendVerificationCode } = useAuth();
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit verification code.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await verify2FA(email, verificationCode, !isVerification);
      
      if (error) {
        toast({
          title: "Invalid Code",
          description: error.message || "The verification code is invalid or has expired.",
          variant: "destructive"
        });
        return;
      }

      if (isVerification) {
        toast({
          title: "Email Verified!",
          description: "Your email has been successfully verified. You can now sign in.",
        });
      } else {
        toast({
          title: "Login Successful!",
          description: "You have been authenticated successfully.",
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error verifying code:', error);
      toast({
        title: "Verification Failed",
        description: "Failed to verify the code. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    
    try {
      const { error, code } = await sendVerificationCode(email, isVerification ? 'verification' : 'login');
      
      if (error) throw error;

      toast({
        title: "Code Sent",
        description: `A new verification code has been sent to ${email}. Please check your inbox.`,
        duration: 10000
      });
    } catch (error) {
      console.error('Error resending code:', error);
      toast({
        title: "Failed to Resend",
        description: "Could not send a new verification code. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-blue-600 p-3 rounded-full">
                {isVerification ? <Mail className="h-6 w-6 text-white" /> : <Shield className="h-6 w-6 text-white" />}
              </div>
            </div>
            <CardTitle>
              {isVerification ? 'Verify Your Email' : 'Two-Factor Authentication'}
            </CardTitle>
            <CardDescription>
              {isVerification 
                ? `We've sent a verification code to ${email}. Please enter it below to verify your account.`
                : `Enter the 6-digit code sent to ${email} to complete your login.`
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Verification Code</Label>
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

            <div className="space-y-3">
              <Button 
                onClick={handleVerifyCode}
                disabled={verificationCode.length !== 6 || isLoading}
                className="w-full"
              >
                {isLoading ? "Verifying..." : (isVerification ? "Verify Email" : "Complete Login")}
              </Button>

              <Button 
                variant="outline" 
                onClick={handleResendCode}
                disabled={isResending}
                className="w-full"
              >
                {isResending ? "Sending..." : "Resend Code"}
              </Button>

              <Button 
                variant="ghost" 
                onClick={onBack}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to {isVerification ? 'Sign Up' : 'Sign In'}
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>Code expires in 10 minutes</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TwoFactorAuth;