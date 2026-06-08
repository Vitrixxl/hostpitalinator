import DOMPurify from "dompurify";

const RICH_TEXT_ALLOWED_TAGS = [
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strike",
  "strong",
  "u",
  "ul",
];

const RICH_TEXT_ALLOWED_ATTR = ["style"];
const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

export function normalizeRichText(value?: string | null) {
  const rawValue = value ?? "";

  if (!rawValue.trim()) {
    return "";
  }

  const html = HTML_TAG_PATTERN.test(rawValue)
    ? rawValue
    : plainTextToRichText(rawValue);

  return sanitizeRichText(html);
}

export function sanitizeRichText(value?: string | null) {
  const rawValue = value ?? "";

  if (!rawValue.trim()) {
    return "";
  }

  return DOMPurify.sanitize(rawValue, {
    ALLOW_DATA_ATTR: false,
    ALLOWED_ATTR: RICH_TEXT_ALLOWED_ATTR,
    ALLOWED_TAGS: RICH_TEXT_ALLOWED_TAGS,
  }).trim();
}

export function richTextToPlainText(value?: string | null) {
  const html = normalizeRichText(value);

  if (!html) {
    return "";
  }

  const htmlWithSpacing = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(blockquote|h1|h2|h3|li|ol|p|pre|ul)>/gi, "$& ");

  if (typeof document === "undefined") {
    return htmlWithSpacing.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  const container = document.createElement("div");
  container.innerHTML = htmlWithSpacing;

  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function richTextHasText(value?: string | null) {
  return richTextToPlainText(value).length > 0;
}

export function richTextOptionalValue(value: string) {
  const html = normalizeRichText(value);

  return richTextHasText(html) ? html : undefined;
}

export function richTextNullableOptionalValue(value: string) {
  return richTextOptionalValue(value) ?? null;
}

function plainTextToRichText(value: string) {
  return value
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
