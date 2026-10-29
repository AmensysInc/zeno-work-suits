import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import { Toaster } from 'sonner';
import AppRoutes from './routes/AppRoutes';
import { theme } from './theme';
import { ConfirmHost } from './components/ui/confirm';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './styles.css';
const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15000 } },
});
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <ConfigProvider theme={theme}>
        <AntApp>
          <ConfirmHost />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
          <Toaster richColors position="top-right" />
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
