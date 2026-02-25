import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

type StructuredData = Record<string, unknown> | Record<string, unknown>[];

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  keywords?: string[];
  image?: string;
  type?: "website" | "article" | "product";
  noindex?: boolean;
  structuredData?: StructuredData;
}

function toAbsoluteUrl(value: string, origin: string): string {
  try {
    return new URL(value, origin).toString();
  } catch {
    return `${origin}${value.startsWith("/") ? value : `/${value}`}`;
  }
}

export function SEO({
  title,
  description,
  canonical,
  keywords,
  image,
  type = "website",
  noindex = false,
  structuredData,
}: SEOProps) {
  const location = useLocation();
  const origin = typeof window !== "undefined" ? window.location.origin : "https://cybertools.hub";

  const canonicalUrl = canonical
    ? toAbsoluteUrl(canonical, origin)
    : `${origin}${location.pathname}`;

  const imageUrl = image ? toAbsoluteUrl(image, origin) : `${origin}/og-cover.png`;
  const normalizedKeywords = keywords?.map((value) => value.trim()).filter(Boolean) ?? [];

  const structuredPayload = Array.isArray(structuredData)
    ? structuredData
    : structuredData
      ? [structuredData]
      : [];

  const robotsValue = noindex
    ? "noindex,nofollow"
    : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

  const titleText = `${title} | CyberTools Hub`;

  return (
    <Helmet>
      <title>{titleText}</title>

      <meta name="description" content={description} />
      {normalizedKeywords.length > 0 && (
        <meta name="keywords" content={normalizedKeywords.join(", ")} />
      )}
      <meta name="robots" content={robotsValue} />
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="CyberTools Hub" />
      <meta property="og:title" content={titleText} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={imageUrl} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={titleText} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      {structuredPayload.map((item, index) => (
        <script
          key={`seo-jsonld-${index}`}
          type="application/ld+json"
        >
          {JSON.stringify(item)}
        </script>
      ))}
    </Helmet>
  );
}
