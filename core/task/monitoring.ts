type ListingSignals = {
  handles: Set<string>;
  hrefByHandle: Map<string, string>;
  normalizedHtml: string;
};

type MonitorVariant = {
  id?: string | number;
  title?: string;
  option1?: string;
  option2?: string;
  option3?: string;
  available?: boolean;
};

type MonitorProduct = {
  id?: string | number;
  title?: string;
  handle?: string;
  product_type?: string;
  tags?: string[];
  variants?: MonitorVariant[];
};

type KeywordRule = {
  exclude: boolean;
  alternatives: string[];
  raw: string;
};

export type MonitorMatch = {
  variantId: string;
  matchedTitle: string;
  matchedHandle: string;
  matchedUrl: string;
  matchedCategory?: string;
  matchScore: number;
};

export type MonitorProductsCacheEntry = {
  fetchedAt: number;
  products: MonitorProduct[];
};

const monitorProductsCache = new Map<string, MonitorProductsCacheEntry>();
const MONITOR_PRODUCTS_CACHE_TTL_MS = 8_000;

export function normalizeMonitorText(value: string) {
  return value
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveMonitorConfig(url: string, category?: string) {
  const parsed = new URL(url);
  const origin = parsed.origin;
  const rawPath = parsed.pathname.replace(/\/+$/, '') || '/';
  const normalizedCategory = String(category ?? '').trim().replace(/^\/+|\/+$/g, '');

  let listingPath = rawPath === '/' ? '/shop/all' : rawPath;

  if (normalizedCategory) {
    if (normalizedCategory.includes('/')) {
      listingPath = `/${normalizedCategory}`;
    } else if (listingPath === '/shop/all' || listingPath.startsWith('/shop/all/')) {
      listingPath = `/shop/all/${normalizedCategory}`;
    } else if (listingPath.startsWith('/collections/')) {
      listingPath = `/collections/${normalizedCategory}`;
    } else {
      listingPath = `${listingPath}/${normalizedCategory}`;
    }
  }

  const listingUrl = `${origin}${listingPath}`;
  const productsJsonUrl = listingPath.startsWith('/collections/')
    ? `${origin}${listingPath}/products.json?limit=250`
    : `${origin}/products.json?limit=250`;

  return {
    origin,
    listingPath,
    listingUrl,
    productsJsonUrl,
    normalizedCategory,
  };
}

export function extractListingSignals(html: string) {
  const handles = new Set<string>();
  const hrefByHandle = new Map<string, string>();
  const hrefRegex = /href=["']([^"']*(?:\/shop\/|\/products\/)[^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    const withoutQuery = href.split('?')[0].replace(/\/+$/, '');
    const segments = withoutQuery.split('/').filter(Boolean);
    const handle = segments[segments.length - 1];
    if (!handle) {
      continue;
    }

    handles.add(handle.toLowerCase());
    hrefByHandle.set(handle.toLowerCase(), href);
  }

  return {
    handles,
    hrefByHandle,
    normalizedHtml: normalizeMonitorText(html),
  } satisfies ListingSignals;
}

export function getCachedMonitorProducts(url: string) {
  const cached = monitorProductsCache.get(url);
  if (!cached) {
    return undefined;
  }

  if (Date.now() - cached.fetchedAt > MONITOR_PRODUCTS_CACHE_TTL_MS) {
    return undefined;
  }

  return cached.products;
}

export function getStaleCachedMonitorProducts(url: string) {
  return monitorProductsCache.get(url)?.products;
}

export function setCachedMonitorProducts(url: string, products: MonitorProduct[]) {
  monitorProductsCache.set(url, {
    fetchedAt: Date.now(),
    products,
  });
}

function parseKeywordRules(keywords: string[]) {
  return keywords
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .map((keyword) => {
      const exclude = keyword.startsWith('-');
      const raw = keyword.replace(/^[+-]/, '').trim();
      return {
        exclude,
        raw,
        alternatives: raw
          .split('|')
          .map((part) => normalizeMonitorText(part))
          .filter(Boolean),
      } satisfies KeywordRule;
    })
    .filter((rule) => rule.alternatives.length > 0);
}

function scoreVariantMatch(variant: MonitorVariant, size?: string, color?: string) {
  const normalizedNeedleSize = normalizeMonitorText(size ?? '');
  const normalizedNeedleColor = normalizeMonitorText(color ?? '');
  const haystack = normalizeMonitorText(
    [variant.title, variant.option1, variant.option2, variant.option3].filter(Boolean).join(' '),
  );

  let score = variant.available === false ? -100 : 0;

  if (normalizedNeedleSize) {
    score += haystack.includes(normalizedNeedleSize) ? 20 : -4;
  }

  if (normalizedNeedleColor) {
    score += haystack.includes(normalizedNeedleColor) ? 16 : -3;
  }

  return score;
}

function chooseVariant(product: MonitorProduct, size?: string, color?: string) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (variants.length === 0) {
    return null;
  }

  const sorted = [...variants].sort((left, right) => scoreVariantMatch(right, size, color) - scoreVariantMatch(left, size, color));
  return sorted.find((variant) => variant.available !== false) ?? sorted[0];
}

function scoreProductAgainstRules(
  product: MonitorProduct,
  rules: KeywordRule[],
  listingSignals: ListingSignals,
  desiredCategory?: string,
) {
  const title = String(product.title ?? '');
  const handle = String(product.handle ?? '');
  const category = String(product.product_type ?? '');
  const tags = Array.isArray(product.tags) ? product.tags.join(' ') : '';
  const normalizedTitle = normalizeMonitorText(title);
  const normalizedCategory = normalizeMonitorText(category);
  const normalizedBlob = normalizeMonitorText([title, handle, category, tags].join(' '));
  const listingHasHandle = handle ? listingSignals.handles.has(handle.toLowerCase()) : false;
  const listingHasTitle = normalizedTitle && listingSignals.normalizedHtml.includes(normalizedTitle);
  const categoryNeedle = normalizeMonitorText(desiredCategory ?? '');

  if ((listingSignals.handles.size > 0 || listingSignals.normalizedHtml.length > 0) && !listingHasHandle && !listingHasTitle) {
    return { matched: false, score: -50 };
  }

  if (categoryNeedle && !normalizeMonitorText([category, handle].join(' ')).includes(categoryNeedle)) {
    if (!(listingHasHandle || listingHasTitle)) {
      return { matched: false, score: -40 };
    }
  }

  let score = 0;

  for (const rule of rules) {
    const found = rule.alternatives.some(
      (alternative) =>
        normalizedBlob.includes(alternative) ||
        normalizedTitle.includes(alternative) ||
        normalizeMonitorText(handle).includes(alternative),
    );

    if (rule.exclude && found) {
      return { matched: false, score: -100 };
    }

    if (!rule.exclude && !found) {
      return { matched: false, score: -25 };
    }

    if (!rule.exclude && found) {
      score += 18;
      if (rule.alternatives.some((alternative) => normalizedTitle === alternative)) {
        score += 40;
      } else if (rule.alternatives.some((alternative) => normalizedTitle.startsWith(alternative))) {
        score += 14;
      } else if (rule.alternatives.some((alternative) => normalizedTitle.includes(alternative))) {
        score += 8;
      }
    }
  }

  if (listingHasHandle) {
    score += 22;
  }

  if (listingHasTitle) {
    score += 18;
  }

  return { matched: true, score };
}

export function findBestMonitorMatch(options: {
  products: MonitorProduct[];
  keywords: string[];
  listingSignals: ListingSignals;
  origin: string;
  desiredCategory?: string;
  desiredSize?: string;
  desiredColor?: string;
}) {
  const rules = parseKeywordRules(options.keywords);
  if (rules.length === 0) {
    return null;
  }

  let bestMatch: MonitorMatch | null = null;

  for (const product of options.products) {
    const handle = String(product.handle ?? '').trim();
    const title = String(product.title ?? '').trim();
    if (!handle || !title) {
      continue;
    }

    const scoreResult = scoreProductAgainstRules(
      product,
      rules,
      options.listingSignals,
      options.desiredCategory,
    );

    if (!scoreResult.matched) {
      continue;
    }

    const chosenVariant = chooseVariant(product, options.desiredSize, options.desiredColor);
    const variantId = String(chosenVariant?.id ?? '');
    if (!variantId) {
      continue;
    }

    const lowerHandle = handle.toLowerCase();
    const matchedHref = options.listingSignals.hrefByHandle.get(lowerHandle);
    const matchedUrl = matchedHref
      ? new URL(matchedHref, options.origin).toString()
      : `${options.origin}/products/${handle}`;
    const variantScore = chosenVariant ? scoreVariantMatch(chosenVariant, options.desiredSize, options.desiredColor) : 0;
    const totalScore = scoreResult.score + variantScore;

    if (!bestMatch || totalScore > bestMatch.matchScore) {
      bestMatch = {
        variantId,
        matchedTitle: title,
        matchedHandle: handle,
        matchedUrl,
        matchedCategory: product.product_type,
        matchScore: totalScore,
      };
    }
  }

  return bestMatch;
}
