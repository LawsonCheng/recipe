import { Box, Typography } from '@mui/material';

export const LANGUAGE_LABELS = {
  zh: '繁體中文',
  en: 'English',
  id: 'Bahasa Indonesia',
};

export function localize(value, language = 'zh') {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value[language] || value.zh || value.en || value.id || '';
}

export default function MultilingualText({
  value,
  primaryLanguage,
  secondaryLanguage,
  dual,
  primaryVariant = 'body1',
  secondaryVariant = 'body2',
  primarySx,
  secondarySx,
  ...boxProps
}) {
  const primary = localize(value, primaryLanguage);
  const secondary = localize(value, secondaryLanguage);
  const shouldShowSecondary = dual && secondary && secondary !== primary;

  return (
    <Box {...boxProps}>
      <Typography variant={primaryVariant} sx={primarySx}>
        {primary}
      </Typography>
      {shouldShowSecondary && (
        <Typography
          variant={secondaryVariant}
          color="text.secondary"
          sx={{ mt: 0.35, lineHeight: 1.45, ...secondarySx }}
        >
          {secondary}
        </Typography>
      )}
    </Box>
  );
}
