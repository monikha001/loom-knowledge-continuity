
import { useState } from "react";
import { Building2, ArrowRight, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import "./OrganizationSetup.css";

export default function OrganizationSetup({ user, onCreated, onSignOut }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const organisationName = name.trim();

    if (organisationName.length < 2 || organisationName.length > 100) {
      setError("Enter an organisation name between 2 and 100 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: createError } = await supabase.rpc(
        "create_organization",
        { p_name: organisationName }
      );

      if (createError) throw createError;
      if (!data) throw new Error("The organisation was not created.");

      onCreated();
    } catch (err) {
      console.error("Organisation creation failed:", err);
      setError(err.message || "Unable to create your organisation.");
    } finally {
      setLoading(false);
    }
  }

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <main className="org-setup-screen">
      <div className="org-setup-brand">
        <div className="org-logo">L</div>
        <div>
          <strong>LOOM<span>.</span></strong>
          <small>KNOWLEDGE CONTINUITY</small>
        </div>
      </div>

      <section className="org-setup-card">
        <div className="org-setup-icon">
          <Building2 size={27} />
        </div>

        <span className="org-setup-eyebrow">YOUR WORKSPACE</span>

        <h1>Let's set up your organisation.</h1>

        <p className="org-setup-description">
          Hi {displayName}. Create an organisation to start connecting
          your team's people, decisions, documents and responsibilities.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="organisation-name">
            Organisation name
          </label>

          <input
            id="organisation-name"
            type="text"
            placeholder="e.g. Acme Technologies"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={100}
            autoFocus
          />

          {error && (
            <div className="org-setup-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Creating workspace..." : "Create organisation"}
            {!loading && <ArrowRight size={17} />}
          </button>
        </form>

        <div className="org-setup-security">
          <ShieldCheck size={16} />
          Your organisation's knowledge is isolated from other workspaces.
        </div>

        <div className="org-setup-account">
          <span>{user?.email}</span>
          <button type="button" onClick={onSignOut}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
