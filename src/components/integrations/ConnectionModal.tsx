import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState } from "react";

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: 'twitter' | 'google_calendar' | 'linkedin' | 'facebook' | 'notion' | 'trello' | 'slack';
  onConnect: (credentials?: Record<string, string>) => Promise<void>;
}

const providerInfo: Record<string, {
  title: string;
  description: string;
  fields?: Array<{ key: string; label: string; type: string }>;
  instructions: string[];
}> = {
  twitter: {
    title: "Connect Twitter Account",
    description: "Enter your Twitter API credentials to connect your account",
    fields: [
      { key: 'consumer_key', label: 'API Key (Consumer Key)', type: 'text' },
      { key: 'consumer_secret', label: 'API Secret (Consumer Secret)', type: 'password' },
      { key: 'access_token', label: 'Access Token', type: 'text' },
      { key: 'access_token_secret', label: 'Access Token Secret', type: 'password' },
    ],
    instructions: [
      'Go to https://developer.twitter.com/en/portal/dashboard',
      'Create a new app or select an existing one',
      'Go to "Keys and tokens" tab',
      'Make sure your app has "Read and Write" permissions',
      'Copy your API Key, API Secret, Access Token, and Access Token Secret',
    ],
  },
  google_calendar: {
    title: "Connect Google Calendar",
    description: "Enter your Google API credentials to connect",
    fields: [
      { key: 'client_id', label: 'Google Client ID', type: 'text' },
      { key: 'client_secret', label: 'Google Client Secret', type: 'password' },
    ],
    instructions: [
      'Go to https://console.cloud.google.com/apis/credentials',
      'Create OAuth 2.0 Client ID (Web application)',
      'Add redirect URI: https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/oauth-google-calendar',
      'Enable Google Calendar API',
      'Copy your Client ID and Client Secret above',
    ],
  },
  linkedin: {
    title: "Connect LinkedIn",
    description: "Enter your LinkedIn API credentials to connect",
    fields: [
      { key: 'client_id', label: 'LinkedIn Client ID', type: 'text' },
      { key: 'client_secret', label: 'LinkedIn Client Secret', type: 'password' },
    ],
    instructions: [
      'Go to https://www.linkedin.com/developers/apps',
      'Create a new app or select existing',
      'Add redirect URL: https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/oauth-linkedin',
      'Enable "Sign In with LinkedIn" product',
      'Copy your Client ID and Client Secret above',
    ],
  },
  facebook: {
    title: "Connect Facebook",
    description: "Enter your Facebook API credentials to connect",
    fields: [
      { key: 'app_id', label: 'Facebook App ID', type: 'text' },
      { key: 'app_secret', label: 'Facebook App Secret', type: 'password' },
    ],
    instructions: [
      'Go to https://developers.facebook.com/apps',
      'Create a new app or select existing',
      'Add Facebook Login product',
      'Add OAuth redirect URI: https://gvftvswyrevummbvyhxa.supabase.co/functions/v1/oauth-facebook',
      'Copy your App ID and App Secret above',
    ],
  },
  notion: {
    title: "Connect Notion",
    description: "Authorize access to your Notion workspace",
    instructions: [
      'Click "Connect" to open Notion authorization',
      'Sign in with your Notion account',
      'Select the pages to share',
      'Grant access permissions',
    ],
  },
  trello: {
    title: "Connect Trello",
    description: "Authorize access to your Trello boards",
    instructions: [
      'Click "Connect" to open Trello authorization',
      'Sign in with your Trello account',
      'Grant board access permissions',
      'You\'ll be redirected back automatically',
    ],
  },
  slack: {
    title: "Connect Slack",
    description: "Authorize access to your Slack workspace",
    instructions: [
      'Click "Connect" to open Slack authorization',
      'Select your workspace',
      'Grant the requested permissions',
      'You\'ll be redirected back automatically',
    ],
  },
};

export const ConnectionModal = ({ isOpen, onClose, provider, onConnect }: ConnectionModalProps) => {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const info = providerInfo[provider];
  const needsCredentials = ['twitter', 'google_calendar', 'linkedin', 'facebook'].includes(provider);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (needsCredentials) {
        // Validate all fields are filled
        const fields = info.fields || [];
        for (const field of fields) {
          if (!credentials[field.key]?.trim()) {
            throw new Error(`Please enter your ${field.label}`);
          }
        }
      }
      
      await onConnect(needsCredentials ? credentials : undefined);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setCredentials({});
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setCredentials(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{info.title}</DialogTitle>
          <DialogDescription>{info.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Instructions */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">How to connect:</Label>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              {info.instructions.map((instruction, index) => (
                <li key={index}>{instruction}</li>
              ))}
            </ol>
          </div>

          {/* Credential Fields */}
          {needsCredentials && info.fields && (
            <div className="space-y-3 pt-2 border-t">
              {info.fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type={field.type}
                    value={credentials[field.key] || ''}
                    onChange={(e) => handleInputChange(field.key, e.target.value)}
                    placeholder={`Enter your ${field.label}`}
                    disabled={loading || success}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {success && (
            <Alert className="border-green-500 bg-green-50 text-green-900">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>Successfully connected! Redirecting...</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading || success}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={loading || success}
            className="flex-1"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {success ? 'Connected!' : 'Connect'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
