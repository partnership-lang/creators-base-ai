"use client";

import { useMemo, useState } from "react";
import { AGE_BUCKETS, GENDERS, SOURCES, STATUSES } from "@/lib/constants";
import { createClient } from "@/lib/supabase-browser";
import { Creator, CreatorStatus, GeminiOutput, Source, WorkspaceInvite } from "@/lib/types";

type Props = {
  userEmail: string;
  workspaceId: string;
  initialCreators: Creator[];
  initialInvites: WorkspaceInvite[];
};

type CreatorInput = Omit<Creator, "id" | "workspace_id" | "created_at">;

const EMPTY_AI: GeminiOutput = {
  gender: "",
  age_range: "",
  race: "",
  instagram: "",
  email: "",
  contact: "",
  country: "",
  language: "",
  niches: "",
  budget: "",
  source: "",
  comment: ""
};

const EMPTY_FORM: CreatorInput = {
  name: "",
  photo_url: null,
  instagram: "",
  portfolio: "",
  email: "",
  contact: "",
  language: "",
  niches: "",
  country: "",
  budget: "",
  gender: "",
  age_range: "",
  race: "",
  source: "",
  status: "Added in base",
  comment: "",
  ai_raw_input: ""
};

function getErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const maybe = error as { message?: string; details?: string; hint?: string; code?: string };
    const chunks = [maybe.message, maybe.details, maybe.hint, maybe.code].filter(Boolean);
    if (chunks.length > 0) return chunks.join(" | ");
  }
  return fallback;
}

function mergeAiPreserveNonEmpty(base: GeminiOutput, next: Partial<GeminiOutput>) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(next) as Array<[keyof GeminiOutput, unknown]>) {
    if (typeof value === "string" && value.trim() !== "") {
      merged[key] = value.trim();
    }
  }
  return merged;
}

export default function Dashboard({ userEmail, workspaceId, initialCreators, initialInvites }: Props) {
  const supabase = createClient();

  const [creators, setCreators] = useState<Creator[]>(initialCreators);
  const [invites, setInvites] = useState<WorkspaceInvite[]>(initialInvites);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreatorInput>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState("");

  const [q, setQ] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [raceFilter, setRaceFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [nicheFilter, setNicheFilter] = useState("");
  const [budgetFilter, setBudgetFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [sortBy, setSortBy] = useState<"created_at" | "name">("created_at");

  function resetFilters() {
    setQ("");
    setGenderFilter("");
    setAgeFilter("");
    setRaceFilter("");
    setCountryFilter("");
    setNicheFilter("");
    setBudgetFilter("");
    setStatusFilter("");
    setSourceFilter("");
    setSortBy("created_at");
  }

  const visible = useMemo(() => {
    const normalized = creators.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (genderFilter && c.gender !== genderFilter) return false;
      if (ageFilter && c.age_range !== ageFilter) return false;
      if (raceFilter && !(c.race || "").toLowerCase().includes(raceFilter.toLowerCase())) return false;
      if (countryFilter && !(c.country || "").toLowerCase().includes(countryFilter.toLowerCase())) return false;
      if (nicheFilter && !(c.niches || "").toLowerCase().includes(nicheFilter.toLowerCase())) return false;
      if (budgetFilter && !(c.budget || "").toLowerCase().includes(budgetFilter.toLowerCase())) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (sourceFilter && c.source !== sourceFilter) return false;
      return true;
    });

    return normalized.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [creators, q, genderFilter, ageFilter, raceFilter, countryFilter, nicheFilter, budgetFilter, statusFilter, sourceFilter, sortBy]);

  function patch<K extends keyof CreatorInput>(field: K, value: CreatorInput[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function uploadPhotoIfNeeded(): Promise<string | null> {
    if (!imageFile) return form.photo_url;

    const ext = imageFile.name.split(".").pop() || "jpg";
    const filePath = `${workspaceId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("creator-photos").upload(filePath, imageFile, {
      upsert: false,
      contentType: imageFile.type
    });

    if (error) throw error;

    const { data } = supabase.storage.from("creator-photos").getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function reloadCreators() {
    const { data, error } = await supabase
      .from("creators")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    setCreators((data as Creator[]) || []);
  }

  async function reloadInvites() {
    const { data, error } = await supabase
      .from("workspace_invites")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    setInvites((data as WorkspaceInvite[]) || []);
  }

  function startEdit(item: Creator) {
    setEditingId(item.id);
    setImageFile(null);
    setForm({
      name: item.name,
      photo_url: item.photo_url,
      instagram: item.instagram,
      portfolio: item.portfolio,
      email: item.email,
      contact: item.contact,
      language: item.language,
      niches: item.niches,
      country: item.country,
      budget: item.budget,
      gender: item.gender,
      age_range: item.age_range,
      race: item.race,
      source: item.source,
      status: item.status,
      comment: item.comment,
      ai_raw_input: item.ai_raw_input
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setImageFile(null);
    setForm(EMPTY_FORM);
  }

  async function saveCreator() {
    if (!form.name.trim()) {
      setMessage("Name is required");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const photoUrl = await uploadPhotoIfNeeded();
      const payload = { ...form, workspace_id: workspaceId, photo_url: photoUrl };

      if (editingId) {
        const { error } = await supabase.from("creators").update(payload).eq("id", editingId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("creators").insert(payload);
        if (error) throw new Error(error.message);
      }

      await reloadCreators();
      resetForm();
      setMessage("Saved");
    } catch (e) {
      setMessage(getErrorMessage(e, "Save failed"));
    } finally {
      setLoading(false);
    }
  }

  async function inviteMember() {
    if (!inviteEmail) return;
    const { error } = await supabase.rpc("invite_member", {
      p_workspace_id: workspaceId,
      p_invite_email: inviteEmail
    });

    if (error) {
      setMessage(getErrorMessage(error, "Invite failed"));
      return;
    }

    await reloadInvites();
    setMessage("Invite added. User gets access after login.");
    setInviteEmail("");
  }

  async function analyzeWithAi() {
    setLoading(true);
    setMessage("");
    try {
      let ai = { ...EMPTY_AI };

      if (form.ai_raw_input?.trim()) {
        const t = await fetch("/api/analyze-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: form.ai_raw_input })
        });
        if (!t.ok) throw new Error(await t.text());
        ai = mergeAiPreserveNonEmpty(ai, (await t.json()) as Partial<GeminiOutput>);
      }

      if (imageFile) {
        const buffer = await imageFile.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        bytes.forEach((b) => {
          binary += String.fromCharCode(b);
        });

        const p = await fetch("/api/analyze-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: btoa(binary), mimeType: imageFile.type })
        });
        if (!p.ok) throw new Error(await p.text());
        ai = mergeAiPreserveNonEmpty(ai, (await p.json()) as Partial<GeminiOutput>);
      }

      patch("gender", (ai.gender as "Male" | "Female" | "") || "");
      patch("age_range", ai.age_range || "");
      patch("race", ai.race || "");
      patch("instagram", ai.instagram || form.instagram || "");
      patch("email", ai.email || form.email || "");
      patch("contact", ai.contact || form.contact || "");
      patch("country", ai.country || form.country || "");
      patch("language", ai.language || form.language || "");
      patch("niches", ai.niches || form.niches || "");
      patch("budget", ai.budget || form.budget || "");
      patch("source", (ai.source as Source) || form.source || "");
      patch("comment", ai.comment || form.comment || "");
      setMessage("AI fields updated");
    } catch (e) {
      setMessage(getErrorMessage(e, "AI analyze failed"));
    } finally {
      setLoading(false);
    }
  }

  async function deleteCreator(id: string) {
    if (!confirm("Delete creator?")) return;
    const { error } = await supabase.from("creators").delete().eq("id", id);
    setMessage(error ? error.message : "Deleted");
    if (!error) await reloadCreators();
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function downloadPhoto(url: string, name: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to download image");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${name || "creator-photo"}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      setMessage(getErrorMessage(e, "Photo download failed"));
    }
  }

  return (
    <main className="container">
      <div className="topbar">
        <div>
          <h1 style={{ margin: 0 }}>Creators Base AI</h1>
          <small>{userEmail}</small>
        </div>
        <div className="actions">
          <button className="secondary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Team Access (Shared Workspace)</h3>
        <div className="actions">
          <input
            type="email"
            placeholder="friend@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <button onClick={inviteMember}>Add user</button>
        </div>
        <small>Invited email gets access after first login.</small>
        {invites.length > 0 && (
          <>
            <div style={{ height: 8 }} />
            <small>Pending/known invites:</small>
            <div className="actions" style={{ flexWrap: "wrap", marginTop: 6 }}>
              {invites.map((invite) => (
                <span className="badge" key={invite.id}>
                  {invite.invite_email}
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>{editingId ? "Edit Creator" : "New Creator"}</h3>
        <div className="grid two">
          <div className="grid">
            <label>Name</label>
            <input value={form.name} onChange={(e) => patch("name", e.target.value)} />
          </div>
          <div className="grid">
            <label>Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <div className="grid four" style={{ marginTop: 8 }}>
          <input placeholder="Instagram" value={form.instagram || ""} onChange={(e) => patch("instagram", e.target.value)} />
          <input placeholder="Portfolio" value={form.portfolio || ""} onChange={(e) => patch("portfolio", e.target.value)} />
          <input placeholder="Email" value={form.email || ""} onChange={(e) => patch("email", e.target.value)} />
          <input placeholder="Contact" value={form.contact || ""} onChange={(e) => patch("contact", e.target.value)} />
          <input placeholder="Language" value={form.language || ""} onChange={(e) => patch("language", e.target.value)} />
          <input placeholder="Niches" value={form.niches || ""} onChange={(e) => patch("niches", e.target.value)} />
          <input placeholder="Country" value={form.country || ""} onChange={(e) => patch("country", e.target.value)} />
          <input placeholder="Budget" value={form.budget || ""} onChange={(e) => patch("budget", e.target.value)} />
          <select value={form.gender} onChange={(e) => patch("gender", e.target.value as "Male" | "Female" | "")}> 
            {GENDERS.map((x) => (
              <option key={x} value={x}>
                {x || "Gender"}
              </option>
            ))}
          </select>
          <select value={form.age_range || ""} onChange={(e) => patch("age_range", e.target.value)}>
            <option value="">Age</option>
            {AGE_BUCKETS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <input placeholder="Race" value={form.race || ""} onChange={(e) => patch("race", e.target.value)} />
          <select value={form.source} onChange={(e) => patch("source", e.target.value as Source)}>
            {SOURCES.map((x) => (
              <option key={x} value={x}>
                {x || "Source"}
              </option>
            ))}
          </select>
          <select value={form.status} onChange={(e) => patch("status", e.target.value as CreatorStatus)}>
            {STATUSES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>

        <div className="grid" style={{ marginTop: 8 }}>
          <textarea
            rows={3}
            placeholder="AI Raw Input"
            value={form.ai_raw_input || ""}
            onChange={(e) => patch("ai_raw_input", e.target.value)}
          />
          <textarea
            rows={2}
            placeholder="Comment"
            value={form.comment || ""}
            onChange={(e) => patch("comment", e.target.value)}
          />
        </div>

        <div className="actions" style={{ marginTop: 8 }}>
          <button onClick={analyzeWithAi} disabled={loading}>
            AI Analyze
          </button>
          <button className="secondary" onClick={saveCreator} disabled={loading}>
            {editingId ? "Update" : "Create"}
          </button>
          {editingId && (
            <button className="secondary" onClick={resetForm}>
              Cancel edit
            </button>
          )}
        </div>

        {message && <p>{message}</p>}
      </section>

      <section className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>Filters</h3>
        <div className="grid four">
          <input placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
            <option value="">Gender</option>
            {GENDERS.filter(Boolean).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)}>
            <option value="">Age</option>
            {AGE_BUCKETS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input placeholder="Race" value={raceFilter} onChange={(e) => setRaceFilter(e.target.value)} />
          <input placeholder="Country" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} />
          <input placeholder="Niches" value={nicheFilter} onChange={(e) => setNicheFilter(e.target.value)} />
          <input placeholder="Budget" value={budgetFilter} onChange={(e) => setBudgetFilter(e.target.value)} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">Source</option>
            {SOURCES.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "created_at" | "name")}>
            <option value="created_at">Sort: newest</option>
            <option value="name">Sort: name</option>
          </select>
        </div>
        <div className="actions" style={{ marginTop: 8 }}>
          <button className="secondary" onClick={resetFilters}>
            Reset filters
          </button>
        </div>
      </section>

      <section className="card">
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: "0 0 10px 0" }}>
            Creators ({visible.length}/{creators.length})
          </h3>
          <span className="badge">Workspace: Shared</span>
        </div>
        {creators.length > 0 && visible.length === 0 && (
          <p style={{ marginTop: 0 }}>
            Records exist, but current filters hide them. Click <strong>Reset filters</strong>.
          </p>
        )}
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Photo</th>
              <th>Geo / Lang</th>
              <th>Niches / Budget</th>
              <th>Status</th>
              <th>Contacts</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                  <br />
                  <small>
                    {c.gender || "-"} / {c.age_range || "-"} / {c.race || "-"}
                  </small>
                </td>
                <td>
                  {c.photo_url ? (
                    <div className="grid" style={{ gap: 6 }}>
                      <img src={c.photo_url} alt={c.name} width={70} height={70} />
                      <div className="actions">
                        <a href={c.photo_url} target="_blank" rel="noreferrer">
                          <button className="secondary" type="button">
                            Open
                          </button>
                        </a>
                        <button className="secondary" type="button" onClick={() => downloadPhoto(c.photo_url!, c.name)}>
                          Download
                        </button>
                      </div>
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  {c.country || "-"}
                  <br />
                  <small>{c.language || "-"}</small>
                </td>
                <td>
                  {c.niches || "-"}
                  <br />
                  <small>{c.budget || "-"}</small>
                </td>
                <td>
                  <span className="badge">{c.status}</span>
                  <br />
                  <small>{c.source || "-"}</small>
                </td>
                <td>
                  {c.instagram || "-"}
                  <br />
                  <small>{c.email || c.contact || "-"}</small>
                </td>
                <td>
                  <div className="actions">
                    <button className="secondary" onClick={() => startEdit(c)}>
                      Edit
                    </button>
                    <button className="secondary" onClick={() => deleteCreator(c.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
