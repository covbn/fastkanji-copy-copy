import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";

export default function ImportVocabulary() {
  const { toast } = useToast();
  const [fileUrl, setFileUrl] = useState("https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/698653bfc5ff72100c7f9dcf/a9fa7fd5c_Vocabulary_export.csv");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const handleImport = async () => {
    if (!fileUrl.trim()) {
      toast({
        title: "Error",
        description: "Please provide a file URL",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const response = await base44.functions.invoke('importVocabulary', {
        file_url: fileUrl.trim()
      });

      if (response.data.success) {
        setResult({ success: true, ...response.data });
        toast({
          title: "✅ Import Successful",
          description: response.data.message,
          duration: 5000,
        });
      } else {
        throw new Error(response.data.error || "Import failed");
      }
    } catch (error) {
      setResult({ success: false, error: error.message });
      toast({
        title: "❌ Import Failed",
        description: error.message,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setImporting(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold mb-2">Admin Only</h2>
            <p className="text-muted-foreground">
              This page is only accessible to admin users.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-background">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold">Import Vocabulary</h1>
          <p className="text-muted-foreground">
            Import vocabulary data from CSV file
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              CSV Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>CSV File URL</Label>
              <Input
                type="text"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">
                Enter the URL of your vocabulary CSV file
              </p>
            </div>

            <Button
              onClick={handleImport}
              disabled={importing}
              className="w-full"
            >
              {importing ? 'Importing...' : 'Start Import'}
            </Button>

            {result && (
              <Card className={result.success ? "border-green-500" : "border-red-500"}>
                <CardContent className="p-4">
                  {result.success ? (
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-green-700">Import Successful</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {result.message}
                        </p>
                        <p className="text-sm font-medium mt-2">
                          Imported: {result.imported} records
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-700">Import Failed</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {result.error}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-foreground">
                <strong>⚠️ Warning:</strong> This will delete all existing vocabulary data and replace it with the imported data.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}