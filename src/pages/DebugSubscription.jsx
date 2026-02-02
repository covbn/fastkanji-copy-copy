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
            <CardTitle>RLS Configuration & Diagnosis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-4">
              <div>
                <p><strong>Current User ID:</strong></p>
                <code className="bg-muted p-2 rounded block text-xs">
                  {user?.id || 'null'}
                </code>
              </div>

              <div>
                <p><strong>TEMPORARY: Read Access Set To:</strong></p>
                <code className="bg-green-100 dark:bg-green-900 p-2 rounded block">
                  No Restrictions (Authenticated Users)
                </code>
                <p className="text-xs text-muted-foreground mt-1">
                  This temporarily disables creator gating. If counts are now &gt; 0,
                  it proves implicit creator restrictions were blocking reads.
                </p>
              </div>

              <div>
                <p><strong>Target RLS Rule (once creator gating is removed):</strong></p>
                <code className="bg-muted p-2 rounded block text-xs">
                  {`{ "owner": "{{user.id}}" }`}
                </code>
              </div>

              <div className="border-l-4 border-amber-500 pl-3 py-2 bg-amber-50 dark:bg-amber-950">
                <p className="font-semibold text-amber-800 dark:text-amber-200">Action Required:</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  In Base44 Dashboard → Data → UserSubscription → Security Rules:
                </p>
                <ol className="list-decimal list-inside text-xs text-amber-700 dark:text-amber-300 mt-2 space-y-1">
                  <li>Confirm Read is set to "No Restrictions" or "Authenticated Users"</li>
                  <li>Look for any "Creator only" or "Ownership model" toggles and DISABLE them</li>
                  <li>After disabling creator gating, set Read to: Entity-User Field Comparison</li>
                  <li>Entity field: <strong>owner</strong> | User field: <strong>User ID</strong></li>
                  <li>Copy the generated JSON rules and verify they match: {`{ "owner": "{{user.id}}" }`}</li>
                </ol>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  <strong>Expected Results After Fix:</strong><br/>
                  • listCount &gt;= 1 (with restricted read)<br/>
                  • filteredCount &gt;= 1<br/>
                  • firstRow.owner === {user?.id || 'null'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}