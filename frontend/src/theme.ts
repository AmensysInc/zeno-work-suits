import type { ThemeConfig } from 'antd';

/** Ant Design theme shared by every screen. */
export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#4f6ef7',
    colorInfo: '#4f6ef7',
    colorSuccess: '#219e6b',
    colorWarning: '#d48806',
    colorError: '#dc3c3c',
    colorText: '#161a22',
    colorTextSecondary: '#6b7280',
    colorBorder: '#e2e6ee',
    colorBorderSecondary: '#edf0f5',
    colorBgLayout: '#f5f7fb',
    fontFamily: 'Inter, -apple-system, "Segoe UI", sans-serif',
    fontSize: 13,
    borderRadius: 8,
    controlHeight: 34,
    wireframe: false,
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      headerHeight: 60,
      headerPadding: '0 24px',
      siderBg: '#fbfcff',
      bodyBg: '#f5f7fb',
    },
    Menu: {
      itemBg: 'transparent',
      itemHeight: 36,
      itemBorderRadius: 8,
      itemSelectedBg: '#ebf1ff',
      itemSelectedColor: '#386bf5',
      groupTitleFontSize: 10,
      activeBarBorderWidth: 0,
    },
    Card: { headerFontSize: 15 },
    Table: {
      headerBg: '#fafbfd',
      headerColor: '#6b7280',
      cellPaddingBlock: 12,
    },
    Tabs: { horizontalMargin: '0 0 20px 0' },
    Modal: { titleFontSize: 18 },
  },
};
