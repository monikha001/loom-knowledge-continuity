
import { useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  X,
  Users,
  Lightbulb,
  ListChecks,
  Network,
  FileSearch,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import "./KnowledgeExtraction.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export default function KnowledgeExtraction({
  document,
  organizationId,
  userId,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [result, setResult] = useState(null);
  const [selectedEntities, setSelectedEntities] = useState([]);
  const [selectedRelationships, setSelectedRelationships] = useState([]);

  async function extractKnowledge() {
    setLoading(true);
    setError("");
    setSuccess("");
    setResult(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.access_token) {
        throw new Error("Your session expired. Please sign in again.");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/documents/${document.id}/extract-local`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "AI extraction failed.");
      }

      const extraction = data.extraction;

      setResult(extraction);
      setSelectedEntities(
        extraction.entities.map((_, index) => index)
      );
      setSelectedRelationships(
        extraction.relationships.map((_, index) => index)
      );
    } catch (err) {
      console.error("LOOM AI extraction:", err);
      setError(err.message || "Unable to extract knowledge.");
    } finally {
      setLoading(false);
    }
  }

  function toggleEntity(index) {
    setSelectedEntities((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index]
    );
  }

  function toggleRelationship(index) {
    setSelectedRelationships((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index]
    );
  }

  async function approveKnowledge() {
    if (!result || !organizationId || !userId) {
      setError("Organisation or user information is missing.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const selected = result.entities.filter((_, index) =>
        selectedEntities.includes(index)
      );

      const entityIds = new Map();
      let entityCount = 0;
      let relationshipCount = 0;

      // Save approved entities or reuse matching existing records.
      for (const entity of selected) {
        const { data: existing, error: lookupError } =
          await supabase
            .from("knowledge_entities")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("entity_type", entity.type)
            .eq("name", entity.name)
            .limit(1);

        if (lookupError) throw lookupError;

        let entityId = existing?.[0]?.id;

        if (!entityId) {
          const { data: created, error: insertError } =
            await supabase
              .from("knowledge_entities")
              .insert({
                organization_id: organizationId,
                entity_type: entity.type,
                name: entity.name,
                description: entity.description,
                source_document_id: document.id,
                verification_status: "approved",
                created_by: userId,
                metadata: {
                  evidence_excerpt: entity.evidence_excerpt,
                  confidence: entity.confidence,
                  extraction_method: "Local rule-based extractor",
                },
              })
              .select("id")
              .single();

          if (insertError) throw insertError;

          entityId = created.id;
          entityCount += 1;
        }

        entityIds.set(entity.name.toLowerCase(), entityId);
      }

      // Save only relationships whose two entities were approved.
      const approvedRelationships =
        result.relationships.filter((_, index) =>
          selectedRelationships.includes(index)
        );

      for (const relationship of approvedRelationships) {
        const sourceId = entityIds.get(
          relationship.source.toLowerCase()
        );

        const targetId = entityIds.get(
          relationship.target.toLowerCase()
        );

        if (!sourceId || !targetId || sourceId === targetId) {
          continue;
        }

        const { data: existing, error: lookupError } =
          await supabase
            .from("knowledge_relationships")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("source_entity_id", sourceId)
            .eq("target_entity_id", targetId)
            .eq("relationship_type", relationship.type)
            .limit(1);

        if (lookupError) throw lookupError;

        if (existing?.length) continue;

        const { error: insertError } = await supabase
          .from("knowledge_relationships")
          .insert({
            organization_id: organizationId,
            source_entity_id: sourceId,
            target_entity_id: targetId,
            relationship_type: relationship.type,
            source_document_id: document.id,
            evidence_excerpt: relationship.evidence_excerpt,
            confidence: relationship.confidence,
            created_by: userId,
          });

        if (insertError) throw insertError;

        relationshipCount += 1;
      }

      // Record the successful approval.
      const { error: activityError } = await supabase
        .from("activity_events")
        .insert({
          organization_id: organizationId,
          actor_id: userId,
          action: "knowledge_extraction_approved",
          entity_type: "document",
          entity_id: document.id,
          summary: `Approved ${selected.length} knowledge entities from ${document.title}`,
          metadata: {
            entities_created: entityCount,
            relationships_created: relationshipCount,
          },
        });

      if (activityError) {
        console.warn("Activity event could not be recorded:", activityError);
      }

      setSuccess(
        `Approval complete. ${entityCount} new entities and ${relationshipCount} new relationships saved.`
      );
    } catch (err) {
      console.error("LOOM knowledge approval:", err);
      setError(err.message || "Unable to save approved knowledge.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="knowledge-extraction">
      <button
        type="button"
        className="knowledge-ai-button"
        onClick={extractKnowledge}
        disabled={loading || saving}
      >
        {loading ? (
          <LoaderCircle size={15} className="knowledge-ai-spin" />
        ) : (
          <BrainCircuit size={15} />
        )}
        {loading ? "Analysing locally..." : "Analyse locally"}
      </button>

      {error && (
        <div className="knowledge-ai-inline-error" role="alert">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {result && (
        <div
          className="knowledge-review-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setResult(null);
              setSuccess("");
              setError("");
            }
          }}
        >
          <section
            className="knowledge-review-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="knowledge-review-title"
          >
            <header className="knowledge-review-header">
              <div>
                <span className="knowledge-review-eyebrow">
                  <BrainCircuit size={15} />
                  LOOM LOCAL ANALYSIS
                </span>
                <h2 id="knowledge-review-title">
                  Review extracted knowledge
                </h2>
                <p>{document.title}</p>
              </div>

              <button
                type="button"
                className="knowledge-review-close"
                onClick={() => {
                  if (!saving) {
                    setResult(null);
                    setSuccess("");
                    setError("");
                  }
                }}
                disabled={saving}
                aria-label="Close review"
              >
                <X size={20} />
              </button>
            </header>

            {success ? (
              <div className="knowledge-review-success">
                <CheckCircle2 size={35} />
                <h3>Knowledge successfully saved</h3>
                <p>{success}</p>
                <button
                  type="button"
                  className="knowledge-review-approve"
                  onClick={() => setResult(null)}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="knowledge-review-body">
                  <div className="knowledge-summary">
                    <strong>Document summary</strong>
                    <p>{result.summary || "No summary returned."}</p>
                  </div>

                  <section className="knowledge-review-section">
                    <div className="knowledge-review-section-title">
                      <Users size={18} />
                      <h3>People, tasks and knowledge</h3>
                      <span>{selectedEntities.length}/{result.entities.length}</span>
                    </div>

                    {result.entities.length === 0 ? (
                      <p className="knowledge-no-results">
                        No supported entities were identified.
                      </p>
                    ) : (
                      result.entities.map((entity, index) => (
                        <label
                          className="knowledge-review-item"
                          key={`${entity.type}-${entity.name}-${index}`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedEntities.includes(index)}
                            onChange={() => toggleEntity(index)}
                            disabled={saving}
                          />

                          <div className="knowledge-review-item-content">
                            <div className="knowledge-review-item-top">
                              <strong>{entity.name}</strong>
                              <span>{entity.type}</span>
                            </div>

                            <p>{entity.description}</p>

                            {entity.evidence_excerpt && (
                              <blockquote>
                                "{entity.evidence_excerpt}"
                              </blockquote>
                            )}

                            <small>
                              Confidence: {Math.round((entity.confidence ?? 0) * 100)}%
                            </small>
                          </div>
                        </label>
                      ))
                    )}
                  </section>

                  <section className="knowledge-review-section">
                    <div className="knowledge-review-section-title">
                      <Network size={18} />
                      <h3>Relationships</h3>
                      <span>
                        {selectedRelationships.length}/{result.relationships.length}
                      </span>
                    </div>

                    {result.relationships.length === 0 ? (
                      <p className="knowledge-no-results">
                        No supported relationships were identified.
                      </p>
                    ) : (
                      result.relationships.map((relationship, index) => (
                        <label
                          className="knowledge-review-relationship"
                          key={`${relationship.source}-${relationship.target}-${index}`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedRelationships.includes(index)}
                            onChange={() => toggleRelationship(index)}
                            disabled={saving}
                          />

                          <div>
                            <strong>{relationship.source}</strong>
                            <span className="knowledge-relation-type">
                              {relationship.type.replaceAll("_", " ")}
                            </span>
                            <strong>{relationship.target}</strong>

                            {relationship.evidence_excerpt && (
                              <small>{relationship.evidence_excerpt}</small>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </section>

                  <section className="knowledge-review-section knowledge-gaps">
                    <div className="knowledge-review-section-title">
                      <Lightbulb size={18} />
                      <h3>Potential knowledge gaps</h3>
                    </div>

                    {result.knowledge_gaps.length === 0 ? (
                      <p className="knowledge-no-results">
                        No gaps were identified by the model.
                      </p>
                    ) : (
                      result.knowledge_gaps.map((gap, index) => (
                        <div className="knowledge-gap-item" key={index}>
                          <AlertCircle size={14} />
                          {gap}
                        </div>
                      ))
                    )}
                    <small>
                      These suggestions are for review and have not been
                      saved as verified knowledge gaps.
                    </small>
                  </section>

                  {error && (
                    <div className="knowledge-ai-inline-error">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}
                </div>

                <footer className="knowledge-review-footer">
                  <div>
                    <ShieldCheck size={16} />
                    Human approval required before saving
                  </div>

                  <button
                    type="button"
                    className="knowledge-review-approve"
                    disabled={
                      saving ||
                      selectedEntities.length === 0
                    }
                    onClick={approveKnowledge}
                  >
                    {saving ? (
                      <>
                        <LoaderCircle
                          size={16}
                          className="knowledge-ai-spin"
                        />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        Approve & save
                      </>
                    )}
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
