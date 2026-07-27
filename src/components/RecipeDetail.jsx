import {
  AppBar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Slide,
  Stack,
  Switch,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { forwardRef, useEffect, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import KitchenRoundedIcon from '@mui/icons-material/KitchenRounded';
import MicrowaveRoundedIcon from '@mui/icons-material/MicrowaveRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import SpaRoundedIcon from '@mui/icons-material/SpaRounded';
import MultilingualText, { localize } from './MultilingualText';
import RecipeImage from './RecipeImage';

const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const VEGETARIAN_ALTERNATIVES = [
  {
    matches: ['oyster sauce', '蠔油', 'saus tiram'],
    name: { zh: '素蠔油', en: 'vegetarian oyster sauce', id: 'saus tiram vegetarian' },
  },
  {
    matches: ['fish sauce', '魚露', 'kecap ikan'],
    name: { zh: '純素魚露', en: 'vegan fish sauce', id: 'kecap ikan vegan' },
  },
  {
    matches: ['chicken', '雞', 'ayam'],
    name: {
      zh: '素雞條／Impossible-style 植物肉（次選：猴頭菇）',
      en: 'plant-based chicken strips / Impossible-style meat (or lion’s mane mushroom)',
      id: 'strip ayam nabati / daging ala Impossible (atau jamur surai singa)',
    },
  },
  {
    matches: ['beef', '牛', 'sapi'],
    name: {
      zh: 'Impossible-style 素牛肉碎或素肉條（次選：杏鮑菇）',
      en: 'Impossible-style plant beef mince or strips (or king oyster mushroom)',
      id: 'daging sapi nabati ala Impossible cincang atau strip (atau jamur tiram raja)',
    },
  },
  {
    matches: ['pork', '豬', '豚', 'babi'],
    name: {
      zh: 'Impossible-style 素肉碎或素豬肉條（次選：豆腐乾）',
      en: 'Impossible-style plant mince or plant pork strips (or pressed tofu)',
      id: 'daging cincang nabati ala Impossible atau strip babi nabati (atau tahu padat)',
    },
  },
  {
    matches: ['lamb', 'mutton', '羊', 'kambing', 'domba'],
    name: {
      zh: 'Impossible-style 素肉碎或素羊肉條（次選：杏鮑菇）',
      en: 'Impossible-style plant mince or plant lamb strips (or king oyster mushroom)',
      id: 'daging cincang nabati ala Impossible atau strip kambing nabati (atau jamur tiram raja)',
    },
  },
  {
    matches: ['prawn', 'shrimp', '蝦', 'udang'],
    name: { zh: '杏鮑菇或蒟蒻蝦', en: 'king oyster mushroom or konjac prawns', id: 'jamur tiram raja atau udang konnyaku' },
  },
  {
    matches: ['fish', '魚', 'ikan'],
    name: { zh: '硬豆腐或素魚柳', en: 'firm tofu or plant-based fish fillet', id: 'tahu padat atau fillet ikan nabati' },
  },
  {
    matches: ['bacon', 'ham', 'sausage', '煙肉', '火腿', '香腸', '培根', 'sosis'],
    name: { zh: '素火腿或煙燻豆腐', en: 'plant-based ham or smoked tofu', id: 'ham nabati atau tahu asap' },
  },
  {
    matches: ['lard', '豬油', 'lemak babi'],
    name: { zh: '植物油', en: 'vegetable oil', id: 'minyak sayur' },
  },
  {
    matches: ['gelatin', '魚膠', '明膠', 'gelatin'],
    name: { zh: '大菜／寒天粉', en: 'agar-agar', id: 'agar-agar' },
  },
];

export function getVegetarianAlternative(ingredient) {
  const allNames = ['zh', 'en', 'id']
    .map((language) => localize(ingredient.name, language).toLowerCase())
    .join(' ');
  const preferredPlantMeat = VEGETARIAN_ALTERNATIVES.find(
    (alternative) =>
      ['chicken', 'beef', 'pork', 'lamb'].some((meat) =>
        alternative.matches.includes(meat),
      ) &&
      alternative.matches.some((term) => allNames.includes(term.toLowerCase())),
  );
  const explicit =
    ingredient.vegetarianAlternative || ingredient.vegetarianReplacement;
  if (explicit) {
    if (preferredPlantMeat) {
      return {
        ...ingredient,
        name: preferredPlantMeat.name,
        isSubstitution: true,
      };
    }
    return {
      ...ingredient,
      ...explicit,
      name: explicit.name || explicit,
      isSubstitution: true,
    };
  }

  const alreadyVegetarian = [
    'tofu',
    'mushroom',
    'vegetarian',
    'plant-based',
    '豆腐',
    '豆製',
    '菇',
    '素',
    'tahu',
    'jamur',
    'nabati',
    'impossible',
  ].some((term) => allNames.includes(term));
  if (alreadyVegetarian) return ingredient;
  const match = VEGETARIAN_ALTERNATIVES.find((alternative) =>
    alternative.matches.some((term) => allNames.includes(term.toLowerCase())),
  );
  if (!match) return ingredient;
  return { ...ingredient, name: match.name, isSubstitution: true };
}

function adaptTextForVegetarian(value, ingredients, enabled) {
  if (!enabled || !value) return value;
  if (typeof value === 'string') {
    return ingredients.reduce((text, ingredient) => {
      const alternative = getVegetarianAlternative(ingredient);
      if (!alternative.isSubstitution) return text;
      const original = localize(ingredient.name, 'en');
      const replacement = localize(alternative.name, 'en');
      return original && replacement ? text.split(original).join(replacement) : text;
    }, value);
  }

  return ['zh', 'en', 'id'].reduce((translated, language) => {
    let text = localize(value, language);
    ingredients.forEach((ingredient) => {
      const alternative = getVegetarianAlternative(ingredient);
      if (!alternative.isSubstitution) return;
      const original = localize(ingredient.name, language);
      const replacement = localize(alternative.name, language);
      if (original && replacement) text = text.split(original).join(replacement);
    });
    translated[language] = text;
    return translated;
  }, {});
}

function stepPhoto(step) {
  const source = step.imageUrl || step.image;
  if (!source || source.endsWith('/assets/home-table-hero.webp')) return undefined;
  return source;
}

function greatestCommonDivisor(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) [left, right] = [right, left % right];
  return left || 1;
}

function formatAmount(amount, scale) {
  if (amount === '' || amount == null) return '';
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return amount;
  const value = numeric * scale;
  if (Math.abs(value) < 0.0001) return '0';
  if (value >= 20) {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
  }

  const whole = Math.floor(value + 0.00001);
  const remainder = value - whole;
  const denominators = [2, 3, 4, 6, 8, 12, 16];
  let best = null;
  denominators.forEach((denominator) => {
    const numerator = Math.round(remainder * denominator);
    const error = Math.abs(remainder - numerator / denominator);
    if (numerator && (!best || error < best.error)) {
      best = { numerator, denominator, error };
    }
  });
  if (best && best.error < 0.012) {
    const divisor = greatestCommonDivisor(best.numerator, best.denominator);
    const numerator = best.numerator / divisor;
    const denominator = best.denominator / divisor;
    return `${whole ? `${whole} ` : ''}${numerator}/${denominator}`;
  }
  return String(Number(value.toFixed(value < 1 ? 2 : 1)));
}

const SCALABLE_QUANTITY_UNITS =
  /(?<![\d.])(\d+(?:\.\d+)?)(\s*)(kg|g|ml|l|tbsp|tsp|cups?|cloves?|stalks?|pieces?|公斤|克|毫升|公升|湯匙|茶匙|杯|瓣|條|件|個|隻|片|sdm|sdt|cangkir|siung|batang|buah)(?![a-z])/gi;

function scaleInstructionQuantities(value, scale) {
  if (!value || scale === 1) return value;
  const scaleText = (text) =>
    text.replace(
      SCALABLE_QUANTITY_UNITS,
      (_match, amount, spacing, unit) =>
        `${formatAmount(Number(amount), scale)}${spacing}${unit}`,
    );
  if (typeof value === 'string') return scaleText(value);
  return Object.fromEntries(
    ['zh', 'en', 'id'].map((language) => [
      language,
      scaleText(localize(value, language)),
    ]),
  );
}

function metadataText(value, language) {
  if (value == null || value === '' || value === false) return '';
  if (value === true) return language === 'zh' ? '是' : language === 'id' ? 'Ya' : 'Yes';
  if (typeof value === 'object') return localize(value, language);
  return String(value);
}

function ApplianceSummary({ appliance, primaryLanguage, labels }) {
  if (!appliance || typeof appliance !== 'object') return null;
  const yesNo = (value) =>
    value
      ? primaryLanguage === 'zh'
        ? '是'
        : primaryLanguage === 'id'
          ? 'Ya'
          : 'Yes'
      : primaryLanguage === 'zh'
        ? '否'
        : primaryLanguage === 'id'
          ? 'Tidak'
          : 'No';
  const waterTank = appliance.waterTank != null
    ? primaryLanguage === 'zh'
      ? `水箱: ${appliance.waterTank ? '加滿' : '不使用'}`
      : primaryLanguage === 'id'
        ? `Tangki air: ${appliance.waterTank ? 'isi penuh' : 'tidak digunakan'}`
        : `Water tank: ${appliance.waterTank ? 'fill' : 'not used'}`
    : null;
  const fields = [
    appliance.mode && metadataText(appliance.mode, primaryLanguage),
    appliance.temperatureC && `${appliance.temperatureC}°C`,
    appliance.autoMenu && `Auto ${metadataText(appliance.autoMenu, primaryLanguage)}`,
    appliance.preheat != null &&
      `${primaryLanguage === 'zh' ? '預熱' : primaryLanguage === 'id' ? 'Panaskan awal' : 'Preheat'}: ${yesNo(appliance.preheat)}`,
    appliance.rack && metadataText(appliance.rack, primaryLanguage),
    waterTank,
    appliance.vessel && metadataText(appliance.vessel, primaryLanguage),
  ].filter(Boolean);
  if (!fields.length && !appliance.model) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        mt: 1.5,
        p: 1.6,
        borderColor: 'primary.light',
        bgcolor: 'rgba(237,247,244,.72)',
      }}
    >
      <Stack direction="row" spacing={1.1} alignItems="flex-start">
        <MicrowaveRoundedIcon color="primary" sx={{ mt: 0.2 }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={850}>
            {labels.ovenSettings}
          </Typography>
          <Typography variant="body2" fontWeight={750} sx={{ mt: 0.25 }}>
            {metadataText(appliance.model, primaryLanguage) || 'Toshiba MX2-TT20SC'}
          </Typography>
          {!!fields.length && (
            <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.7} sx={{ mt: 0.9 }}>
              {fields.map((field, index) => (
                <Chip key={`${field}-${index}`} label={field} size="small" />
              ))}
            </Stack>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

function IngredientRow({
  ingredient,
  vegetarianMode,
  primaryLanguage,
  secondaryLanguage,
  dual,
  labels,
  scale,
}) {
  const shown = vegetarianMode
    ? getVegetarianAlternative(ingredient)
    : ingredient;
  const amount = formatAmount(shown.amount ?? ingredient.amount ?? '', scale);
  const unit = localize(shown.unit || ingredient.unit, primaryLanguage);

  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 1.5,
        alignItems: 'center',
        py: 1.35,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Box>
        <MultilingualText
          value={shown.name}
          primaryLanguage={primaryLanguage}
          secondaryLanguage={secondaryLanguage}
          dual={dual}
          primarySx={{ fontWeight: 700 }}
          secondarySx={{ fontSize: '.78rem' }}
        />
        {shown.isSubstitution && (
          <Chip
            icon={<SpaRoundedIcon />}
            label={labels.substitution}
            color="success"
            size="small"
            variant="outlined"
            sx={{ mt: 0.65, height: 24, fontSize: '.7rem' }}
          />
        )}
      </Box>
      <Typography fontWeight={800} color="primary.dark" textAlign="right">
        {amount} {unit}
      </Typography>
    </Box>
  );
}

export default function RecipeDetail({
  open,
  recipe,
  onClose,
  primaryLanguage,
  secondaryLanguage,
  dual,
  vegetarianMode,
  onVegetarianModeChange,
  labels,
  onMarkCooked,
  hasBeenCooked,
  imageUnavailableText,
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectedServings, setSelectedServings] = useState(3);
  useEffect(() => {
    if (open && recipe) setSelectedServings(3);
  }, [open, recipe?.id]);
  if (!recipe) return null;

  const baseServings = Number(recipe.servings) > 0 ? Number(recipe.servings) : 3;
  const servingScale = selectedServings / baseServings;
  const prepMinutes = Number(recipe.prepMinutes || 0);
  const cookMinutes = Number(recipe.cookMinutes || recipe.time || 0);
  const totalMinutes = prepMinutes + cookMinutes;
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  const equipment = Array.isArray(recipe.equipment) ? recipe.equipment : [];
  const mainIngredient = ingredients[0]?.name;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="lg"
      fullWidth
      TransitionComponent={Transition}
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: 3 },
          height: { sm: 'min(92vh, 980px)' },
          overflow: 'hidden',
        },
      }}
      aria-labelledby="recipe-detail-title"
    >
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" onClick={onClose} aria-label={labels.back}>
            <ArrowBackRoundedIcon />
          </IconButton>
          <Typography
            id="recipe-detail-title"
            variant="subtitle1"
            fontWeight={800}
            noWrap
            sx={{ flexGrow: 1 }}
          >
            {localize(recipe.title, primaryLanguage)}
          </Typography>
          {hasBeenCooked && (
            <Chip
              icon={<CheckCircleRoundedIcon />}
              label={labels.cooked}
              color="success"
              size="small"
              variant="outlined"
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            />
          )}
        </Toolbar>
      </AppBar>

      <DialogContent sx={{ p: 0, bgcolor: 'background.default' }}>
        <RecipeImage
          src={recipe.imageUrl || recipe.image}
          alt={localize(recipe.title, primaryLanguage)}
          recipeId={recipe.id}
          recipeTitle={localize(recipe.title, primaryLanguage)}
          cuisine={localize(recipe.cuisine || recipe.category, primaryLanguage)}
          mainIngredient={localize(mainIngredient, primaryLanguage)}
          method={localize(recipe.method || recipe.cookingMethod || recipe.tags?.[0], primaryLanguage)}
          illustrationHint={[
            localize(recipe.description, 'en'),
            recipe.tags?.map((tag) => localize(tag, 'en')).join(' '),
          ].join(' ')}
          height={{ xs: 250, sm: 360 }}
          loading="eager"
          unavailableText={imageUnavailableText}
        />

        <Box sx={{ maxWidth: 980, mx: 'auto', px: { xs: 2, sm: 4 }, py: { xs: 2.5, sm: 4 } }}>
          <MultilingualText
            value={recipe.title}
            primaryLanguage={primaryLanguage}
            secondaryLanguage={secondaryLanguage}
            dual={dual}
            primaryVariant="h2"
            secondaryVariant="h4"
            secondarySx={{ mt: 0.5 }}
          />
          <MultilingualText
            value={recipe.description}
            primaryLanguage={primaryLanguage}
            secondaryLanguage={secondaryLanguage}
            dual={dual}
            primarySx={{ mt: 1.3 }}
            secondarySx={{ mt: 0.7 }}
          />

          <Box
            sx={{
              mt: 2.2,
              display: 'flex',
              gap: 1.5,
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              flexDirection: { xs: 'column', sm: 'row' },
            }}
          >
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip
                icon={<AccessTimeRoundedIcon />}
                label={`${totalMinutes || '—'} ${labels.minutes}`}
                variant="outlined"
              />
              <Chip
                label={localize(recipe.difficulty, primaryLanguage)}
                variant="outlined"
              />
            </Stack>
            <Paper
              variant="outlined"
              role="group"
              aria-label={labels.servingSize}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minWidth: { sm: 268 },
                p: 0.55,
                pl: 1.4,
                borderColor: 'primary.light',
              }}
            >
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mr: 1 }}>
                <GroupsRoundedIcon color="primary" fontSize="small" />
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={750} display="block">
                    {labels.servingSize}
                  </Typography>
                  <Typography fontWeight={900} lineHeight={1.1}>
                    {selectedServings} {labels.servings}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={0.35}>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={selectedServings <= 1}
                  onClick={() => setSelectedServings((current) => Math.max(1, current - 1))}
                  aria-label={labels.decreaseServings}
                  sx={{ border: '1px solid', borderColor: 'divider' }}
                >
                  <RemoveRoundedIcon />
                </IconButton>
                <IconButton
                  size="small"
                  color="primary"
                  disabled={selectedServings >= 8}
                  onClick={() => setSelectedServings((current) => Math.min(8, current + 1))}
                  aria-label={labels.increaseServings}
                  sx={{ border: '1px solid', borderColor: 'divider' }}
                >
                  <AddRoundedIcon />
                </IconButton>
              </Stack>
            </Paper>
          </Box>

          {!!equipment.length && (
            <Paper variant="outlined" sx={{ mt: 1.5, p: 1.6 }}>
              <Stack direction="row" spacing={1.1} alignItems="flex-start">
                <KitchenRoundedIcon color="primary" sx={{ mt: 0.2 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={850}>
                    {labels.equipment}
                  </Typography>
                  <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.7} sx={{ mt: 0.8 }}>
                    {equipment.map((item, index) => {
                      const name = metadataText(
                        typeof item === 'object' ? item.name || item.type : item,
                        primaryLanguage,
                      );
                      const type = typeof item === 'object'
                        ? metadataText(item.type, primaryLanguage)
                        : '';
                      return (
                        <Chip
                          key={`${name}-${index}`}
                          label={[name, type && type !== name ? type : ''].filter(Boolean).join(' · ')}
                          size="small"
                          variant="outlined"
                        />
                      );
                    })}
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          )}
          <ApplianceSummary
            appliance={recipe.appliance}
            primaryLanguage={primaryLanguage}
            labels={labels}
          />

          <Paper
            variant="outlined"
            sx={{
              mt: 3,
              p: { xs: 1.5, sm: 2 },
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1,
              bgcolor: vegetarianMode ? '#EDF8F0' : 'background.paper',
              borderColor: vegetarianMode ? 'success.light' : 'divider',
            }}
          >
            <Box>
              <Typography variant="h4">{labels.vegetarianMode}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {labels.vegetarianModeHelp}
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={vegetarianMode}
                  onChange={(event) => onVegetarianModeChange(event.target.checked)}
                  color="success"
                />
              }
              label={vegetarianMode ? labels.on : labels.off}
              sx={{ ml: { xs: 0, sm: 2 }, mr: 0 }}
            />
          </Paper>

          {vegetarianMode && recipe.vegetarianNotes && (
            <Box
              sx={{
                mt: 1.5,
                px: 2,
                py: 1.4,
                bgcolor: '#F4FAF5',
                borderRadius: 2,
                borderLeft: '4px solid',
                borderColor: 'success.main',
              }}
            >
              <MultilingualText
                value={recipe.vegetarianNotes}
                primaryLanguage={primaryLanguage}
                secondaryLanguage={secondaryLanguage}
                dual={dual}
                primarySx={{ fontSize: '.9rem' }}
                secondarySx={{ fontSize: '.8rem' }}
              />
              <Typography
                variant="caption"
                component="p"
                color="success.dark"
                fontWeight={750}
                sx={{ mt: 0.8, mb: 0 }}
              >
                {labels.vegetarianImageNote}
              </Typography>
            </Box>
          )}

          <Box
            sx={{
              mt: 4,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, .72fr) minmax(0, 1.28fr)' },
              gap: { xs: 4, md: 5 },
              alignItems: 'start',
            }}
          >
            <Box component="section" aria-labelledby="ingredients-title">
              <Typography id="ingredients-title" variant="h3">
                {labels.ingredients}
              </Typography>
              <Paper variant="outlined" sx={{ mt: 1.5, px: 2 }}>
                <Box component="ul" sx={{ m: 0, p: 0 }}>
                  {ingredients.map((ingredient, index) => (
                    <IngredientRow
                      key={ingredient.id || `${localize(ingredient.name, 'en')}-${index}`}
                      ingredient={ingredient}
                      vegetarianMode={vegetarianMode}
                      primaryLanguage={primaryLanguage}
                      secondaryLanguage={secondaryLanguage}
                      dual={dual}
                      labels={labels}
                      scale={servingScale}
                    />
                  ))}
                </Box>
              </Paper>
            </Box>

            <Box component="section" aria-labelledby="steps-title">
              <Typography id="steps-title" variant="h3">
                {labels.steps}
              </Typography>
              <Stack spacing={2} sx={{ mt: 1.5 }}>
                {steps.map((step, index) => {
                  const stepNumber = step.order || index + 1;
                  const shownTitle = adaptTextForVegetarian(
                    step.title,
                    ingredients,
                    vegetarianMode,
                  );
                  const shownInstruction = scaleInstructionQuantities(
                    adaptTextForVegetarian(
                      step.instruction,
                      ingredients,
                      vegetarianMode,
                    ),
                    servingScale,
                  );
                  return (
                    <Paper key={`${recipe.id}-step-${stepNumber}`} variant="outlined" sx={{ overflow: 'hidden' }}>
                      <RecipeImage
                        src={stepPhoto(step)}
                        alt={[
                          localize(recipe.title, primaryLanguage),
                          `${labels.step} ${stepNumber}`,
                          localize(shownTitle, primaryLanguage),
                        ].filter(Boolean).join(' — ')}
                        recipeId={`${recipe.id}-${stepNumber}`}
                        recipeTitle={localize(recipe.title, primaryLanguage)}
                        cuisine={localize(recipe.cuisine || recipe.category, primaryLanguage)}
                        mainIngredient={localize(mainIngredient, primaryLanguage)}
                        method={localize(recipe.appliance?.mode || recipe.method || recipe.cookingMethod, primaryLanguage)}
                        stepTitle={localize(shownTitle, primaryLanguage)}
                        stepNumber={stepNumber}
                        kind="step"
                        illustrationHint={`${localize(shownTitle, primaryLanguage)} ${localize(shownInstruction, primaryLanguage)}`}
                        height={{ xs: 190, sm: 250 }}
                        unavailableText={imageUnavailableText}
                      />
                      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                        <Stack direction="row" spacing={1.3} alignItems="flex-start">
                          <Box
                            sx={{
                              flex: '0 0 auto',
                              width: 38,
                              height: 38,
                              display: 'grid',
                              placeItems: 'center',
                              borderRadius: '50%',
                              bgcolor: 'primary.main',
                              color: 'primary.contrastText',
                              fontWeight: 900,
                            }}
                          >
                            {stepNumber}
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            {shownTitle && (
                              <MultilingualText
                                value={shownTitle}
                                primaryLanguage={primaryLanguage}
                                secondaryLanguage={secondaryLanguage}
                                dual={dual}
                                primaryVariant="h4"
                                secondaryVariant="subtitle2"
                              />
                            )}
                            <MultilingualText
                              value={shownInstruction}
                              primaryLanguage={primaryLanguage}
                              secondaryLanguage={secondaryLanguage}
                              dual={dual}
                              primarySx={{ mt: shownTitle ? 0.7 : 0.15, whiteSpace: 'pre-line' }}
                              secondarySx={{ mt: 0.7, whiteSpace: 'pre-line' }}
                            />
                          </Box>
                        </Stack>
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <Divider />
      <Box
        sx={{
          p: { xs: 1.25, sm: 1.5 },
          bgcolor: 'background.paper',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
          pb: { xs: 'max(10px, env(safe-area-inset-bottom))', sm: 1.5 },
        }}
      >
        <Button variant="outlined" onClick={onClose}>
          {labels.back}
        </Button>
        <Button
          variant="contained"
          color={hasBeenCooked ? 'success' : 'primary'}
          startIcon={<CheckCircleRoundedIcon />}
          onClick={() =>
            onMarkCooked(recipe, {
              servings: selectedServings,
              vegetarianMode,
            })
          }
        >
          {labels.markCooked}
        </Button>
      </Box>
    </Dialog>
  );
}
