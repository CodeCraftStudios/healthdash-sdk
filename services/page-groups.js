/**
 * Page Groups Module
 * ------------------------------------------------------------------
 * Public storefront access to dynamic content collections defined in
 * the HealthDash dashboard under "Page Groups" (e.g. Services, Industries,
 * Locations, Doctors, FAQ, etc.).
 *
 * Each Page Group has a slug and a list of published items. Items carry a
 * title, slug, content (HTML), excerpt, featured image, custom_fields,
 * metadata, and SEO fields.
 *
 * Quickstart
 * ------------------------------------------------------------------
 *   import { DashClient } from "healthdashsdk";
 *   const dash = new DashClient({ apiKey: process.env.HEALTHDASH_KEY });
 *
 *   // Fluent shortcut on the client (preferred):
 *   const { items } = await dash.pageGroup("doctors").all();
 *   const dr      = await dash.pageGroup("doctors").get("dr-patel");
 *   const cards   = await dash.pageGroup("doctors").filter({ specialty: "cardiology" });
 *
 *   // Or via the module form:
 *   const all = await dash.pageGroups.list();
 *   const items = await dash.pageGroups.group("doctors").all();
 *
 * The endpoints used here are public — no key required for reads — but
 * we still pass the public key so usage telemetry / org scoping works.
 */

/**
 * Fluent query builder for a single Page Group (a content collection).
 *
 * Returned by `dash.pageGroup(slug)` and `dash.pageGroups.group(slug)`.
 * Don't construct this directly; let the SDK hand it to you.
 */
export class PageGroup {
  /**
   * @param {object} client    The DashClient instance (provides baseURL + _fetch).
   * @param {string} slug      The group's storefront slug (e.g. "doctors").
   */
  constructor(client, slug) {
    if (!slug || typeof slug !== "string") {
      throw new Error("pageGroup(slug): slug must be a non-empty string");
    }
    this.client = client;
    this.slug = slug;
  }

  /**
   * Fetch every published item in this group.
   *
   * @param {object} [options]
   * @param {number} [options.limit=50]   Max items returned per page.
   * @param {number} [options.offset=0]   Pagination offset.
   * @returns {Promise<{ content_type: object, items: Array<object>, total: number }>}
   *
   * @example
   *   const { items, total } = await dash.pageGroup("doctors").all();
   *   const { items: more  } = await dash.pageGroup("doctors").all({ offset: 50 });
   */
  async all(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.append("limit", String(options.limit));
    if (options.offset) params.append("offset", String(options.offset));
    const qs = params.toString();
    const url = `${this.client.baseURL}/api/storefront/content-types/${encodeURIComponent(this.slug)}${qs ? `?${qs}` : ""}`;
    return this.client._fetch(url);
  }

  /**
   * Filter items in this group. Accepts either a predicate function or a
   * plain object spec where each key is matched against item top-level
   * fields, `metadata`, or `custom_fields` (in that order).
   *
   * Filtering is performed client-side after `all()` returns — fine for
   * collections up to a few hundred items. For larger sets, paginate
   * with `all({ offset, limit })` and filter each page.
   *
   * @param {(item: object) => boolean | Record<string, unknown>} predicate
   * @param {object} [options]   Same options as `.all()` (forwarded).
   * @returns {Promise<Array<object>>}
   *
   * @example
   *   // Object spec: each key must equal the item's value
   *   const cardiologists = await dash.pageGroup("doctors")
   *     .filter({ specialty: "cardiology" });
   *
   *   // Predicate function: any logic you want
   *   const senior = await dash.pageGroup("doctors")
   *     .filter(d => d.metadata?.years_practicing >= 20);
   */
  async filter(predicate, options = {}) {
    const { items = [] } = await this.all(options);

    if (typeof predicate === "function") {
      return items.filter(predicate);
    }

    if (predicate && typeof predicate === "object") {
      const entries = Object.entries(predicate);
      return items.filter((item) => {
        for (const [key, want] of entries) {
          const got =
            item?.[key] ??
            item?.metadata?.[key] ??
            item?.custom_fields?.[key];
          if (got !== want) return false;
        }
        return true;
      });
    }

    return items;
  }

  /**
   * Fetch a single published item by its slug. Use this for detail pages.
   *
   * @param {string} itemSlug
   * @returns {Promise<{ item: object }>}
   *
   * @example
   *   const { item } = await dash.pageGroup("doctors").get("dr-patel");
   *   item.title; item.content; item.featured_image; item.metadata;
   */
  async get(itemSlug) {
    if (!itemSlug || typeof itemSlug !== "string") {
      throw new Error("pageGroup.get(itemSlug): itemSlug must be a non-empty string");
    }
    const url = `${this.client.baseURL}/api/storefront/content-types/${encodeURIComponent(this.slug)}/${encodeURIComponent(itemSlug)}`;
    return this.client._fetch(url);
  }

  /**
   * Find the first item matching the given filter, or `null` if none match.
   * Convenience wrapper around `.filter()`.
   *
   * @param {(item: object) => boolean | Record<string, unknown>} predicate
   * @returns {Promise<object | null>}
   *
   * @example
   *   const onCall = await dash.pageGroup("doctors")
   *     .find({ on_call_today: true });
   */
  async find(predicate) {
    const matches = await this.filter(predicate);
    return matches[0] ?? null;
  }

  /**
   * Count published items in this group (uses pagination metadata so it
   * doesn't need to fetch every record).
   *
   * @returns {Promise<number>}
   */
  async count() {
    const { total = 0 } = await this.all({ limit: 1 });
    return total;
  }
}

/**
 * Top-level Page Groups module exposed as `dash.pageGroups`.
 *
 * Most callers won't touch this — use `dash.pageGroup("slug")` directly,
 * which is a one-liner shortcut for `dash.pageGroups.group("slug")`.
 */
export class PageGroupsModule {
  constructor(client) {
    this.client = client;
  }

  /**
   * List every published Page Group (collection metadata, not items).
   *
   * @returns {Promise<{ content_types: Array<object> }>}
   *
   * @example
   *   const { content_types } = await dash.pageGroups.list();
   *   for (const g of content_types) {
   *     console.log(g.slug, g.item_count);
   *   }
   */
  async list() {
    const url = `${this.client.baseURL}/api/storefront/content-types`;
    return this.client._fetch(url);
  }

  /**
   * Get a fluent builder for a specific group.
   *
   * @param {string} slug
   * @returns {PageGroup}
   *
   * @example
   *   const builder = dash.pageGroups.group("doctors");
   *   const { items } = await builder.all();
   */
  group(slug) {
    return new PageGroup(this.client, slug);
  }
}

export default PageGroupsModule;
