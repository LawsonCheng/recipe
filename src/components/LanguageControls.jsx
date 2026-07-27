import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import { LANGUAGE_LABELS } from './MultilingualText';

export default function LanguageControls({
  primaryLanguage,
  secondaryLanguage,
  dual,
  onPrimaryChange,
  onSecondaryChange,
  onDualChange,
  labels,
}) {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: dual ? { xs: '1fr 1fr', sm: 'auto auto auto' } : { xs: '1fr 1fr', sm: 'auto auto' },
        gap: 1,
        alignItems: 'center',
      }}
    >
      <ToggleButtonGroup
        exclusive
        size="small"
        value={dual ? 'dual' : 'single'}
        onChange={(_, value) => value && onDualChange(value === 'dual')}
        aria-label={labels.languageDisplay}
        sx={{
          gridColumn: { xs: '1 / -1', sm: 'auto' },
          '& .MuiToggleButton-root': {
            minHeight: 44,
            px: compact ? 1.5 : 2,
            flex: { xs: 1, sm: 'initial' },
          },
        }}
      >
        <ToggleButton value="single">
          <TranslateRoundedIcon sx={{ fontSize: 18, mr: 0.75 }} />
          {labels.single}
        </ToggleButton>
        <ToggleButton value="dual">{labels.dual}</ToggleButton>
      </ToggleButtonGroup>

      <FormControl size="small" sx={{ minWidth: { sm: 150 } }}>
        <InputLabel id="primary-language-label">{labels.primaryLanguage}</InputLabel>
        <Select
          labelId="primary-language-label"
          value={primaryLanguage}
          label={labels.primaryLanguage}
          onChange={(event) => onPrimaryChange(event.target.value)}
        >
          {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
            <MenuItem key={code} value={code} disabled={dual && code === secondaryLanguage}>
              {label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {dual && (
        <FormControl size="small" sx={{ minWidth: { sm: 150 } }}>
          <InputLabel id="secondary-language-label">{labels.secondaryLanguage}</InputLabel>
          <Select
            labelId="secondary-language-label"
            value={secondaryLanguage}
            label={labels.secondaryLanguage}
            onChange={(event) => onSecondaryChange(event.target.value)}
          >
            {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
              <MenuItem key={code} value={code} disabled={code === primaryLanguage}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Box>
  );
}
