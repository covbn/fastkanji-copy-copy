import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ERROR_BOUNDARY]", error, errorInfo?.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-destructive" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-mono text-sm text-destructive">
                  {String(this.state.error?.message || this.state.error)}
                </p>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold mb-2">Stack Trace</summary>
                <pre className="p-4 bg-muted rounded-lg overflow-auto text-xs whitespace-pre-wrap">
                  {this.state.error?.stack}
                </pre>
              </details>
              <Button
                onClick={() => window.location.href = "/"}
                className="w-full"
              >
                Return to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}