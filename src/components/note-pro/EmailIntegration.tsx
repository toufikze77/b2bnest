import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Mail, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface EmailIntegrationProps {
  noteId?: string;
  noteContent?: string;
  onSyncComplete?: () => void;
}

export const EmailIntegration: React.FC<EmailIntegrationProps> = ({
  noteId,
  noteContent,
  onSyncComplete,
}) => {
  const { user } = useAuth();
  const [gmailConnected, setGmailConnected] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    checkConnections();
  }, [user]);

  const checkConnections = async () => {
    if (!user) return;

    const { data: integrations } = await supabase
      .from("user_integrations")
      .select("integration_name, is_connected")
      .eq("user_id", user.id)
      .in("integration_name", ["gmail", "outlook"]);

    if (integrations) {
      setGmailConnected(
        integrations.some((i) => i.integration_name === "gmail" && i.is_connected)
      );
      setOutlookConnected(
        integrations.some((i) => i.integration_name === "outlook" && i.is_connected)
      );
    }
  };

  const connectGmail = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("oauth-gmail-init", {
        body: { userId: user?.id },
      });

      if (error) throw error;

      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error("Gmail connection error:", error);
      toast.error("Failed to connect Gmail");
    }
  };

  const connectOutlook = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("oauth-outlook-init", {
        body: { userId: user?.id },
      });

      if (error) throw error;

      if (data?.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error("Outlook connection error:", error);
      toast.error("Failed to connect Outlook");
    }
  };

  const syncToEmail = async (provider: "gmail" | "outlook") => {
    if (!noteContent) {
      toast.error("No content to sync");
      return;
    }

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-note-to-email", {
        body: {
          userId: user?.id,
          provider,
          noteId,
          content: noteContent,
        },
      });

      if (error) throw error;

      toast.success(`Note synced to ${provider === "gmail" ? "Gmail" : "Outlook"} draft`);
      onSyncComplete?.();
    } catch (error) {
      console.error("Sync error:", error);
      toast.error(`Failed to sync to ${provider === "gmail" ? "Gmail" : "Outlook"}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <Mail className="w-5 h-5" />
        Email Integration
      </h3>

      <div className="space-y-3">
        {/* Gmail */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Gmail</span>
            {gmailConnected ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="w-3 h-3" />
                Not Connected
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {!gmailConnected ? (
              <Button onClick={connectGmail} size="sm">
                Connect
              </Button>
            ) : (
              <Button
                onClick={() => syncToEmail("gmail")}
                size="sm"
                disabled={syncing || !noteContent}
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  "Sync to Gmail"
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Outlook */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Outlook</span>
            {outlookConnected ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <XCircle className="w-3 h-3" />
                Not Connected
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {!outlookConnected ? (
              <Button onClick={connectOutlook} size="sm">
                Connect
              </Button>
            ) : (
              <Button
                onClick={() => syncToEmail("outlook")}
                size="sm"
                disabled={syncing || !noteContent}
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  "Sync to Outlook"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Connect your email accounts to save notes as drafts or sync content.
      </p>
    </Card>
  );
};
