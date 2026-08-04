import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppBar,
  Badge,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SpaRoundedIcon from '@mui/icons-material/SpaRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import recipesUrl from 'virtual:runtime-recipes-url';
import CookedHistory from './components/CookedHistory';
import LanguageControls from './components/LanguageControls';
import { localize } from './components/MultilingualText';
import RecipeCard from './components/RecipeCard';
import RecipeDetail from './components/RecipeDetail';
import './index.css';

const STORAGE_KEYS = {
  history: 'home-table:cooked-history',
  preferences: 'home-table:preferences',
};
const STORAGE_VERSION = 2;
const PAGE_SIZE = 24;
const SUPPORTED_LANGUAGES = new Set(['zh', 'en', 'id', 'fil']);

const COPY = {
  zh: {
    appName: '今晚食乜餸',
    appTagline: '清楚步驟，安心煮好每一餐',
    heroEyebrow: '為香港家庭而設',
    heroTitle: '今晚食咩？',
    heroDescription:
      '香港家庭菜與素食創意食譜集中在一起。可按菜名、食材和標籤快速揀選今晚想煮的一道。',
    searchPlaceholder: '搜尋菜名、食材、菜系或標籤…',
    surpriseMe: '隨機選一道',
    languageDisplay: '語言顯示',
    single: '單語',
    dual: '雙語對照',
    primaryLanguage: '主要語言',
    secondaryLanguage: '對照語言',
    filters: '篩選',
    allCuisines: '所有菜系',
    popularTags: '常用標籤',
    clearFilters: '清除篩選',
    recipesFound: '道菜',
    cookedHistory: '煮過紀錄',
    records: '次紀錄',
    clearHistory: '清除全部紀錄',
    noHistory: '還未有煮過紀錄',
    noHistoryHelp: '完成一道菜後按「記錄已煮」便會儲存在這部裝置。',
    unknownRecipe: '已移除的菜譜',
    close: '關閉',
    cooked: '煮過',
    viewRecipe: '查看完整菜譜',
    vegetarianReady: '可轉素食',
    vegetarianRecipe: '素食食譜',
    vegetarianOriginalHelp: '這道菜本身已是素食，不需要開啟替換模式。',
    recipeHighlights: '食譜重點',
    keyIngredients: '主要材料',
    methodHighlights: '做法重點',
    vegetarianMode: '蛋奶素食模式',
    vegetarianModeShort: '素食模式',
    vegetarianModeHelp: '開啟後，豬牛羊雞優先換成 Impossible-style 素肉碎或素肉條；豆腐及菇菌作次選，動物性調味料亦會換成素食版本。',
    vegetarianImageNote: '步驟相片示範原版菜式的形態及操作；素食模式請以綠色替換材料及步驟文字為準。',
    substitution: '素食替換',
    on: '已開啟',
    off: '已關閉',
    ingredients: '材料',
    steps: '詳細步驟',
    step: '步驟',
    minutes: '分鐘',
    minutesShort: '分鐘',
    servings: '人份',
    servingSize: '調整人數',
    decreaseServings: '減少一人份',
    increaseServings: '增加一人份',
    equipment: '所需器具',
    ovenSettings: 'Toshiba 爐設定',
    markCooked: '記錄已煮',
    back: '返回',
    savedCooked: '已記錄！下次可以在「煮過紀錄」查看。',
    noResults: '找不到合適菜式',
    noResultsHelp: '試試較短的關鍵字，或清除菜系和標籤篩選。',
    showAll: '顯示全部',
    browseTitle: '揀一道今日想煮的菜',
    browseDescription: '可搜尋食材、菜系和菜式；所有資料只儲存在你的裝置。',
    footer: '為香港家庭設計 · 資料保存在此裝置',
    loadingRecipes: '正在載入菜譜…',
    loadError: '菜譜暫時載入不到',
    loadErrorHelp: '請檢查網絡後再試；你已儲存的煮食紀錄不會受影響。',
    retry: '重新載入',
    loadMore: '顯示更多菜譜',
    showingCount: '現正顯示',
    imageUnavailable: '這張教學圖片暫時無法顯示',
    storageUnavailable: '此瀏覽器未能儲存設定或煮食紀錄。請檢查私隱／儲存空間設定。',
  },
  en: {
    appName: '今晚食乜餸',
    appTagline: 'Clear steps for a good meal, every time',
    heroEyebrow: 'Made for Hong Kong families',
    heroTitle: 'What shall we cook tonight?',
    heroDescription:
      'Hong Kong family dishes and vegetarian ideas in one collection. Search by dish, ingredient or tag to choose what to cook tonight.',
    searchPlaceholder: 'Search dishes, ingredients, cuisines or tags…',
    surpriseMe: 'Pick one for me',
    languageDisplay: 'Language display',
    single: 'One language',
    dual: 'Side by side',
    primaryLanguage: 'Main language',
    secondaryLanguage: 'Translation',
    filters: 'Filters',
    allCuisines: 'All cuisines',
    popularTags: 'Popular tags',
    clearFilters: 'Clear filters',
    recipesFound: 'recipes',
    cookedHistory: 'Cooking history',
    records: 'records',
    clearHistory: 'Clear all history',
    noHistory: 'Nothing cooked yet',
    noHistoryHelp: 'After cooking a dish, tap “Mark as cooked” to save it on this device.',
    unknownRecipe: 'Removed recipe',
    close: 'Close',
    cooked: 'Cooked',
    viewRecipe: 'View full recipe',
    vegetarianReady: 'Vegetarian option',
    vegetarianRecipe: 'Vegetarian recipe',
    vegetarianOriginalHelp: 'This dish is already vegetarian, so no substitution mode is needed.',
    recipeHighlights: 'Recipe highlights',
    keyIngredients: 'Key ingredients',
    methodHighlights: 'Method highlights',
    vegetarianMode: 'Lacto-ovo vegetarian mode',
    vegetarianModeShort: 'Vegetarian mode',
    vegetarianModeHelp: 'Pork, beef, lamb and chicken are replaced first with Impossible-style plant mince or strips; tofu and mushrooms are secondary choices. Animal-based seasonings are also swapped.',
    vegetarianImageNote: 'Step photos demonstrate the original dish’s form and technique. In vegetarian mode, follow the green substituted ingredients and step text.',
    substitution: 'Vegetarian swap',
    on: 'On',
    off: 'Off',
    ingredients: 'Ingredients',
    steps: 'Detailed steps',
    step: 'Step',
    minutes: 'minutes',
    minutesShort: 'min',
    servings: 'servings',
    servingSize: 'Adjust servings',
    decreaseServings: 'Decrease by one serving',
    increaseServings: 'Increase by one serving',
    equipment: 'Equipment needed',
    ovenSettings: 'Toshiba oven settings',
    markCooked: 'Mark as cooked',
    back: 'Back',
    savedCooked: 'Saved! You can find it in Cooking history next time.',
    noResults: 'No matching recipes',
    noResultsHelp: 'Try a shorter keyword or clear the cuisine and tag filters.',
    showAll: 'Show all',
    browseTitle: 'Choose something good to cook',
    browseDescription: 'Search by ingredient, cuisine or dish. Your history stays on this device.',
    footer: 'Designed for Hong Kong families · Data stays on this device',
    loadingRecipes: 'Loading recipes…',
    loadError: 'Recipes could not be loaded',
    loadErrorHelp: 'Check your connection and try again. Your saved cooking history is unaffected.',
    retry: 'Try again',
    loadMore: 'Show more recipes',
    showingCount: 'Showing',
    imageUnavailable: 'This instructional image is temporarily unavailable',
    storageUnavailable: 'This browser could not save your settings or cooking history. Check privacy or storage settings.',
  },
  id: {
    appName: '今晚食乜餸',
    appTagline: 'Langkah jelas agar masakan selalu berhasil',
    heroEyebrow: 'Dibuat untuk keluarga Hong Kong',
    heroTitle: 'Mau masak apa malam ini?',
    heroDescription:
      'Masakan keluarga Hong Kong dan ide vegetarian dalam satu koleksi. Cari berdasarkan masakan, bahan, atau tag untuk memilih menu malam ini.',
    searchPlaceholder: 'Cari masakan, bahan, jenis masakan, atau tag…',
    surpriseMe: 'Pilihkan satu',
    languageDisplay: 'Tampilan bahasa',
    single: 'Satu bahasa',
    dual: 'Dua bahasa',
    primaryLanguage: 'Bahasa utama',
    secondaryLanguage: 'Terjemahan',
    filters: 'Filter',
    allCuisines: 'Semua jenis masakan',
    popularTags: 'Tag populer',
    clearFilters: 'Hapus filter',
    recipesFound: 'resep',
    cookedHistory: 'Riwayat memasak',
    records: 'catatan',
    clearHistory: 'Hapus semua riwayat',
    noHistory: 'Belum ada masakan',
    noHistoryHelp: 'Setelah memasak, tekan “Tandai sudah dimasak” untuk menyimpannya di perangkat ini.',
    unknownRecipe: 'Resep yang sudah dihapus',
    close: 'Tutup',
    cooked: 'Pernah dimasak',
    viewRecipe: 'Lihat resep lengkap',
    vegetarianReady: 'Ada pilihan vegetarian',
    vegetarianRecipe: 'Resep vegetarian',
    vegetarianOriginalHelp: 'Hidangan ini sudah vegetarian, jadi mode pengganti tidak diperlukan.',
    recipeHighlights: 'Sorotan resep',
    keyIngredients: 'Bahan utama',
    methodHighlights: 'Ringkasan cara',
    vegetarianMode: 'Mode vegetarian lakto-ovo',
    vegetarianModeShort: 'Mode vegetarian',
    vegetarianModeHelp: 'Babi, sapi, kambing, dan ayam terutama diganti dengan daging cincang atau strip nabati ala Impossible; tahu dan jamur menjadi pilihan kedua. Bumbu hewani juga diganti.',
    vegetarianImageNote: 'Foto langkah menunjukkan bentuk dan teknik resep asli. Dalam mode vegetarian, ikuti bahan pengganti dan teks langkah berwarna hijau.',
    substitution: 'Pengganti vegetarian',
    on: 'Aktif',
    off: 'Nonaktif',
    ingredients: 'Bahan',
    steps: 'Langkah lengkap',
    step: 'Langkah',
    minutes: 'menit',
    minutesShort: 'mnt',
    servings: 'porsi',
    servingSize: 'Atur jumlah porsi',
    decreaseServings: 'Kurangi satu porsi',
    increaseServings: 'Tambah satu porsi',
    equipment: 'Peralatan yang diperlukan',
    ovenSettings: 'Pengaturan oven Toshiba',
    markCooked: 'Tandai sudah dimasak',
    back: 'Kembali',
    savedCooked: 'Tersimpan! Lihat kembali di Riwayat memasak.',
    noResults: 'Resep tidak ditemukan',
    noResultsHelp: 'Coba kata kunci lebih pendek atau hapus filter jenis masakan dan tag.',
    showAll: 'Tampilkan semua',
    browseTitle: 'Pilih masakan untuk hari ini',
    browseDescription: 'Cari berdasarkan bahan, jenis masakan, atau nama hidangan. Riwayat hanya tersimpan di perangkat ini.',
    footer: 'Dibuat untuk keluarga Hong Kong · Data tersimpan di perangkat ini',
    loadingRecipes: 'Memuat resep…',
    loadError: 'Resep tidak dapat dimuat',
    loadErrorHelp: 'Periksa koneksi lalu coba lagi. Riwayat memasak yang tersimpan tidak terpengaruh.',
    retry: 'Coba lagi',
    loadMore: 'Tampilkan lebih banyak resep',
    showingCount: 'Menampilkan',
    imageUnavailable: 'Gambar petunjuk ini sementara tidak tersedia',
    storageUnavailable: 'Browser ini tidak dapat menyimpan pengaturan atau riwayat memasak. Periksa pengaturan privasi atau penyimpanan.',
  },
};

// Filipino recipe content is available for the completed Veggie Deer
// collection. Interface copy falls back to the established English wording
// where a non-recipe page has not supplied a Filipino-specific label.
COPY.fil = { ...COPY.en };

function readStoredValue(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function safelyWrite(key, data) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ version: STORAGE_VERSION, data }),
    );
    return true;
  } catch {
    return false;
  }
}

function storedData(value) {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Number(value.version) >= 1 &&
    'data' in value
  ) {
    return value.data;
  }
  return value;
}

function readPreferences() {
  const fallback = {
    primaryLanguage: 'zh',
    secondaryLanguage: 'id',
    dual: true,
    vegetarianMode: false,
  };
  const value = storedData(readStoredValue(STORAGE_KEYS.preferences));
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;

  const primaryLanguage = SUPPORTED_LANGUAGES.has(value.primaryLanguage)
    ? value.primaryLanguage
    : fallback.primaryLanguage;
  let secondaryLanguage = SUPPORTED_LANGUAGES.has(value.secondaryLanguage)
    ? value.secondaryLanguage
    : fallback.secondaryLanguage;
  if (secondaryLanguage === primaryLanguage) {
    secondaryLanguage = ['zh', 'en', 'id', 'fil'].find((language) => language !== primaryLanguage) || 'zh';
  }

  return {
    primaryLanguage,
    secondaryLanguage,
    dual: value.dual !== false,
    vegetarianMode: Boolean(value.vegetarianMode),
  };
}

function readHistory() {
  const value = storedData(readStoredValue(STORAGE_KEYS.history));
  if (!Array.isArray(value)) return [];

  return value
    .filter((record) => record && typeof record === 'object')
    .map((record) => {
      const cookedAt = new Date(record.cookedAt);
      return {
        recipeId: String(record.recipeId || record.id || ''),
        title: typeof record.title === 'string' ? record.title : '',
        cookedAt: Number.isNaN(cookedAt.getTime())
          ? null
          : cookedAt.toISOString(),
        servings: Math.min(8, Math.max(1, Number(record.servings) || 3)),
        vegetarianMode: Boolean(record.vegetarianMode),
      };
    })
    .filter((record) => record.recipeId && record.cookedAt)
    .slice(0, 100);
}

function multilingualSearchText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(multilingualSearchText).join(' ');
  return Object.values(value).map(multilingualSearchText).join(' ');
}

function expandSearchAliases(value) {
  const text = value.toLocaleLowerCase();
  const aliases = [];
  if (text.includes('rice bake')) aliases.push('baked rice');
  if (text.includes('baked rice')) aliases.push('rice bake');
  return `${text} ${aliases.join(' ')}`;
}

function normalizeRecipe(recipe, index) {
  return {
    ...recipe,
    id: recipe.id || recipe.slug || `recipe-${index + 1}`,
    tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    steps: Array.isArray(recipe.steps) ? recipe.steps : [],
  };
}

function recipeFromLocation(recipes) {
  if (typeof window === 'undefined') return null;
  const requested = new URL(window.location.href).searchParams.get('recipe');
  if (!requested) return null;
  return (
    recipes.find(
      (recipe) =>
        String(recipe.slug || '') === requested || String(recipe.id) === requested,
    ) || null
  );
}

function App() {
  const initialPreferences = useMemo(readPreferences, []);

  const [primaryLanguage, setPrimaryLanguage] = useState(
    initialPreferences.primaryLanguage || 'zh',
  );
  const [secondaryLanguage, setSecondaryLanguage] = useState(
    initialPreferences.secondaryLanguage || 'id',
  );
  const [dual, setDual] = useState(initialPreferences.dual !== false);
  const [vegetarianMode, setVegetarianMode] = useState(
    Boolean(initialPreferences.vegetarianMode),
  );
  const [query, setQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [history, setHistory] = useState(readHistory);
  const [recipes, setRecipes] = useState([]);
  const [recipesStatus, setRecipesStatus] = useState('loading');
  const [recipeLoadAttempt, setRecipeLoadAttempt] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [persistenceUnavailable, setPersistenceUnavailable] = useState(false);

  const labels = COPY[primaryLanguage] || COPY.zh;

  useEffect(() => {
    const controller = new AbortController();
    setRecipesStatus('loading');

    fetch(recipesUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Recipe data request failed (${response.status})`);
        }
        return response.json();
      })
      .then((data) => {
        const source = Array.isArray(data) ? data : data?.recipes;
        if (!Array.isArray(source) || source.length === 0) {
          throw new Error('Recipe data is empty or invalid');
        }
        const normalized = source.map(normalizeRecipe);
        setRecipes(normalized);
        setRecipesStatus('ready');
        setSelectedRecipe(recipeFromLocation(normalized));
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setRecipes([]);
        setRecipesStatus('error');
        if (import.meta.env.DEV) {
          console.error('[HomeTable] Unable to load recipe data', error);
        }
      });

    return () => controller.abort();
  }, [recipeLoadAttempt]);

  useEffect(() => {
    const saved = safelyWrite(
      STORAGE_KEYS.preferences,
      { primaryLanguage, secondaryLanguage, dual, vegetarianMode },
    );
    if (!saved) setPersistenceUnavailable(true);
  }, [primaryLanguage, secondaryLanguage, dual, vegetarianMode]);

  useEffect(() => {
    const saved = safelyWrite(STORAGE_KEYS.history, history);
    if (!saved) setPersistenceUnavailable(true);
  }, [history]);

  useEffect(() => {
    document.documentElement.lang =
      primaryLanguage === 'zh' ? 'zh-Hant-HK' : primaryLanguage === 'fil' ? 'fil-PH' : primaryLanguage;
  }, [primaryLanguage]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, selectedCuisine, selectedTags]);

  useEffect(() => {
    function syncRecipeFromLocation() {
      setSelectedRecipe(recipeFromLocation(recipes));
    }
    window.addEventListener('popstate', syncRecipeFromLocation);
    return () => window.removeEventListener('popstate', syncRecipeFromLocation);
  }, [recipes]);

  const cuisines = useMemo(() => {
    const byKey = new Map();
    recipes.forEach((recipe) => {
      const cuisine = recipe.cuisine || recipe.category;
      const key = multilingualSearchText(cuisine).toLowerCase();
      if (key && !byKey.has(key)) byKey.set(key, cuisine);
    });
    return [...byKey.entries()].sort(([, a], [, b]) =>
      localize(a, primaryLanguage).localeCompare(localize(b, primaryLanguage)),
    );
  }, [recipes, primaryLanguage]);

  const tagOptions = useMemo(() => {
    const byKey = new Map();
    recipes.forEach((recipe) =>
      recipe.tags.forEach((tag) => {
        const key = multilingualSearchText(tag).toLowerCase();
        if (!key) return;
        const existing = byKey.get(key) || { tag, count: 0 };
        existing.count += 1;
        byKey.set(key, existing);
      }),
    );
    return [...byKey.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 14);
  }, [recipes]);

  const searchableRecipes = useMemo(
    () =>
      recipes.map((recipe) => ({
        recipe,
        haystack: expandSearchAliases(
          [
            recipe.title,
            recipe.description,
            recipe.cuisine,
            recipe.category,
            recipe.tags,
            recipe.ingredients.map((ingredient) => ingredient.name),
            recipe.searchTokens,
          ]
            .map(multilingualSearchText)
            .join(' '),
        ),
        cuisineKey: multilingualSearchText(recipe.cuisine || recipe.category).toLowerCase(),
        tagKeys: recipe.tags.map((tag) => multilingualSearchText(tag).toLowerCase()),
      })),
    [recipes],
  );

  const filteredRecipes = useMemo(() => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return searchableRecipes
      .filter(({ haystack }) => words.every((word) => haystack.includes(word)))
      .filter(({ cuisineKey }) => !selectedCuisine || cuisineKey === selectedCuisine)
      .filter(({ tagKeys }) =>
        selectedTags.every((tagKey) => tagKeys.includes(tagKey)),
      )
      .map(({ recipe }) => recipe);
  }, [query, searchableRecipes, selectedCuisine, selectedTags]);

  const cookedRecipeIds = useMemo(
    () => new Set(history.map((record) => String(record.recipeId || record.id))),
    [history],
  );

  function updatePrimaryLanguage(language) {
    if (language === secondaryLanguage) {
      setSecondaryLanguage(primaryLanguage);
    }
    setPrimaryLanguage(language);
  }

  function updateSecondaryLanguage(language) {
    if (language !== primaryLanguage) setSecondaryLanguage(language);
  }

  function toggleTag(key) {
    setSelectedTags((current) =>
      current.includes(key) ? current.filter((tag) => tag !== key) : [...current, key],
    );
  }

  function clearFilters() {
    setQuery('');
    setSelectedCuisine('');
    setSelectedTags([]);
  }

  function chooseRandomRecipe() {
    const source = filteredRecipes.length ? filteredRecipes : recipes;
    if (source.length) {
      openRecipe(source[Math.floor(Math.random() * source.length)]);
    }
  }

  function openRecipe(recipe) {
    if (!recipe) return;
    setSelectedRecipe(recipe);
    const url = new URL(window.location.href);
    url.searchParams.set('recipe', recipe.slug || recipe.id);
    window.history.replaceState(null, '', url);
  }

  function closeRecipe() {
    setSelectedRecipe(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('recipe');
    window.history.replaceState(null, '', url);
  }

  function markCooked(recipe, cookingOptions = {}) {
    const record = {
      recipeId: recipe.id,
      title: localize(recipe.title, primaryLanguage),
      cookedAt: new Date().toISOString(),
      servings: cookingOptions.servings || 3,
      vegetarianMode: Boolean(cookingOptions.vegetarianMode),
    };
    setHistory((current) => [record, ...current].slice(0, 100));
    setSnackbarOpen(true);
  }

  const hasActiveFilters = Boolean(
    query || selectedCuisine || selectedTags.length,
  );
  const visibleRecipes = filteredRecipes.slice(0, visibleCount);
  const heroImage = `${import.meta.env.BASE_URL}assets/home-table-hero.webp`;

  return (
      <Box sx={{ minHeight: '100vh' }}>
        <Box component="a" href="#main-content" className="skip-link">
          {labels.browseTitle}
        </Box>
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'rgba(255,255,255,.9)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <Container maxWidth="xl">
            <Toolbar disableGutters sx={{ minHeight: { xs: 62, sm: 70 }, gap: 1.5 }}>
              <ButtonBase
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                aria-label={labels.appName}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 1.2,
                  flexGrow: 1,
                  minWidth: 0,
                  minHeight: 44,
                  borderRadius: 1.5,
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '13px',
                    bgcolor: 'primary.main',
                    color: 'white',
                    fontSize: '1.35rem',
                  }}
                >
                  🍚
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ lineHeight: 1.05 }}>
                    {labels.appName}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: { xs: 'none', md: 'block' }, mt: 0.25 }}
                  >
                    {labels.appTagline}
                  </Typography>
                </Box>
              </ButtonBase>

              <Tooltip title={labels.vegetarianModeShort}>
                <Chip
                  clickable
                  role="button"
                  aria-pressed={vegetarianMode}
                  aria-label={`${labels.vegetarianMode}: ${vegetarianMode ? labels.on : labels.off}`}
                  color={vegetarianMode ? 'success' : 'default'}
                  variant={vegetarianMode ? 'filled' : 'outlined'}
                  icon={<SpaRoundedIcon />}
                  label={labels.vegetarianModeShort}
                  onClick={() => setVegetarianMode((current) => !current)}
                  sx={{
                    display: { xs: 'none', sm: 'flex' },
                    height: 42,
                  }}
                />
              </Tooltip>
              <Tooltip title={labels.cookedHistory}>
                <IconButton
                  onClick={() => setHistoryOpen(true)}
                  aria-label={labels.cookedHistory}
                  sx={{ width: 44, height: 44 }}
                >
                  <Badge color="secondary" badgeContent={history.length} max={99}>
                    <HistoryRoundedIcon />
                  </Badge>
                </IconButton>
              </Tooltip>
            </Toolbar>
          </Container>
        </AppBar>

        <Box component="main" id="main-content" tabIndex={-1}>
          <Box
            component="section"
            sx={{
              position: 'relative',
              isolation: 'isolate',
              overflow: 'hidden',
              minHeight: { xs: 480, sm: 470, md: 510 },
              display: 'flex',
              alignItems: 'center',
              color: 'white',
              backgroundImage: `linear-gradient(90deg, rgba(10,43,34,.94) 0%, rgba(10,43,34,.78) 47%, rgba(10,43,34,.22) 100%), url("${heroImage}")`,
              backgroundSize: 'cover',
              backgroundPosition: { xs: '62% center', sm: 'center' },
            }}
          >
            <Container maxWidth="xl" sx={{ py: { xs: 5, md: 7 } }}>
              <Box sx={{ maxWidth: 720 }}>
                <Chip
                  label={labels.heroEyebrow}
                  sx={{
                    bgcolor: 'rgba(255,255,255,.16)',
                    border: '1px solid rgba(255,255,255,.28)',
                    color: 'white',
                    backdropFilter: 'blur(7px)',
                  }}
                />
                <Typography variant="h1" sx={{ mt: 2, color: 'white', maxWidth: 650 }}>
                  {labels.heroTitle}
                </Typography>
                <Typography
                  sx={{
                    mt: 1.5,
                    maxWidth: 650,
                    color: 'rgba(255,255,255,.88)',
                    fontSize: { xs: '1rem', sm: '1.12rem' },
                  }}
                >
                  {labels.heroDescription}
                </Typography>

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ mt: 3, maxWidth: 710 }}
                >
                  <TextField
                    fullWidth
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={labels.searchPlaceholder}
                    inputProps={{ 'aria-label': labels.searchPlaceholder }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchRoundedIcon color="primary" />
                        </InputAdornment>
                      ),
                      endAdornment: query ? (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => setQuery('')}
                            aria-label={labels.clearFilters}
                          >
                            <CloseRoundedIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : null,
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        minHeight: 54,
                        bgcolor: 'rgba(255,255,255,.97)',
                      },
                    }}
                  />
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<AutoAwesomeRoundedIcon />}
                    onClick={chooseRandomRecipe}
                    disabled={recipesStatus !== 'ready' || recipes.length === 0}
                    sx={{ flex: '0 0 auto', minHeight: 54, whiteSpace: 'nowrap' }}
                  >
                    {labels.surpriseMe}
                  </Button>
                </Stack>
              </Box>
            </Container>
          </Box>

          <Container maxWidth="xl" sx={{ py: { xs: 3, sm: 4.5 } }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(330px, .78fr) minmax(0, 1.22fr)' },
                gap: 2.5,
                p: { xs: 2, sm: 2.5 },
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                boxShadow: 2,
              }}
            >
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <TuneRoundedIcon color="primary" />
                  <Typography variant="h4">{labels.filters}</Typography>
                  {hasActiveFilters && (
                    <Button size="small" onClick={clearFilters} sx={{ ml: 'auto !important' }}>
                      {labels.clearFilters}
                    </Button>
                  )}
                </Stack>
                <FormControl fullWidth size="small">
                  <InputLabel id="cuisine-label">{labels.allCuisines}</InputLabel>
                  <Select
                    labelId="cuisine-label"
                    value={selectedCuisine}
                    label={labels.allCuisines}
                    onChange={(event) => setSelectedCuisine(event.target.value)}
                    disabled={recipesStatus !== 'ready'}
                  >
                    <MenuItem value="">{labels.allCuisines}</MenuItem>
                    {cuisines.map(([key, value]) => (
                      <MenuItem key={key} value={key}>
                        {localize(value, primaryLanguage)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {!!tagOptions.length && (
                  <Box sx={{ mt: 1.6 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={750}>
                      {labels.popularTags}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      useFlexGap
                      flexWrap="wrap"
                      className="no-scrollbar"
                      sx={{ mt: 0.8, maxHeight: 76, overflowY: 'auto' }}
                    >
                      {tagOptions.map(([key, { tag }]) => (
                        <Chip
                          key={key}
                          label={localize(tag, primaryLanguage)}
                          clickable
                          color={selectedTags.includes(key) ? 'primary' : 'default'}
                          variant={selectedTags.includes(key) ? 'filled' : 'outlined'}
                          onClick={() => toggleTag(key)}
                          size="small"
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>

              <Box sx={{ borderLeft: { lg: '1px solid' }, borderColor: { lg: 'divider' }, pl: { lg: 2.5 } }}>
                <LanguageControls
                  primaryLanguage={primaryLanguage}
                  secondaryLanguage={secondaryLanguage}
                  dual={dual}
                  onPrimaryChange={updatePrimaryLanguage}
                  onSecondaryChange={updateSecondaryLanguage}
                  onDualChange={setDual}
                  labels={labels}
                />
              </Box>
            </Box>

            <Box sx={{ mt: { xs: 4, sm: 5 } }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
                spacing={1}
              >
                <Box>
                  <Typography variant="h2">{labels.browseTitle}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.7 }}>
                    {labels.browseDescription}
                  </Typography>
                </Box>
                <Typography
                  fontWeight={800}
                  color="primary.main"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {filteredRecipes.length} {labels.recipesFound}
                </Typography>
              </Stack>

              {recipesStatus === 'loading' ? (
                <Box
                  role="status"
                  aria-live="polite"
                  sx={{
                    minHeight: 320,
                    display: 'grid',
                    placeItems: 'center',
                    textAlign: 'center',
                  }}
                >
                  <Box>
                    <CircularProgress aria-hidden="true" />
                    <Typography sx={{ mt: 2 }} fontWeight={750}>
                      {labels.loadingRecipes}
                    </Typography>
                  </Box>
                </Box>
              ) : recipesStatus === 'error' ? (
                <Box
                  role="alert"
                  sx={{
                    mt: 3,
                    minHeight: 300,
                    display: 'grid',
                    placeItems: 'center',
                    textAlign: 'center',
                    p: 4,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'error.light',
                    borderRadius: 3,
                  }}
                >
                  <Box sx={{ maxWidth: 520 }}>
                    <Typography variant="h3">{labels.loadError}</Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.8 }}>
                      {labels.loadErrorHelp}
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => setRecipeLoadAttempt((attempt) => attempt + 1)}
                      sx={{ mt: 2 }}
                    >
                      {labels.retry}
                    </Button>
                  </Box>
                </Box>
              ) : filteredRecipes.length ? (
                <>
                <Box
                  aria-label={labels.browseTitle}
                  sx={{
                    mt: 2.5,
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(3, minmax(0, 1fr))',
                      xl: 'repeat(4, minmax(0, 1fr))',
                    },
                    gap: { xs: 2, sm: 2.5 },
                  }}
                >
                  {visibleRecipes.map((recipe) => (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      primaryLanguage={primaryLanguage}
                      secondaryLanguage={secondaryLanguage}
                      dual={dual}
                      labels={labels}
                      hasBeenCooked={cookedRecipeIds.has(String(recipe.id))}
                      onOpen={openRecipe}
                      imageUnavailableText={labels.imageUnavailable}
                    />
                  ))}
                </Box>
                  {visibleRecipes.length < filteredRecipes.length && (
                    <Stack alignItems="center" spacing={1} sx={{ mt: 3 }}>
                      <Typography variant="body2" color="text.secondary" aria-live="polite">
                        {labels.showingCount} {visibleRecipes.length} / {filteredRecipes.length}
                      </Typography>
                      <Button
                        variant="outlined"
                        onClick={() =>
                          setVisibleCount((count) =>
                            Math.min(filteredRecipes.length, count + PAGE_SIZE),
                          )
                        }
                      >
                        {labels.loadMore}
                      </Button>
                    </Stack>
                  )}
                </>
              ) : (
                <Box
                  sx={{
                    mt: 3,
                    minHeight: 300,
                    display: 'grid',
                    placeItems: 'center',
                    textAlign: 'center',
                    p: 4,
                    bgcolor: 'background.paper',
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 3,
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: '4rem' }}>🔎</Typography>
                    <Typography variant="h3" sx={{ mt: 1 }}>
                      {labels.noResults}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.8 }}>
                      {labels.noResultsHelp}
                    </Typography>
                    <Button variant="outlined" onClick={clearFilters} sx={{ mt: 2 }}>
                      {labels.showAll}
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          </Container>
        </Box>

        <Box
          component="footer"
          sx={{
            mt: 5,
            py: 3,
            textAlign: 'center',
            color: 'text.secondary',
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'rgba(255,255,255,.5)',
          }}
        >
          <Container>
            <Typography variant="body2">{labels.footer}</Typography>
          </Container>
        </Box>

        <RecipeDetail
          open={Boolean(selectedRecipe)}
          recipe={selectedRecipe}
          onClose={closeRecipe}
          primaryLanguage={primaryLanguage}
          secondaryLanguage={secondaryLanguage}
          dual={dual}
          vegetarianMode={vegetarianMode}
          onVegetarianModeChange={setVegetarianMode}
          labels={labels}
          onMarkCooked={markCooked}
          hasBeenCooked={
            selectedRecipe
              ? cookedRecipeIds.has(String(selectedRecipe.id))
              : false
          }
          imageUnavailableText={labels.imageUnavailable}
        />

        <CookedHistory
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          records={history}
          recipes={recipes}
          primaryLanguage={primaryLanguage}
          labels={labels}
          onOpenRecipe={openRecipe}
          onClear={() => setHistory([])}
        />

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={4000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity="success"
            variant="filled"
            onClose={() => setSnackbarOpen(false)}
            sx={{ width: '100%' }}
          >
            {labels.savedCooked}
          </Alert>
        </Snackbar>

        <Snackbar
          open={persistenceUnavailable}
          onClose={() => setPersistenceUnavailable(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity="warning"
            onClose={() => setPersistenceUnavailable(false)}
            sx={{ width: '100%', maxWidth: 620 }}
          >
            {labels.storageUnavailable}
          </Alert>
        </Snackbar>
      </Box>
  );
}

export default App;
