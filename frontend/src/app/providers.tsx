'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { Toaster } from 'sonner';
import { ConfirmHost } from '@/components/ui/confirm';
import { ThemeProvider, useTheme } from '@/components/layout/theme';

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} position="bottom-right" richColors closeButton />;
}

export default function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <TooltipProvider>
          {children}
          <ConfirmHost />
          <ThemedToaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
