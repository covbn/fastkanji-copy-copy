import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DebugSubscription() {
  const [whoAmIResult, setWhoAmIResult] = useState(null);
  const [createResult, setCreateResult] = useState(null);
  const [listResult, setListResult] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const handleWhoAmI = async () => {
    try {
      const response = await base44.functions.invoke('debugWhoAmI', {});
      setWhoAmIResult(response.data);
    } catch (error) {
      setWhoAmIResult({ error: error.message });
    }
  };

  const handleCreateSubAsUser = async () => {
    try {
      const response = await base44.functions.invoke('debugCreateSubAsUser', {});
      setCreateResult(response.data);
    } catch (error) {
      setCreateResult({ error: error.message });
    }
  };

  const handleListSubscriptions = async () => {
    try {
      const subs = await base44.entities.UserSubscription.list('-updated_date', 5);
      setListResult({
        count: subs.length,
        rows: subs.map(s => ({
          owner: s.owner,
          user_id: s.user_id,
          user_email: s.user_email,
          stripe_status: s.stripe_status,
          subscription_status: s.subscription_status
        }))
      });
    } catch (error) {
      setListResult({ error: error.message });
    }
  };

  if (!user) {
    return <div className="p-8">Loading user...</div>;
  }

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Subscription Debug</h1>

        {/* User Identity */}
        <Card>
          <CardHeader>
            <CardTitle>Current User Identity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 font-mono text-sm">
              <div><strong>user.id:</strong> {user.id || 'null'}</div>
              <div><strong>user.email:</strong> {user.email || 'null'}</div>
              <div><strong>user keys:</strong> {Object.keys(user).join(', ')}</div>
              <pre className="bg-muted p-3 rounded mt-2 overflow-auto">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Debug Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Debug Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Button onClick={handleWhoAmI} className="w-full">
                1. Call debugWhoAmI (backend user info)
              </Button>
              {whoAmIResult && (
                <pre className="bg-muted p-3 rounded mt-2 overflow-auto text-xs">
                  {JSON.stringify(whoAmIResult, null, 2)}
                </pre>
              )}
            </div>

            <div>
              <Button onClick={handleCreateSubAsUser} className="w-full" variant="outline">
                2. Create subscription row as user (NO service role)
              </Button>
              {createResult && (
                <pre className="bg-muted p-3 rounded mt-2 overflow-auto text-xs">
                  {JSON.stringify(createResult, null, 2)}
                </pre>
              )}
            </div>

            <div>
              <Button onClick={handleListSubscriptions} className="w-full" variant="outline">
                3. List UserSubscription (client-side with RLS)
              </Button>
              {listResult && (
                <div className="mt-2">
                  <div className="text-lg font-bold mb-2">
                    Count: {listResult.count ?? 'error'}
                  </div>
                  <pre className="bg-muted p-3 rounded overflow-auto text-xs">
                    {JSON.stringify(listResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* RLS Status */}
        <Card>
          <CardHeader>
            <CardTitle>RLS Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <p><strong>Expected RLS Rule:</strong></p>
              <code className="bg-muted p-2 rounded block">
                Read: owner == {`{{user.id}}`}
              </code>
              <p className="text-muted-foreground mt-4">
                If "List UserSubscription" returns count: 0 after creating a row,
                then RLS is blocking reads. This means the stored owner field does not
                match what Base44 considers {`{{user.id}}`}.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Current User ID:</strong> {user?.id || 'null'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}