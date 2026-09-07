import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface FetchedBusiness {
  ok: boolean;
  message?: string;
  fields: Record<string, string>;
}

const NOT_FOUND = "Not Found";

function pickMeta(html: string, patterns: RegExp[]) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decode(m[1].trim());
  }
  return "";
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const fetchBusinessFromLink = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => z.object({ url: z.string().url().max(500) }).parse(input))
  .handler(async ({ data }): Promise<FetchedBusiness> => {
    const url = data.url;
    let html = "";
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; LepdoCRM/1.0; +https://lepdo.com) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        return {
          ok: false,
          message: `This website blocked the request (status ${res.status}). Please enter the details manually.`,
          fields: {},
        };
      }
      html = await res.text();
    } catch {
      return {
        ok: false,
        message: "Could not reach this link. It may block automated reading — please enter details manually.",
        fields: {},
      };
    }

    const host = new URL(url).hostname.replace(/^www\./, "");
    const title = pickMeta(html, [
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i,
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ]);
    const description = pickMeta(html, [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i,
    ]);

    const emails = Array.from(
      new Set(
        (html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []).filter(
          (e) => !/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(e),
        ),
      ),
    );
    const phones = Array.from(
      new Set(html.match(/(?:tel:|href="tel:)?\+\d[\d\s().-]{7,17}\d/g) ?? []),
    ).map((p) => p.replace(/^(tel:|href="tel:)/, "").trim());
    const whatsapp = (html.match(/wa\.me\/(\d{8,15})/i) ?? [])[1];
    const social =
      (html.match(/https?:\/\/(?:www\.)?(?:instagram|linkedin|facebook|x|twitter)\.com\/[^"'\s<>]+/i) ??
        [])[0] ?? "";
    const country = pickMeta(html, [
      /<meta[^>]+property=["']business:contact_data:country_name["'][^>]+content=["']([^"']+)/i,
    ]);
    const city = pickMeta(html, [
      /<meta[^>]+property=["']business:contact_data:locality["'][^>]+content=["']([^"']+)/i,
    ]);

    return {
      ok: true,
      fields: {
        company: title || host,
        contactPerson: NOT_FOUND,
        country: country || NOT_FOUND,
        city: city || NOT_FOUND,
        website: `https://${host}`,
        email: emails[0] ?? NOT_FOUND,
        phone: phones[0] ?? NOT_FOUND,
        whatsapp: whatsapp ? `+${whatsapp}` : (phones[0] ?? NOT_FOUND),
        social: social || NOT_FOUND,
        category: NOT_FOUND,
        productInterest: NOT_FOUND,
        source: host,
        sourceUrl: url,
        description: description || NOT_FOUND,
        notes: "",
      },
    };
  });
