import { alpha, createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#006C51',
      light: '#4A987D',
      dark: '#004D39',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#A94726',
      light: '#E98C6D',
      dark: '#772F19',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F7F5EF',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1B2B26',
      secondary: '#5B6B64',
    },
    divider: '#DDE6E1',
    success: {
      main: '#2E7D32',
    },
  },
  typography: {
    fontFamily:
      '"Noto Sans HK", "DM Sans", "Roboto", "Helvetica Neue", Arial, sans-serif',
    h1: {
      fontSize: 'clamp(2rem, 4vw, 3.6rem)',
      fontWeight: 800,
      lineHeight: 1.08,
      letterSpacing: '-0.035em',
    },
    h2: {
      fontSize: 'clamp(1.65rem, 3vw, 2.4rem)',
      fontWeight: 800,
      lineHeight: 1.18,
      letterSpacing: '-0.025em',
    },
    h3: {
      fontSize: 'clamp(1.25rem, 2vw, 1.55rem)',
      fontWeight: 750,
      lineHeight: 1.28,
    },
    h4: {
      fontSize: '1.18rem',
      fontWeight: 750,
    },
    button: {
      fontWeight: 700,
      textTransform: 'none',
      letterSpacing: 0,
    },
    body1: {
      lineHeight: 1.65,
    },
  },
  shape: {
    borderRadius: 18,
  },
  shadows: [
    'none',
    '0 1px 2px rgba(18, 50, 40, 0.06)',
    '0 2px 8px rgba(18, 50, 40, 0.07)',
    '0 4px 14px rgba(18, 50, 40, 0.08)',
    '0 7px 20px rgba(18, 50, 40, 0.09)',
    '0 10px 28px rgba(18, 50, 40, 0.10)',
    '0 14px 34px rgba(18, 50, 40, 0.11)',
    ...Array(18).fill('0 16px 40px rgba(18, 50, 40, 0.12)'),
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#AABDB4 transparent',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          minHeight: 44,
          borderRadius: 14,
          paddingInline: 18,
          '&.Mui-focusVisible': {
            outline: '3px solid #111111',
            outlineOffset: 3,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 44,
          minHeight: 44,
          '&.Mui-focusVisible': {
            outline: '3px solid #111111',
            outlineOffset: 2,
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          minHeight: 44,
          '&.Mui-focusVisible': {
            outline: '3px solid #111111',
            outlineOffset: 2,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 650,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${alpha('#006C51', 0.09)}`,
          boxShadow: '0 6px 22px rgba(18, 50, 40, 0.07)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          borderRadius: 14,
        },
      },
    },
  },
});

export default theme;
