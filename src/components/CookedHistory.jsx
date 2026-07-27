import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { localize } from './MultilingualText';

export default function CookedHistory({
  open,
  onClose,
  records,
  recipes,
  primaryLanguage,
  labels,
  onOpenRecipe,
  onClear,
}) {
  const recipeMap = new Map(recipes.map((recipe) => [String(recipe.id), recipe]));

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      aria-labelledby="cooked-history-title"
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          maxWidth: '100%',
          bgcolor: 'background.default',
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        sx={{ px: 2, py: 1.5, bgcolor: 'background.paper' }}
      >
        <HistoryRoundedIcon color="primary" />
        <Box sx={{ flexGrow: 1 }}>
          <Typography id="cooked-history-title" variant="h4">
            {labels.cookedHistory}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {records.length} {labels.records}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label={labels.close}>
          <CloseRoundedIcon />
        </IconButton>
      </Stack>
      <Divider />

      {records.length ? (
        <>
          <List sx={{ flexGrow: 1, overflowY: 'auto', p: 1.5 }}>
            {records.map((record, index) => {
              const recipe = recipeMap.get(String(record.recipeId || record.id));
              const title = recipe
                ? localize(recipe.title, primaryLanguage)
                : record.title || labels.unknownRecipe;
              const cookedAt = new Date(record.cookedAt);
              const date = Number.isNaN(cookedAt.getTime())
                ? ''
                : new Intl.DateTimeFormat(
                    primaryLanguage === 'zh'
                      ? 'zh-HK'
                      : primaryLanguage === 'id'
                        ? 'id-ID'
                        : 'en-HK',
                    { dateStyle: 'medium', timeStyle: 'short' },
                  ).format(cookedAt);
              const details = [
                date,
                record.servings ? `${record.servings} ${labels.servings}` : null,
                record.vegetarianMode ? labels.vegetarianModeShort : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <ListItemButton
                  key={`${record.cookedAt}-${index}`}
                  disabled={!recipe}
                  onClick={() => {
                    onOpenRecipe(recipe);
                    onClose();
                  }}
                  sx={{
                    mb: 1,
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    alignItems: 'flex-start',
                  }}
                >
                  <ListItemText
                    primary={title}
                    secondary={details}
                    primaryTypographyProps={{ fontWeight: 750 }}
                    secondaryTypographyProps={{ sx: { mt: 0.4 } }}
                  />
                </ListItemButton>
              );
            })}
          </List>
          <Box sx={{ p: 2, pt: 0 }}>
            <Button
              fullWidth
              color="error"
              variant="outlined"
              startIcon={<DeleteOutlineRoundedIcon />}
              onClick={onClear}
            >
              {labels.clearHistory}
            </Button>
          </Box>
        </>
      ) : (
        <Box
          sx={{
            flexGrow: 1,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            px: 4,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: '4rem' }}>🍽️</Typography>
            <Typography variant="h4" sx={{ mt: 1 }}>
              {labels.noHistory}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.7 }}>
              {labels.noHistoryHelp}
            </Typography>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
