
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import "./KnowledgeGraph.css";

import {
  Search,
  RefreshCw,
  Network,
  Users,
  FileText,
  ListChecks,
  Lightbulb,
  Layers,
  X,
  AlertCircle,
  Info,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";

// ------------------------------------------
// NODE TYPE CONFIGURATION
// ------------------------------------------

const nodeColors = {
  person: "#39845f",
  team: "#39845f",
  project: "#567c9e",
  process: "#567c9e",
  responsibility: "#567c9e",
  task: "#527cae",
  decision: "#a27c3b",
  document: "#8265a0",
};

const nodeIcons = {
  person: Users,
  team: Users,
  project: Layers,
  process: Network,
  responsibility: ShieldCheck,
  task: ListChecks,
  decision: Lightbulb,
  document: FileText,
};

function getColumn(type) {
  if (["person", "team"].includes(type)) return 0;

  if (["project", "process", "decision"].includes(type)) {
    return 1;
  }

  if (["task", "responsibility"].includes(type)) return 2;

  return 3;
}

function getTypeColor(type) {
  return nodeColors[type] || "#75867d";
}

// ------------------------------------------
// CUSTOM KNOWLEDGE NODE
// ------------------------------------------

function KnowledgeNode({ data, selected }) {
  const Icon = nodeIcons[data.entityType] || Network;
  const color = getTypeColor(data.entityType);

  return (
    <div
      className={`kg-node ${selected ? "kg-node-selected" : ""}`}
      style={{ "--node-accent": color }}
    >
      <Handle type="target" position={Position.Left} />

      <div className="kg-node-icon">
        <Icon size={17} />
      </div>

      <div className="kg-node-content">
        <span className="kg-node-type">
          {data.entityType}
        </span>

        <strong>{data.name}</strong>

        {data.description && (
          <small>{data.description}</small>
        )}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  knowledge: KnowledgeNode,
};

// ------------------------------------------
// GRAPH COMPONENT
// ------------------------------------------

export default function KnowledgeGraph({ organizationId }) {
  const [entities, setEntities] = useState([]);
  const [relationships, setRelationships] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedNode, setSelectedNode] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [flowInstance, setFlowInstance] = useState(null);
  // ----------------------------------------
  // FETCH REAL SUPABASE DATA
  // ----------------------------------------

  const loadGraph = useCallback(async () => {
    if (!organizationId) {
      setError("Organisation information is missing.");
      setLoading(false);
      return;
    }

    setError("");
    setRefreshing(true);

    try {
      const [
        { data: entityData, error: entityError },
        { data: relationshipData, error: relationshipError },
      ] = await Promise.all([
        supabase
          .from("knowledge_entities")
          .select(
            "id, entity_type, name, description, source_document_id, verification_status, metadata, created_at"
          )
          .eq("organization_id", organizationId)
          .eq("verification_status", "approved")
          .order("created_at", { ascending: true }),

        supabase
          .from("knowledge_relationships")
          .select(
            "id, source_entity_id, target_entity_id, relationship_type, source_document_id, evidence_excerpt, confidence, created_at"
          )
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: true }),
      ]);

      if (entityError) throw entityError;
      if (relationshipError) throw relationshipError;

      setEntities(entityData || []);
      setRelationships(relationshipData || []);

      setSelectedNode((current) =>
        current
          ? (entityData || []).find(
              (item) => item.id === current.id
            ) || null
          : null
      );
    } catch (err) {
      console.error("Knowledge Graph loading:", err);
      setError(
        err.message || "Unable to load knowledge graph."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  // ----------------------------------------
  // BUILD GRAPH NODES
  // ----------------------------------------

  const allNodes = useMemo(() => {
    const columnCounters = [0, 0, 0, 0];

    const sortedEntities = [...entities].sort((a, b) => {
      const columnDifference =
        getColumn(a.entity_type) - getColumn(b.entity_type);

      if (columnDifference !== 0) return columnDifference;

      return a.name.localeCompare(b.name);
    });

    return sortedEntities.map((entity) => {
      const column = getColumn(entity.entity_type);
      const row = columnCounters[column]++;

      return {
        id: entity.id,
        type: "knowledge",
        position: {
         x: 90 + column * 320,
         y: 65 + row * 118,
        },
        draggable: true,
        data: {
          name: entity.name,
          entityType: entity.entity_type,
          description: entity.description || "",
          sourceDocumentId: entity.source_document_id,
          evidenceExcerpt:
            entity.metadata?.evidence_excerpt || "",
          confidence:
            entity.metadata?.confidence ?? null,
        },
      };
    });
  }, [entities]);

  // ----------------------------------------
  // FILTER GRAPH
  // ----------------------------------------

  const filteredNodes = useMemo(() => {
    return allNodes.filter((node) => {
      const type = node.data.entityType;

      const matchesFilter =
        filter === "all" ||
        (filter === "people" &&
          ["person", "team"].includes(type)) ||
        (filter === "work" &&
          ["task", "process", "project", "responsibility"].includes(type)) ||
        (filter === "decisions" && type === "decision") ||
        (filter === "documents" && type === "document");

      const searchText = [
        node.data.name,
        node.data.description,
        type,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchText.includes(
        search.toLowerCase()
      );

      return matchesFilter && matchesSearch;
    });
  }, [allNodes, filter, search]);

  const visibleNodeIds = useMemo(
    () => new Set(filteredNodes.map((node) => node.id)),
    [filteredNodes]
  );

  // ----------------------------------------
  // BUILD GRAPH EDGES
  // ----------------------------------------

  const allEdges = useMemo(() => {
    return relationships
      .filter(
        (relationship) =>
          visibleNodeIds.has(relationship.source_entity_id) &&
          visibleNodeIds.has(relationship.target_entity_id)
      )
      .map((relationship) => ({
        id: relationship.id,
        source: relationship.source_entity_id,
        target: relationship.target_entity_id,
        type: "smoothstep",
        label: relationship.relationship_type.replaceAll("_", " "),
        animated: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#90aa98",
        },
        style: {
          stroke: "#90aa98",
          strokeWidth: 1.8,
        },
        labelStyle: {
          fill: "#516b5b",
          fontSize: 10,
          fontWeight: 600,
        },
        labelBgStyle: {
          fill: "#f5f8f5",
          fillOpacity: 0.96,
        },
        labelBgPadding: [5, 3],
        labelBgBorderRadius: 4,
      }));
  }, [relationships, visibleNodeIds]);

  // ----------------------------------------
  // STATISTICS
  // ----------------------------------------

  const stats = useMemo(() => ({
    total: entities.length,
    people: entities.filter(
      (item) => ["person", "team"].includes(item.entity_type)
    ).length,
    tasks: entities.filter(
      (item) => item.entity_type === "task"
    ).length,
    decisions: entities.filter(
      (item) => item.entity_type === "decision"
    ).length,
    connections: relationships.length,
  }), [entities, relationships]);

  // ----------------------------------------
  // SELECTED NODE DETAILS
  // ----------------------------------------

  const selectedEntity = selectedNode
    ? entities.find((item) => item.id === selectedNode.id)
    : null;

  const selectedRelationships = selectedEntity
    ? relationships.filter(
        (relationship) =>
          relationship.source_entity_id === selectedEntity.id ||
          relationship.target_entity_id === selectedEntity.id
      )
    : [];

  function getRelatedName(id) {
    return entities.find((entity) => entity.id === id)?.name || "Unknown entity";
  }

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="kg-page">
      <header className="kg-page-header">
        <div>
          <span className="kg-eyebrow">
            <Network size={15} />
            ORGANISATIONAL INTELLIGENCE
          </span>

          <h1>Knowledge Graph</h1>

          <p>
            Explore how your organisation's people, decisions,
            processes and responsibilities connect.
          </p>
        </div>

        <button
          className="kg-refresh-button"
          type="button"
          disabled={refreshing}
          onClick={loadGraph}
        >
          <RefreshCw
            size={16}
            className={refreshing ? "kg-spin" : ""}
          />
          Refresh graph
        </button>
      </header>

      {error && (
        <div className="kg-error">
          <AlertCircle size={17} />
          {error}
        </div>
      )}

      <section className="kg-stats">
        <div>
          <span>Knowledge entities</span>
          <strong>{stats.total}</strong>
        </div>

        <div>
          <span>People & teams</span>
          <strong>{stats.people}</strong>
        </div>

        <div>
          <span>Tasks</span>
          <strong>{stats.tasks}</strong>
        </div>

        <div>
          <span>Decisions</span>
          <strong>{stats.decisions}</strong>
        </div>

        <div>
          <span>Connections</span>
          <strong>{stats.connections}</strong>
        </div>
      </section>

      <section className="kg-workspace">
        <div className="kg-toolbar">
          <div className="kg-search">
            <Search size={17} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search people, tasks, decisions..."
              aria-label="Search graph"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="kg-filter-buttons">
            {[
              ["all", "All"],
              ["people", "People"],
              ["work", "Work"],
              ["decisions", "Decisions"],
              ["documents", "Documents"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "selected" : ""}
                onClick={() => {
                  setFilter(value);
                  setSelectedNode(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="kg-view-controls">
  <span>GRAPH VIEW CONTROLS</span>

  <div className="kg-view-buttons">
    <button
      type="button"
      onClick={() => flowInstance?.zoomOut({ duration: 200 })}
      disabled={!flowInstance}
    >
      −
      <span>Zoom out</span>
    </button>

    <button
      type="button"
      onClick={() => flowInstance?.zoomIn({ duration: 200 })}
      disabled={!flowInstance}
    >
      +
      <span>Zoom in</span>
    </button>

    <button
      type="button"
      onClick={() =>
        flowInstance?.fitView({
          padding: 0.16,
          minZoom: 0.65,
          maxZoom: 1.1,
          duration: 350,
        })
      }
      disabled={!flowInstance}
    >
      <RefreshCw size={14} />
      <span>Fit all</span>
    </button>

    <button
      type="button"
      onClick={() => {
        if (selectedNode) {
          flowInstance?.fitView({
            nodes: [{ id: selectedNode.id }],
            padding: 0.5,
            maxZoom: 1.25,
            duration: 350,
          });
        }
      }}
      disabled={!flowInstance || !selectedNode}
    >
      <Network size={14} />
      <span>Focus selected</span>
    </button>
  </div>
</div>

        </div>

        {loading ? (
          <div className="kg-empty">
            <RefreshCw className="kg-spin" size={26} />
            <strong>Loading organisational knowledge...</strong>
          </div>
        ) : entities.length === 0 ? (
          <div className="kg-empty">
            <Network size={38} />

            <h2>Your knowledge graph is waiting.</h2>

            <p>
              Analyse and approve a document in Knowledge Vault.
              Its saved entities and relationships will appear here.
            </p>
          </div>
        ) : filteredNodes.length === 0 ? (
          <div className="kg-empty">
            <Search size={30} />

            <h2>No matching knowledge found.</h2>

            <p>Try another search term or graph category.</p>
          </div>
        ) : (
          <div className={`kg-graph-layout ${selectedEntity ? "has-selection" : ""}`}>
            <div className="kg-flow-canvas">
              <ReactFlow
                nodes={filteredNodes}
                edges={allEdges}
                nodeTypes={nodeTypes}
                nodesDraggable={true}
                nodesConnectable={false}
                elementsSelectable={true}
                fitView
                fitViewOptions={{
                 padding: 0.16,
                 minZoom: 0.65,
                 maxZoom: 1.1,
                 }}
                minZoom={0.15}
                maxZoom={1.5}
                onNodeClick={(_, node) => setSelectedNode(node)}
                onPaneClick={() => setSelectedNode(null)}
                proOptions={{ hideAttribution: false }}
                onInit={setFlowInstance}
              >
                <Background
                  color="#dce7df"
                  gap={20}
                  size={1}
                />

                <Controls showInteractive={false} />

                <MiniMap
  width={150}
  height={100}
  nodeColor={(node) =>
    getTypeColor(node.data.entityType)
  }
  maskColor="rgba(34, 60, 45, 0.12)"
  bgColor="#f0f5f0"
  nodeStrokeWidth={3}
  pannable
  zoomable
/>
              </ReactFlow>
            </div>

            {selectedEntity && (
              <aside className="kg-inspector">
                <div className="kg-inspector-header">
                  <span>ENTITY DETAILS</span>

                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    aria-label="Close details"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div
                  className="kg-inspector-icon"
                  style={{
                    "--node-accent": getTypeColor(
                      selectedEntity.entity_type
                    ),
                  }}
                >
                  {(() => {
                    const Icon =
                      nodeIcons[selectedEntity.entity_type] || Network;
                    return <Icon size={23} />;
                  })()}
                </div>

                <span className="kg-inspector-type">
                  {selectedEntity.entity_type}
                </span>

                <h2>{selectedEntity.name}</h2>

                <p className="kg-inspector-description">
                  {selectedEntity.description ||
                    "No description is available."}
                </p>

                {selectedEntity.metadata?.evidence_excerpt && (
                  <div className="kg-inspector-evidence">
                    <strong>Source evidence</strong>
                    <p>
                      {selectedEntity.metadata.evidence_excerpt}
                    </p>
                  </div>
                )}

                <div className="kg-inspector-confidence">
                  <span>Extraction confidence</span>
                  <strong>
                    {Number.isFinite(
                      Number(selectedEntity.metadata?.confidence)
                    )
                      ? `${Math.round(
                          Number(selectedEntity.metadata.confidence) * 100
                        )}%`
                      : "Not recorded"}
                  </strong>
                </div>

                <div className="kg-inspector-connections">
                  <strong>
                    Connections ({selectedRelationships.length})
                  </strong>

                  {selectedRelationships.length === 0 ? (
                    <p>No connections have been recorded.</p>
                  ) : (
                    selectedRelationships.map((relationship) => {
                      const isSource =
                        relationship.source_entity_id === selectedEntity.id;

                      return (
                        <div
                          className="kg-inspector-connection"
                          key={relationship.id}
                        >
                          <span>
                            {relationship.relationship_type.replaceAll("_", " ")}
                          </span>

                          <strong>
                            {isSource
                              ? getRelatedName(relationship.target_entity_id)
                              : getRelatedName(relationship.source_entity_id)}
                          </strong>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="kg-inspector-security">
                  <ShieldCheck size={15} />
                  Approved knowledge record
                </div>
              </aside>
            )}
          </div>
        )}

        <footer className="kg-graph-footer">
          <div>
            <Info size={14} />
            Select a node to inspect its evidence and connections.
          </div>

          <span>
            Showing {filteredNodes.length} of {entities.length} entities
          </span>
        </footer>
      </section>
    </div>
  );
}
