
function cleanLine(value) {
  return String(value || "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
    .trim()
    .replace(/[.!?;]+$/, "")
    .trim();
}

function normaliseSection(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function extractLocalKnowledge({
  title,
  originalFilename,
  extractedText,
}) {
  const entities = new Map();
  const relationships = new Map();
  const knowledgeGaps = new Set();

  let section = "";
  let projectName = "";

  function addEntity(
    type,
    name,
    description,
    evidence,
    confidence = 0.9
  ) {
    const cleanName = cleanLine(name);

    if (!cleanName) return cleanName;

    const key = `${type}:${cleanName.toLowerCase()}`;

    if (!entities.has(key)) {
      entities.set(key, {
        type,
        name: cleanName.slice(0, 200),
        description: String(description || "").slice(0, 1500),
        evidence_excerpt: String(evidence || "").slice(0, 1000),
        confidence,
      });
    }

    return cleanName;
  }

  function addRelationship(
    source,
    target,
    type,
    evidence,
    confidence = 0.9
  ) {
    if (!source || !target) return;

    if (source.toLowerCase() === target.toLowerCase()) {
      return;
    }

    const key =
      `${source.toLowerCase()}|${target.toLowerCase()}|${type}`;

    relationships.set(key, {
      source,
      target,
      type,
      evidence_excerpt: String(evidence || "").slice(0, 1000),
      confidence,
    });
  }

  function addTask(value, evidence) {
    const taskName = cleanLine(value)
      .replace(/\s+(?:is|are)\s+(?:unfinished|incomplete|pending|not completed)$/i, "")
      .trim();

    if (!taskName) return null;

    return addEntity(
      "task",
      taskName,
      `Task identified in the source document: ${evidence}`,
      evidence,
      0.95
    );
  }

  function addDecision(line) {
    const match = line.match(
      /\b(?:uses|use|selected|selects|chosen|adopted|adopts)\s+([A-Za-z][A-Za-z0-9.+#_-]*)/i
    );

    const decisionName = match
      ? match[1]
      : cleanLine(line);

    return addEntity(
      "decision",
      decisionName,
      line,
      line,
      0.9
    );
  }

  const lines = String(extractedText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      summary: "No readable document text was available.",
      entities: [],
      relationships: [],
      knowledge_gaps: [
        "The source document contains no readable extracted text.",
      ],
    };
  }

  // Create a project entity from an explicit project heading.
  for (const line of lines) {
    const projectMatch = line.match(/^PROJECT\s*:\s*(.+)$/i);

    if (projectMatch) {
      projectName = cleanLine(projectMatch[1]);

      addEntity(
        "project",
        projectName,
        "Project explicitly named in the source document.",
        line,
        0.99
      );
      break;
    }
  }

  // Identify document sections and extract supported information.
  for (const originalLine of lines) {
    const line = cleanLine(originalLine);

    if (!line) continue;

    const heading = originalLine.match(
      /^([A-Z][A-Z0-9\s/&_-]{2,})\s*:\s*$/
    );

    if (heading) {
      section = normaliseSection(heading[1]);
      continue;
    }

    // Team members and their explicitly listed responsibilities.
    if (
      section.includes("team_member") ||
      section === "team" ||
      section === "staff"
    ) {
      const personMatch = line.match(
        /^([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*)\s*[-–—:]\s*(.+)$/
      );

      if (personMatch) {
        const personName = addEntity(
          "person",
          personMatch[1],
          `Person listed in the team section of ${title}.`,
          originalLine,
          0.99
        );

        const responsibility = addEntity(
          "responsibility",
          personMatch[2],
          `${personMatch[1]} is listed with this role or responsibility.`,
          originalLine,
          0.95
        );

        addRelationship(
          personName,
          responsibility,
          "responsible_for",
          originalLine,
          0.95
        );
      }

      continue;
    }

    // Important decisions.
    if (
      section.includes("decision") ||
      section.includes("technology_choice")
    ) {
      addDecision(line);
      continue;
    }

    // Pending tasks, unfinished work and action items.
    if (
      section.includes("pending_task") ||
      section.includes("unfinished_task") ||
      section.includes("action_item") ||
      section === "tasks"
    ) {
      addTask(line, originalLine);
    }

    // Explicit dependency statements.
    const dependencyMatch = line.match(
      /^(.+?)\s+(?:depends on|is dependent on|requires)\s+(.+)$/i
    );

    if (dependencyMatch) {
      const source = addTask(
        dependencyMatch[1],
        originalLine
      );

      const target = addTask(
        dependencyMatch[2],
        originalLine
      );

      addRelationship(
        source,
        target,
        "depends_on",
        originalLine,
        0.98
      );
    }

    // Explicit responsibility statements.
    const responsibilityMatch = line.match(
      /^(.+?)\s+(?:is responsible for|owns|handles)\s+(.+)$/i
    );

    if (responsibilityMatch) {
      const person = addEntity(
        "person",
        responsibilityMatch[1],
        "Person explicitly assigned a responsibility.",
        originalLine,
        0.9
      );

      const task = addTask(
        responsibilityMatch[2],
        originalLine
      );

      addRelationship(
        person,
        task,
        "responsible_for",
        originalLine,
        0.95
      );
    }

    // Detect technology decisions written outside a decision section.
    if (
      /\b(?:uses|selected|selects|chosen|adopted|adopts)\s+[A-Za-z][A-Za-z0-9.+#_-]*/i.test(line)
    ) {
      addDecision(line);
    }

    // Identify explicitly unfinished tasks outside task headings.
    if (
      /\b(?:unfinished|incomplete|pending|not completed|still needs|not finished)\b/i.test(line)
      && !section.includes("pending_task")
      && section !== "tasks"
    ) {
      addTask(
        line.replace(
          /\s+(?:is|are)\s+(?:unfinished|incomplete|pending|not completed)\.?$/i,
          ""
        ),
        originalLine
      );
    }

    // Collect explicit documentation and ownership gaps.
    if (
      /\b(?:undocumented|not documented|missing documentation|no backup owner|no alternative owner|unassigned|unknown owner|unclear ownership|no documented owner)\b/i.test(line)
    ) {
      knowledgeGaps.add(line);
    }
  }

  // Add a document entity so the graph can connect
  // extracted knowledge back to its source.
  const documentName = title || originalFilename || "Source document";

  addEntity(
    "document",
    documentName,
    `Original source: ${originalFilename || documentName}`,
    `Source document: ${documentName}`,
    1
  );

  // Build explicit source-document relationships.
  const documentRelationships = [];

  for (const entity of entities.values()) {
    if (entity.type !== "document") {
      documentRelationships.push({
        source: entity.name,
        target: documentName,
        type: "documented_in",
        evidence_excerpt: entity.evidence_excerpt,
        confidence: entity.confidence,
      });
    }
  }

  // Create a transparent gap when an open task has no
  // explicitly identified owner in this document.
  const assignedTasks = new Set(
    [...relationships.values()]
      .filter((item) => item.type === "responsible_for")
      .map((item) => item.target.toLowerCase())
  );

  for (const entity of entities.values()) {
    if (
      entity.type === "task" &&
      !assignedTasks.has(entity.name.toLowerCase())
    ) {
      knowledgeGaps.add(
        `No explicit owner was identified for the task "${entity.name}".`
      );
    }
  }

  const peopleCount = [...entities.values()].filter(
    (item) => item.type === "person"
  ).length;

  const taskCount = [...entities.values()].filter(
    (item) => item.type === "task"
  ).length;

  const decisionCount = [...entities.values()].filter(
    (item) => item.type === "decision"
  ).length;

  const summary =
    `Local rule-based analysis of ${projectName || documentName}. ` +
    `Identified ${peopleCount} people, ${taskCount} tasks, ` +
    `${decisionCount} decisions and ${relationships.size + documentRelationships.length} relationships. ` +
    `This result was generated without an external AI model.`;

  return {
    summary,
    entities: [...entities.values()],
    relationships: [
      ...relationships.values(),
      ...documentRelationships,
    ],
    knowledge_gaps: [...knowledgeGaps],
  };
}
