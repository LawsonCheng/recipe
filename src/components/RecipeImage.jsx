import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import ImageNotSupportedRoundedIcon from '@mui/icons-material/ImageNotSupportedRounded';

const reportedImageErrors = new Set();
const forbiddenSharedImages = ['/assets/home-table-hero.webp', '/assets/home-table-hero.png'];

function resolveSource(src) {
  if (typeof src !== 'string') return undefined;

  const normalized = src.trim();
  if (!normalized || forbiddenSharedImages.some((path) => normalized.includes(path))) {
    return undefined;
  }

  if (normalized.startsWith('/assets/')) {
    return `${import.meta.env.BASE_URL}${normalized.slice(1)}`;
  }

  if (normalized.startsWith('assets/')) {
    return `${import.meta.env.BASE_URL}${normalized}`;
  }

  return normalized;
}

function reportImageError({ source, context, reason }) {
  const key = `${reason}|${source || 'no-source'}|${context}`;
  if (reportedImageErrors.has(key)) return;
  reportedImageErrors.add(key);

  const detail = {
    type: 'recipe-image',
    reason,
    context: context || 'unknown recipe image',
    source: source || null,
    recordedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    const diagnostics = Array.isArray(window.__HOME_TABLE_DIAGNOSTICS__)
      ? window.__HOME_TABLE_DIAGNOSTICS__
      : [];
    diagnostics.push(detail);
    window.__HOME_TABLE_DIAGNOSTICS__ = diagnostics.slice(-100);
    window.dispatchEvent(new CustomEvent('home-table:diagnostic', { detail }));
  }

  if (import.meta.env.DEV) {
    console.error(
      `[RecipeImage] ${reason}: ${context || 'unknown recipe image'}`,
      source ? { source } : undefined,
    );
  }
}

/**
 * Displays an explicit recipe/step image file.
 *
 * Deliberately does not create a stock or procedural fallback: an absent asset is
 * a content error and must remain visible during development. The fixed media box
 * preserves the card/detail layout while an image is loading or unavailable.
 */
export default function RecipeImage({
  src,
  alt = '',
  recipeId = '',
  recipeTitle = '',
  stepTitle = '',
  stepNumber,
  kind = 'dish',
  height = 220,
  sx,
  loading = 'lazy',
  unavailableText = 'Instructional image unavailable',
}) {
  const resolvedSrc = resolveSource(src);
  const [status, setStatus] = useState(resolvedSrc ? 'loading' : 'missing');
  const context = [
    recipeId || recipeTitle || 'unknown recipe',
    kind === 'step' ? `step ${stepNumber || '?'}${stepTitle ? ` (${stepTitle})` : ''}` : 'dish',
  ].join(' — ');

  useEffect(() => {
    setStatus(resolvedSrc ? 'loading' : 'missing');
    if (!resolvedSrc) {
      reportImageError({
        source: src,
        context,
        reason: 'Missing or forbidden image source',
      });
    }
  }, [context, resolvedSrc, src]);

  const handleError = () => {
    setStatus('error');
    reportImageError({
      source: resolvedSrc,
      context,
      reason: 'Image failed to load',
    });
  };

  const showImage = Boolean(resolvedSrc) && status !== 'error';
  const unavailable = status === 'missing' || status === 'error';

  return (
    <Box
      data-image-kind={kind}
      data-image-status={status}
      aria-busy={status === 'loading' ? 'true' : undefined}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        height,
        bgcolor: 'grey.100',
        ...sx,
      }}
    >
      {showImage && (
        <Box
          component="img"
          src={resolvedSrc}
          alt={alt}
          loading={loading}
          decoding="async"
          fetchPriority={loading === 'eager' ? 'high' : 'auto'}
          width="1200"
          height="720"
          onLoad={() => setStatus('loaded')}
          onError={handleError}
          sx={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: status === 'loaded' ? 1 : 0,
            transition: 'opacity 160ms ease',
          }}
        />
      )}

      {unavailable && (
        <Box
          role="img"
          aria-label={[alt, unavailableText].filter(Boolean).join('. ')}
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            p: 2,
            bgcolor: 'grey.100',
            color: 'text.secondary',
            border: '1px solid',
            borderColor: 'divider',
            textAlign: 'center',
          }}
        >
          <Box>
            <ImageNotSupportedRoundedIcon
              aria-hidden="true"
              sx={{ fontSize: 38, opacity: 0.7 }}
            />
            <Typography
              variant="caption"
              component="span"
              fontWeight={750}
              sx={{ display: 'block', mt: 0.75, maxWidth: 320 }}
            >
              {unavailableText}
            </Typography>
            {import.meta.env.DEV && (
              <Typography
                variant="caption"
                component="span"
                sx={{ display: 'block', mt: 0.4, color: 'error.dark' }}
              >
                {context}
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
