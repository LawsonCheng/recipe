import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';
import SpaRoundedIcon from '@mui/icons-material/SpaRounded';
import MultilingualText, { localize } from './MultilingualText';
import RecipeImage from './RecipeImage';

export default function RecipeCard({
  recipe,
  primaryLanguage,
  secondaryLanguage,
  dual,
  labels,
  hasBeenCooked,
  onOpen,
  imageUnavailableText,
}) {
  const minutes =
    Number(recipe.prepMinutes || 0) +
    Number(recipe.cookMinutes || recipe.time || 0);
  const tags = Array.isArray(recipe.tags) ? recipe.tags.slice(0, 3) : [];
  const image = recipe.imageUrl || recipe.image;
  const mainIngredient = recipe.ingredients?.[0]?.name;

  return (
    <Card
      component="article"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'transform .18s ease, box-shadow .18s ease',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: 6,
        },
        '&:focus-within': {
          outline: '3px solid',
          outlineColor: 'primary.light',
          outlineOffset: 2,
        },
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <RecipeImage
          src={image}
          alt={localize(recipe.title, primaryLanguage)}
          recipeId={recipe.id}
          recipeTitle={localize(recipe.title, primaryLanguage)}
          cuisine={localize(recipe.cuisine || recipe.category, primaryLanguage)}
          mainIngredient={localize(mainIngredient, primaryLanguage)}
          method={localize(recipe.method || recipe.cookingMethod || tags[0], primaryLanguage)}
          illustrationHint={[
            localize(recipe.description, 'en'),
            recipe.tags.map((tag) => localize(tag, 'en')).join(' '),
          ].join(' ')}
          height={{ xs: 190, sm: 210 }}
          unavailableText={imageUnavailableText}
        />
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ position: 'absolute', left: 12, top: 12, right: 12 }}
        >
          {(recipe.vegetarian || recipe.vegetarianAvailable) && (
            <Chip
              icon={<SpaRoundedIcon />}
              label={
                recipe.vegetarian
                  ? labels.vegetarianRecipe
                  : labels.vegetarianReady
              }
              size="small"
              sx={{
                color: '#174B31',
                bgcolor: 'rgba(234, 249, 237, .94)',
                backdropFilter: 'blur(7px)',
              }}
            />
          )}
          {hasBeenCooked && (
            <Chip
              icon={<CheckCircleRoundedIcon />}
              label={labels.cooked}
              size="small"
              sx={{
                ml: 'auto !important',
                color: '#3A2B0D',
                bgcolor: 'rgba(255, 244, 210, .95)',
                backdropFilter: 'blur(7px)',
              }}
            />
          )}
        </Stack>
      </Box>

      <CardContent
        sx={{
          p: { xs: 2, sm: 2.25 },
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" color="text.secondary">
          <RestaurantMenuRoundedIcon sx={{ fontSize: 18 }} />
          <Typography variant="caption" fontWeight={700}>
            {localize(recipe.cuisine || recipe.category, primaryLanguage)}
          </Typography>
          <Box component="span" sx={{ opacity: 0.45 }}>
            •
          </Box>
          <AccessTimeRoundedIcon sx={{ fontSize: 17 }} />
          <Typography variant="caption" fontWeight={700}>
            {minutes || '—'} {labels.minutesShort}
          </Typography>
        </Stack>

        <MultilingualText
          value={recipe.title}
          primaryLanguage={primaryLanguage}
          secondaryLanguage={secondaryLanguage}
          dual={dual}
          primaryVariant="h3"
          secondaryVariant="body2"
          primarySx={{ mt: 1.1 }}
          secondarySx={{ fontWeight: 600 }}
        />

        <MultilingualText
          value={recipe.description}
          primaryLanguage={primaryLanguage}
          secondaryLanguage={secondaryLanguage}
          dual={false}
          primaryVariant="body2"
          primarySx={{
            mt: 1,
            color: 'text.secondary',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
          }}
        />

        {!!tags.length && (
          <Stack
            direction="row"
            spacing={0.65}
            useFlexGap
            flexWrap="wrap"
            sx={{ mt: 1.5 }}
          >
            {tags.map((tag, index) => (
              <Chip
                key={`${localize(tag, primaryLanguage)}-${index}`}
                label={localize(tag, primaryLanguage)}
                size="small"
                variant="outlined"
                sx={{ height: 26, fontSize: '.72rem' }}
              />
            ))}
          </Stack>
        )}

        <Button
          onClick={() => onOpen(recipe)}
          variant="contained"
          fullWidth
          sx={{ mt: 'auto', pt: 1.25, pb: 1.25, position: 'relative', top: 10 }}
          aria-label={`${labels.viewRecipe}: ${localize(recipe.title, primaryLanguage)}`}
        >
          {labels.viewRecipe}
        </Button>
      </CardContent>
    </Card>
  );
}
