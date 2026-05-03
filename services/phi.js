/**
 * PHI Module
 *
 * Read + write Patient / Practitioner / Observation / Encounter /
 * DocumentReference resources via the HealthDash backend.
 *
 * IMPORTANT — security model:
 *   The SDK NEVER talks to Medplum directly. Every call here goes
 *   to /api/dashboard/medplum/* on the HealthDash backend, which
 *   holds the Medplum platform credentials, applies access control,
 *   audit-logs the request, and stamps Cache-Control: no-store on
 *   the response.
 *
 *   PHI returned by these methods is HELD IN MEMORY ONLY by the
 *   caller. This module never writes responses to localStorage,
 *   sessionStorage, IndexedDB, or cookies. If the caller needs to
 *   persist PHI for offline use, that is a separate, deliberate
 *   decision that must be reviewed by the Privacy Officer.
 *
 * Auth:
 *   Requests use the SDK's stored access token (set by AuthModule
 *   on login). Backend gates each endpoint on dashboard-user auth.
 *
 * Audit:
 *   Every read/write is recorded server-side in HealthDash's
 *   hash-chained AuditLog under action prefix `phi.*`.
 *   Patient/$everything exports go through a separate endpoint
 *   (admin/medplum/patient-access/<id>) reserved for §164.524
 *   right-of-access fulfillment by the Privacy Officer.
 */

export class PhiModule {
  constructor(client) {
    this.client = client;
  }

  _base(path) {
    return `${this.client.baseURL}/api/dashboard/medplum${path}`;
  }

  _opts(extra = {}) {
    return {
      cache: "no-store",
      credentials: "include",
      ...extra,
    };
  }

  // ── Patients ─────────────────────────────────────────────────────────

  /**
   * List patients in the caller's organization.
   * @param {Object} [params]
   * @param {string} [params.q]      name search (Medplum `name` parameter)
   * @param {number} [params.count]  page size, default 50
   * @returns {Promise<Object>}      FHIR Bundle
   */
  async listPatients({ q, count } = {}) {
    const url = new URL(this._base("/patients"));
    if (q) url.searchParams.set("q", q);
    if (count) url.searchParams.set("count", String(count));
    return this.client._fetch(url.toString(), this._opts({ method: "GET" }));
  }

  /**
   * Read a single Patient.
   * @param {string} id
   * @returns {Promise<Object>}  Patient resource
   */
  async getPatient(id) {
    return this.client._fetch(this._base(`/patients/${encodeURIComponent(id)}`),
      this._opts({ method: "GET" }));
  }

  /**
   * Create a Patient.
   * @param {Object} resource  partial FHIR Patient (resourceType added if missing)
   */
  async createPatient(resource) {
    return this.client._fetch(this._base("/patients/create"), this._opts({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resource || {}),
    }));
  }

  /**
   * Update an existing Patient (full PUT).
   * @param {string} id
   * @param {Object} resource
   */
  async updatePatient(id, resource) {
    return this.client._fetch(
      this._base(`/patients/${encodeURIComponent(id)}/update`),
      this._opts({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resource || {}),
      })
    );
  }

  /**
   * Observations for a patient (most recent first).
   */
  async listObservations(patientId, { count } = {}) {
    const url = new URL(this._base(
      `/patients/${encodeURIComponent(patientId)}/observations`
    ));
    if (count) url.searchParams.set("count", String(count));
    return this.client._fetch(url.toString(), this._opts({ method: "GET" }));
  }

  /**
   * Encounters for a patient (most recent first).
   */
  async listEncounters(patientId, { count } = {}) {
    const url = new URL(this._base(
      `/patients/${encodeURIComponent(patientId)}/encounters`
    ));
    if (count) url.searchParams.set("count", String(count));
    return this.client._fetch(url.toString(), this._opts({ method: "GET" }));
  }

  /**
   * DocumentReference rows for a patient (chart notes, lab PDFs, etc.).
   */
  async listDocuments(patientId, { count } = {}) {
    const url = new URL(this._base(
      `/patients/${encodeURIComponent(patientId)}/documents`
    ));
    if (count) url.searchParams.set("count", String(count));
    return this.client._fetch(url.toString(), this._opts({ method: "GET" }));
  }

  /**
   * Upload a binary attachment for a patient.
   *
   * Backend creates a FHIR Binary, then a DocumentReference pointing
   * at it. Returns the DocumentReference resource.
   *
   * @param {string} patientId
   * @param {File|Blob} file
   * @param {Object} [opts]
   * @param {string} [opts.description]  short label, e.g. "Lab result PDF"
   * @param {string} [opts.category]     DocumentReference category, e.g. "lab-results"
   * @param {string} [opts.contentType]  override the file's contentType
   */
  async uploadDocument(patientId, file, { description, category, contentType } = {}) {
    if (!file) throw new Error("uploadDocument: file is required");
    const fd = new FormData();
    fd.append("file", file, file.name || "upload.bin");
    if (description) fd.append("description", description);
    if (category) fd.append("category", category);
    if (contentType) fd.append("content_type", contentType);
    return this.client._fetch(
      this._base(`/patients/${encodeURIComponent(patientId)}/documents/upload`),
      this._opts({ method: "POST", body: fd })
      // intentionally no Content-Type header — browser sets multipart boundary
    );
  }

  // ── Practitioners ────────────────────────────────────────────────────

  async listPractitioners({ count } = {}) {
    const url = new URL(this._base("/practitioners"));
    if (count) url.searchParams.set("count", String(count));
    return this.client._fetch(url.toString(), this._opts({ method: "GET" }));
  }

  async getPractitioner(id) {
    return this.client._fetch(
      this._base(`/practitioners/${encodeURIComponent(id)}`),
      this._opts({ method: "GET" })
    );
  }

  async createPractitioner(resource) {
    return this.client._fetch(this._base("/practitioners/create"), this._opts({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resource || {}),
    }));
  }

  async updatePractitioner(id, resource) {
    return this.client._fetch(
      this._base(`/practitioners/${encodeURIComponent(id)}/update`),
      this._opts({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resource || {}),
      })
    );
  }
}
