import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  console.log('[TOASTER] Rendering with', toasts.length, 'toasts');

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        console.log('[TOASTER] Rendering toast ID:', id, 'open:', props.open);
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose 
              onClick={(e) => {
                console.log('[TOASTER] Close button clicked for toast ID:', id);
                e.preventDefault();
                e.stopPropagation();
                dismiss(id);
              }} 
            />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}