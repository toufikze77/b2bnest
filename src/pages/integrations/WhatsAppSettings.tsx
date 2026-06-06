import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, ShieldCheck, Loader2, Send, Unplug } from "lucide-react";

type Status = "loading" | "connected" | "disconnected";

export default function WhatsAppSettings() {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("loading");
  const [meta, setMeta] = useState<{ from_number?: string; channel?: string; account_sid?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);

  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");

  const [testTo, setTestTo] = useState("");
  const [testBody, setTestBody] = useState("Hello from B2BNest workflows 👋");

  const loadStatus = async () => {
    setStatus("loading");
    const { data, error } = await supabase
      .from("user_integrations")
      .select("is_connected, metadata")
      .eq("integration_name", "whatsapp_twilio")
      .maybeSingle();
    if (error) {
      setStatus("disconnected");
      return;
    }
    if (data?.is_connected) {
      setStatus("connected");
      setMeta((data.metadata as any) || null);
    } else {
      setStatus("disconnected");
      setMeta(null);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
      body: { account_sid: accountSid, auth_token: authToken, from_number: fromNumber, channel },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast({
        title: "Connection failed",
        description: (data as any)?.error || error?.message || "Check credentials and try again.",
        variant: "destructive",
      });
      return;
    }
    setAuthToken("");
    toast({ title: "WhatsApp connected", description: "Your Twilio credentials are encrypted and ready to use." });
    loadStatus();
  };

  const disconnect = async () => {
    const { error } = await supabase.functions.invoke("whatsapp-disconnect", { body: {} });
    if (error) {
      toast({ title: "Disconnect failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Disconnected" });
    loadStatus();
  };

  const sendTest = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("workflow-execute", {
      body: { steps: [{ type: "whatsapp.send", to: testTo, body: testBody }] },
    });
    setTesting(false);
    const result = (data as any)?.results?.[0];
    if (error || (data as any)?.error || result?.ok === false) {
      toast({
        title: "Test failed",
        description: result?.message || (data as any)?.error || error?.message || "See logs.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Test sent", description: `Message SID: ${result?.sid ?? "ok"}` });
  };

  return (
    <div className="container max-w-3xl py-10 space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <MessageCircle className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp Integration</h1>
        </div>
        <p className="text-muted-foreground">
          Each subscriber connects their own Twilio account. Credentials are encrypted at rest and only used for your workflows.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              Connection status
              {status === "connected" && <Badge variant="default">Connected</Badge>}
              {status === "disconnected" && <Badge variant="secondary">Not connected</Badge>}
              {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
            </CardTitle>
            <CardDescription>
              {status === "connected"
                ? `From ${meta?.from_number} via ${meta?.channel}`
                : "Connect your Twilio account to send WhatsApp from workflows."}
            </CardDescription>
          </div>
          {status === "connected" && (
            <Button variant="outline" size="sm" onClick={disconnect}>
              <Unplug className="h-4 w-4 mr-2" /> Disconnect
            </Button>
          )}
        </CardHeader>
      </Card>

      {status !== "connected" && (
        <Card>
          <CardHeader>
            <CardTitle>Connect Twilio</CardTitle>
            <CardDescription>
              Find these in your{" "}
              <a className="underline" href="https://console.twilio.com/" target="_blank" rel="noreferrer">
                Twilio Console
              </a>
              . We verify your credentials before saving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={connect}>
              <div className="space-y-2">
                <Label htmlFor="sid">Account SID</Label>
                <Input id="sid" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" value={accountSid}
                  onChange={(e) => setAccountSid(e.target.value.trim())} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tok">Auth Token</Label>
                <Input id="tok" type="password" placeholder="Twilio auth token" value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="from">From number (E.164)</Label>
                  <Input id="from" placeholder="+15551234567" value={fromNumber}
                    onChange={(e) => setFromNumber(e.target.value.trim())} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel">Channel</Label>
                  <select id="channel"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as "whatsapp" | "sms")}>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4" /> Tokens are encrypted; admins cannot read them.
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Connect
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {status === "connected" && (
        <Card>
          <CardHeader>
            <CardTitle>Send test message</CardTitle>
            <CardDescription>Verify your connection end-to-end.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="to">To (E.164)</Label>
              <Input id="to" placeholder="+15551234567" value={testTo}
                onChange={(e) => setTestTo(e.target.value.trim())} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Input id="body" value={testBody} onChange={(e) => setTestBody(e.target.value)} />
            </div>
            <Button onClick={sendTest} disabled={testing || !testTo}>
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send test
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Back to{" "}
        <Link to="/workflow-studio" className="underline">
          Workflow Studio
        </Link>
        .
      </p>
    </div>
  );
}
