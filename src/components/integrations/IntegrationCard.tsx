import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface IntegrationCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  connected: boolean;
  loading: boolean;
  userInfo?: { name?: string; email?: string };
  onConnect: () => void;
  onDisconnect: () => void;
  docsUrl?: string;
}

export const IntegrationCard = ({
  icon: Icon,
  title,
  description,
  connected,
  loading,
  userInfo,
  onConnect,
  onDisconnect,
  docsUrl,
}: IntegrationCardProps) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {title}
                {connected && (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                )}
              </CardTitle>
              {userInfo && (
                <p className="text-xs text-muted-foreground mt-1">
                  {userInfo.name || userInfo.email}
                </p>
              )}
            </div>
          </div>
        </div>
        <CardDescription className="mt-2">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {connected ? (
            <Button
              variant="outline"
              onClick={onDisconnect}
              disabled={loading}
              className="flex-1"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disconnect
            </Button>
          ) : (
            <Button
              onClick={onConnect}
              disabled={loading}
              className="flex-1"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect
            </Button>
          )}
          {docsUrl && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(docsUrl, '_blank')}
              title="View documentation"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
