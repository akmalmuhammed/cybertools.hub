import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

type StructuredData = Record<string, unknown> | Record<string, unknown>[];
type SchemaRecord = Record<string, unknown>;

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  keywords?: string[];
  image?: string;
  type?: "website" | "article" | "product";
  noindex?: boolean;
  structuredData?: StructuredData;
  breadcrumbItems?: BreadcrumbItem[];
  siteName?: string;
  author?: string;
}

function toAbsoluteUrl(value: string, origin: string): string {
  try {
    return new URL(value, origin).toString();
  } catch {
    return `${origin}${value.startsWith("/") ? value : `/${value}`}`;
  }
}

function readSchemaTypes(entry: SchemaRecord): string[] {
  const schemaType = entry["@type"];
  if (typeof schemaType === "string") return [schemaType];
  if (Array.isArray(schemaType)) {
    return schemaType.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function hasSchemaType(entries: SchemaRecord[], expected: string[]): boolean {
  return entries.some((entry) => {
    const types = readSchemaTypes(entry);
    return expected.some((candidate) => types.includes(candidate));
  });
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
  breadcrumbItems,
  siteName = "Secutil",
  author = "Secutil Team",
}: SEOProps) {
  const location = useLocation();
  const origin = typeof window !== "undefined" ? window.location.origin : "https://cybertools.hub";

  const canonicalUrl = canonical
    ? toAbsoluteUrl(canonical, origin)
    : `${origin}${location.pathname}`;

  const imageUrl = image ? toAbsoluteUrl(image, origin) : `${origin}/og-cover.svg`;
  const normalizedKeywords = keywords?.map((value) => value.trim()).filter(Boolean) ?? [];

  const structuredPayload: SchemaRecord[] = Array.isArray(structuredData)
    ? structuredData
    : structuredData
      ? [structuredData]
      : [];
  const normalizedBreadcrumbs = breadcrumbItems
    ?.map((item) => ({
      name: item.name.trim(),
      url: toAbsoluteUrl(item.url, origin),
    }))
    .filter((item) => item.name.length > 0) ?? [];

  const derivedStructuredPayload: SchemaRecord[] = [];
  const hasWebPageLikeSchema = hasSchemaType(structuredPayload, [
    "WebPage",
    "CollectionPage",
    "AboutPage",
    "SoftwareApplication",
    "WebApplication",
  ]);

  if (!hasWebPageLikeSchema) {
    derivedStructuredPayload.push({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      inLanguage: "en-US",
      isPartOf: {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: `${origin}/`,
        name: siteName,
      },
    });
  }

  const hasBreadcrumbSchema = hasSchemaType(structuredPayload, ["BreadcrumbList"]);
  if (!hasBreadcrumbSchema && normalizedBreadcrumbs.length > 0) {
    derivedStructuredPayload.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: normalizedBreadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    });
  }

  const finalStructuredPayload = [...derivedStructuredPayload, ...structuredPayload];

  const robotsValue = noindex
    ? "noindex,nofollow"
    : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

  const titleText = `${title} | ${siteName}`;
  const socialImageAlt = `${siteName} cybersecurity tools preview`;

  return (
    <Helmet>
      <title>{titleText}</title>

      <meta name="description" content={description} />
      {normalizedKeywords.length > 0 && (
        <meta name="keywords" content={normalizedKeywords.join(", ")} />
      )}
      <meta name="author" content={author} />
      <meta name="creator" content={siteName} />
      <meta name="publisher" content={siteName} />
      <meta name="application-name" content={siteName} />
      <meta name="apple-mobile-web-app-title" content={siteName} />
      <meta name="format-detection" content="telephone=no,address=no,email=no" />
      <meta name="referrer" content="strict-origin-when-cross-origin" />
      <meta name="robots" content={robotsValue} />
      <link rel="canonical" href={canonicalUrl} />
      <link rel="alternate" hrefLang="en-US" href={canonicalUrl} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:title" content={titleText} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:alt" content={socialImageAlt} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={titleText} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={socialImageAlt} />

      {finalStructuredPayload.map((item, index) => (
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
