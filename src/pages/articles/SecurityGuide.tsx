import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock, Shield, Key, FileCheck, UserCheck, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEOHead from '@/components/SEOHead';

const SecurityGuide = () => {
  return (
    <>
      <SEOHead 
        title="Security & Privacy Guide | B2BNEST"
        description="Learn about B2BNEST security features, data privacy, GDPR compliance, and best practices"
      />
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <Button asChild variant="ghost" className="mb-6">
            <Link to="/knowledge-base">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Knowledge Base
            </Link>
          </Button>

          <div className="mb-8">
            <Lock className="h-12 w-12 text-primary mb-4" />
            <h1 className="text-4xl font-bold mb-4">Security & Privacy Guide</h1>
            <p className="text-xl text-muted-foreground">
              How B2BNEST keeps your business data secure and private
            </p>
          </div>

          {/* Account Security */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Account Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Protect your B2BNEST account with multiple layers of security.
              </p>

              <div>
                <h3 className="font-semibold mb-2">Two-step sign-in</h3>
                <p className="text-muted-foreground mb-2">
                  Turn it on in Settings → Security. Signing in then needs your password and a 6-digit code from a free
                  authenticator app on your phone, such as Microsoft Authenticator, Google Authenticator, Authy or
                  1Password. Add a second phone as a backup. If you lose your phone, contact support@b2bnest.online and
                  we'll check it's you before resetting it.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Strong Password Guidelines</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Use at least 12 characters</li>
                  <li>Include uppercase and lowercase letters</li>
                  <li>Add numbers and special characters</li>
                  <li>Avoid common words or personal information</li>
                  <li>Use a unique password (not reused elsewhere)</li>
                  <li>Consider using a password manager</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Session Management</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Settings → Security → "Sign out other devices" signs you out everywhere except this device</li>
                  <li>Settings → Security lists your last 20 recorded account actions</li>
                  <li>Individual devices can't be listed or signed out one by one</li>
                </ul>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                <div className="flex gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm mb-1">Security Alert</p>
                    <p className="text-sm text-muted-foreground">
                      If you handle sensitive financial or client data, use a password manager and a password you use nowhere else.
                    </p>
                  </div>
                </div>
              </div>

              <Button asChild className="w-full">
                <Link to="/settings">Configure Security Settings</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Data Privacy */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                Data Privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Understanding how B2BNEST protects and manages your information.
              </p>

              <div>
                <h3 className="font-semibold mb-2">What Data We Collect</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li><strong>Account Information:</strong> Name, email, company details</li>
                  <li><strong>Business Data:</strong> Contacts, invoices, projects, documents</li>
                  <li><strong>Usage Data:</strong> Features used, login times, activity logs</li>
                  <li><strong>Payment Information:</strong> Billing details (encrypted)</li>
                  <li><strong>Integration Data:</strong> Connected service credentials (encrypted)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">How We Protect Your Data</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Each company's records are separated by database access rules</li>
                  <li>Connected-account tokens are stored encrypted</li>
                  <li>Card payments are handled by Stripe; we never store card numbers</li>
                  <li>Connections to B2BNEST use HTTPS</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Data Retention</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Active account data: Retained while account is active</li>
                  <li>We keep data only as long as needed to run the service and meet legal requirements, as set out in our Privacy Policy.</li>
                  <li>Legal requirements: As mandated by law (e.g., tax records)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Your Data Rights</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Download a copy of your data in Settings → Your data, or email us and we will help</li>
                  <li>Get your data in a machine-readable format (JSON and CSV in the same download), or email us and we will help</li>
                  <li>Delete your account, or close a company you own, in Settings → Your data, or email us and we will help</li>
                  <li>Correct inaccurate information</li>
                  <li>Opt-out of marketing communications</li>
                </ul>
              </div>

              <Button asChild variant="outline" className="w-full">
                <Link to="/privacy">Read Full Privacy Policy</Link>
              </Button>
            </CardContent>
          </Card>

          {/* GDPR Compliance */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>GDPR Compliance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your rights under the UK and EU General Data Protection Regulation (GDPR) are described below. Contact us to exercise them.
              </p>

              <div>
                <h3 className="font-semibold mb-2">GDPR Rights</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li><strong>Right to Access:</strong> Ask for a copy of the personal data we hold about you</li>
                  <li><strong>Right to Rectification:</strong> Correct inaccurate data</li>
                  <li><strong>Right to Erasure:</strong> Ask us to delete your data (email us and we will help)</li>
                  <li><strong>Right to Portability:</strong> Ask for your data in a machine-readable format (email us and we will help)</li>
                  <li><strong>Right to Object:</strong> Opt-out of certain data processing</li>
                  <li><strong>Right to Restriction:</strong> Limit how we process your data</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">How to Exercise Your Rights</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Use Settings → Your data to download your data, close a company you own or delete your account</li>
                  <li>For anything else, or if that isn't available to you, email info@b2bnest.online with your request</li>
                  <li>Verify your identity (for security)</li>
                  <li>We respond within one month</li>
                  <li>Receive confirmation and action taken</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Data Processing</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>We explain how we use your data in our Privacy Policy</li>
                  <li>We use trusted service providers to run B2BNEST (for example hosting, payments and email) and review how they handle data</li>
                  <li>We review our security and data protection practices as the product grows</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Questions about your data? Email info@b2bnest.online.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* OAuth Security */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                OAuth Security (Third-Party Integrations)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                How B2BNEST securely manages connections to third-party services.
              </p>

              <div>
                <h3 className="font-semibold mb-2">OAuth 2.0 Protocol</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Industry-standard authentication protocol</li>
                  <li>Your passwords are never stored by B2BNEST</li>
                  <li>Tokens encrypted and stored securely</li>
                  <li>Automatic token refresh when needed</li>
                  <li>Scope-limited access (only what's necessary)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Managing Connected Services</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Go to Settings → Integrations</li>
                  <li>View all connected services</li>
                  <li>See permissions granted to each</li>
                  <li>Disconnect services you no longer use</li>
                  <li>Reconnect if credentials expire</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Security Best Practices</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Review connected services monthly</li>
                  <li>Disconnect unused integrations</li>
                  <li>Use official OAuth connections only</li>
                  <li>Don't share API keys or tokens</li>
                  <li>Report suspicious activity immediately</li>
                </ul>
              </div>

              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Secure by Design:</strong> B2BNEST uses OAuth 2.0 with PKCE (Proof Key for Code Exchange) for enhanced security.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Team & Permissions */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                Team Access & Permissions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Control who can access what in your B2BNEST workspace.
              </p>

              <div>
                <h3 className="font-semibold mb-2">User Roles</h3>
                <div className="space-y-2">
                  <div className="border-l-4 border-primary pl-3">
                    <p className="font-semibold text-sm">Owner</p>
                    <p className="text-sm text-muted-foreground">Full access, billing, team management, delete workspace</p>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-3">
                    <p className="font-semibold text-sm">Admin</p>
                    <p className="text-sm text-muted-foreground">Full access, invite users, manage settings (no billing)</p>
                  </div>
                  <div className="border-l-4 border-green-500 pl-3">
                    <p className="font-semibold text-sm">Manager</p>
                    <p className="text-sm text-muted-foreground">Create projects, manage assigned teams, view reports</p>
                  </div>
                  <div className="border-l-4 border-yellow-500 pl-3">
                    <p className="font-semibold text-sm">Member</p>
                    <p className="text-sm text-muted-foreground">Access assigned projects and tasks, limited editing</p>
                  </div>
                  <div className="border-l-4 border-gray-500 pl-3">
                    <p className="font-semibold text-sm">Viewer</p>
                    <p className="text-sm text-muted-foreground">Read-only access to assigned projects</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Granular Permissions</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Project-level access controls</li>
                  <li>Client/contact visibility restrictions</li>
                  <li>Financial data access limitations</li>
                  <li>Document folder permissions</li>
                  <li>Report viewing restrictions</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Security Tips</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                  <li>Use least-privilege principle (minimum access needed)</li>
                  <li>Review team access quarterly</li>
                  <li>Remove access for departing team members immediately</li>
                  <li>Use project-specific permissions for contractors</li>
                  <li>Enable audit logs to track changes</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Security Checklist */}
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle>Security Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <input type="checkbox" className="mt-1" />
                  <span className="text-muted-foreground">Use a unique password stored in a password manager</span>
                </div>
                <div className="flex gap-3">
                  <input type="checkbox" className="mt-1" />
                  <span className="text-muted-foreground">Use a strong, unique password</span>
                </div>
                <div className="flex gap-3">
                  <input type="checkbox" className="mt-1" />
                  <span className="text-muted-foreground">Review and disconnect unused integrations</span>
                </div>
                <div className="flex gap-3">
                  <input type="checkbox" className="mt-1" />
                  <span className="text-muted-foreground">Check active sessions and revoke unknown devices</span>
                </div>
                <div className="flex gap-3">
                  <input type="checkbox" className="mt-1" />
                  <span className="text-muted-foreground">Audit team member permissions</span>
                </div>
                <div className="flex gap-3">
                  <input type="checkbox" className="mt-1" />
                  <span className="text-muted-foreground">Enable email notifications for security events</span>
                </div>
                <div className="flex gap-3">
                  <input type="checkbox" className="mt-1" />
                  <span className="text-muted-foreground">Backup important data regularly</span>
                </div>
                <div className="flex gap-3">
                  <input type="checkbox" className="mt-1" />
                  <span className="text-muted-foreground">Read and understand the privacy policy</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-background rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Report Security Issues:</strong> If you discover a security vulnerability, please contact info@b2bnest.online immediately. Do not post publicly.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default SecurityGuide;
