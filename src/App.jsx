
import { useEffect, useState } from "react";

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Clock3,
  Database,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Network,
  Plus,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";

import "./App.css";

import AuthScreen from "./components/AuthScreen";
import OrganizationSetup from "./components/OrganizationSetup";
import KnowledgeVault from "./components/KnowledgeVault";
import KnowledgeGraph from "./components/KnowledgeGraph";

import { supabase } from "./lib/supabaseClient";

// ------------------------------------------
// NAVIGATION
// ------------------------------------------

const navigation = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    section: "WORKSPACE",
  },
  {
    id: "vault",
    label: "Knowledge Vault",
    icon: FolderOpen,
    section: "WORKSPACE",
  },
  {
    id: "graph",
    label: "Knowledge Graph",
    icon: Network,
    section: "INTELLIGENCE",
  },
  {
    id: "simulator",
    label: "Impact Simulator",
    icon: ShieldAlert,
    section: "INTELLIGENCE",
  },
  {
    id: "continuity",
    label: "Continuity Packs",
    icon: FileText,
    section: "MANAGEMENT",
  },
  {
    id: "team",
    label: "Team & Ownership",
    icon: Users,
    section: "MANAGEMENT",
  },
];

// ------------------------------------------
// MODULE DETAILS
// ------------------------------------------

const moduleDetails = {
  simulator: {
    title: "Departure Impact Simulator",
    description:
      "Understand which responsibilities and knowledge areas may be affected when someone becomes unavailable.",
    next:
      "Evidence-based impact analysis and recovery recommendations.",
    icon: ShieldAlert,
  },

  continuity: {
    title: "Continuity Packs",
    description:
      "Create structured, evidence-linked handover reports for incoming team members.",
    next:
      "Reviewed continuity reports and downloadable PDFs.",
    icon: FileText,
  },

  team: {
    title: "Team & Ownership",
    description:
      "Understand who owns important knowledge, processes and operational responsibilities.",
    next:
      "Team profiles, ownership and backup assignments.",
    icon: Users,
  },
};

// ------------------------------------------
// SIDEBAR
// ------------------------------------------

function Sidebar({
  activePage,
  setActivePage,
  workspaceName,
  userName,
  onSignOut,
}) {
  const sections = [
    "WORKSPACE",
    "INTELLIGENCE",
    "MANAGEMENT",
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-symbol">L</div>

        <div>
          <div className="brand-name">
            LOOM<span>.</span>
          </div>

          <div className="brand-caption">
            KNOWLEDGE CONTINUITY
          </div>
        </div>
      </div>

      <div className="workspace-selector">
        <div className="workspace-avatar">
          {(workspaceName || "L").charAt(0).toUpperCase()}
        </div>

        <div className="workspace-info">
          <strong>{workspaceName || "Your organisation"}</strong>
          <span>Organisation workspace</span>
        </div>

        <ChevronRight size={15} />
      </div>

      <nav className="navigation">
        {sections.map((section) => (
          <div className="nav-section" key={section}>
            <div className="nav-heading">{section}</div>

            {navigation
              .filter((item) => item.section === section)
              .map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-link ${
                      activePage === item.id ? "active" : ""
                    }`}
                    onClick={() => setActivePage(item.id)}
                  >
                    <Icon size={18} strokeWidth={1.8} />

                    <span>{item.label}</span>

                    {item.id === "overview" && (
                      <span className="nav-active-dot" />
                    )}
                  </button>
                );
              })}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="privacy-note">
          <LockKeyhole size={16} />

          <div>
            <strong>Knowledge stays protected</strong>
            <span>Permission-aware by design</span>
          </div>
        </div>

        <div className="profile">
          <div className="profile-avatar">
            {(userName || "U").charAt(0).toUpperCase()}
          </div>

          <div className="profile-info">
            <strong>{userName || "LOOM User"}</strong>
            <span>Organisation member</span>
          </div>

          <button
            type="button"
            className="profile-help"
            title="Sign out"
            aria-label="Sign out"
            onClick={onSignOut}
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ------------------------------------------
// TOPBAR
// ------------------------------------------

function Topbar({ activePage, userName }) {
  const current = navigation.find(
    (item) => item.id === activePage
  );

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>LOOM</span>
        <ChevronRight size={14} />
        <strong>{current?.label || "Overview"}</strong>
      </div>

      <div className="topbar-right">
        <div className="environment-label">
          <span className="environment-dot" />
          LOCAL DEVELOPMENT
        </div>

        <div className="topbar-avatar" title={userName}>
          {(userName || "U").charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}

// ------------------------------------------
// STATISTIC CARD
// ------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  description,
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-icon">
          <Icon size={19} />
        </div>

        <span className="stat-period">CURRENT</span>
      </div>

      <div className="stat-value">{value}</div>

      <div className="stat-label">{label}</div>

      <div className="stat-description">{description}</div>
    </div>
  );
}

// ------------------------------------------
// OVERVIEW DASHBOARD
// ------------------------------------------


function Overview({ setActivePage, organizationId }) {
  const [stats, setStats] = useState({
    documents: 0,
    people: 0,
    relationships: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const [
          documentResult,
          entityResult,
          relationshipResult,
        ] = await Promise.all([
          supabase
            .from("knowledge_documents")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId),

          supabase
            .from("knowledge_entities")
            .select("entity_type")
            .eq("organization_id", organizationId)
            .eq("verification_status", "approved"),

          supabase
            .from("knowledge_relationships")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId),
        ]);

        if (documentResult.error) throw documentResult.error;
        if (entityResult.error) throw entityResult.error;
        if (relationshipResult.error) throw relationshipResult.error;

        const people = (entityResult.data || []).filter(
          (item) =>
            item.entity_type === "person" ||
            item.entity_type === "team"
        ).length;

        if (!cancelled) {
          setStats({
            documents: documentResult.count || 0,
            people,
            relationships: relationshipResult.count || 0,
            loading: false,
          });
        }
      } catch (error) {
        console.error("Dashboard statistics:", error);

        if (!cancelled) {
          setStats((previous) => ({
            ...previous,
            loading: false,
          }));
        }
      }
    }

    loadStats();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const statCards = [
    {
      icon: BookOpen,
      label: "Knowledge documents",
      value: stats.loading ? "..." : stats.documents,
      description: "Stored organisational documents",
    },
    {
      icon: Users,
      label: "People mapped",
      value: stats.loading ? "..." : stats.people,
      description: "Approved people and teams",
    },
    {
      icon: ShieldAlert,
      label: "Knowledge gaps",
      value: "Not tracked",
      description: "Gap records are not yet persisted",
    },
    {
      icon: Network,
      label: "Knowledge relationships",
      value: stats.loading ? "..." : stats.relationships,
      description: "Saved organisational connections",
    },
  ];

  return (
    <>
      <section className="welcome-section">
        <div>
          <div className="eyebrow">
            <Sparkles size={14} />
            ORGANISATIONAL INTELLIGENCE
          </div>
          <h1>Understand what your organisation knows.</h1>
          <p>
            Connect people, decisions and processes to preserve
            the knowledge that keeps your organisation moving.
          </p>
        </div>

        <button
          className="primary-button"
          type="button"
          onClick={() => setActivePage("vault")}
        >
          <Plus size={17} />
          Add knowledge
        </button>
      </section>

      <section className="workspace-status">
        <div className="status-icon">
          <Database size={21} />
        </div>
        <div className="status-copy">
          <strong>Your workspace is building its knowledge system.</strong>
          <span>
            Your uploaded documents and approved knowledge
            are available to explore.
          </span>
        </div>
        <span className="status-badge">ACTIVE WORKSPACE</span>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>Knowledge overview</h2>
            <p>Live records from your organisation</p>
          </div>
          <span className="live-indicator">
            <span /> CURRENT STATE
          </span>
        </div>

        <div className="stats-grid">
          {statCards.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      </section>

      <section className="lower-grid">
        <div className="panel setup-panel">
          <div className="panel-heading">
            <div>
              <h2>Get started with LOOM</h2>
              <p>Your knowledge continuity journey</p>
            </div>
            <div className="panel-heading-icon">
              <Activity size={19} />
            </div>
          </div>

          <div className="setup-list">
            <div className="setup-item">
              <div className="setup-number">01</div>
              <div className="setup-text">
                <strong>Add your knowledge sources</strong>
                <span>Upload organisational project documents.</span>
              </div>
              <span className="setup-state">AVAILABLE</span>
            </div>

            <div className="setup-item">
              <div className="setup-number">02</div>
              <div className="setup-text">
                <strong>Extract organisational knowledge</strong>
                <span>Identify people, decisions and responsibilities.</span>
              </div>
              <span className="setup-state">AVAILABLE</span>
            </div>

            <div className="setup-item">
              <div className="setup-number">03</div>
              <div className="setup-text">
                <strong>Explore knowledge relationships</strong>
                <span>View connected organisational information.</span>
              </div>
              <span className="setup-state">AVAILABLE</span>
            </div>
          </div>

          <button
            className="text-button"
            type="button"
            onClick={() => setActivePage("graph")}
          >
            Explore knowledge graph <ArrowRight size={16} />
          </button>
        </div>

        <div className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent activity</h2>
              <p>Latest workspace events</p>
            </div>
            <Clock3 size={19} className="muted-icon" />
          </div>

          <div className="empty-activity">
            <div className="empty-activity-icon">
              <Clock3 size={22} />
            </div>
            <strong>Activity panel</strong>
            <span>
              Document and knowledge activity will appear here
              as the activity feed is connected.
            </span>
          </div>
        </div>
      </section>

      <section className="insight-banner">
        <div className="insight-symbol">
          <ShieldAlert size={22} />
        </div>
        <div className="insight-copy">
          <strong>Knowledge continuity starts with visibility.</strong>
          <span>
            LOOM helps identify critical knowledge dependencies
            before they become organisational risks.
          </span>
        </div>
        <ArrowUpRight size={19} className="insight-arrow" />
      </section>
    </>
  );
}


// ------------------------------------------
// MODULE PLACEHOLDER PAGES
// ------------------------------------------

function ModulePage({ page, setActivePage }) {
  const details = moduleDetails[page];

  if (!details) return null;

  const Icon = details.icon;

  return (
    <div className="module-page">
      <div className="module-icon">
        <Icon size={28} />
      </div>

      <div className="eyebrow">LOOM MODULE</div>

      <h1>{details.title}</h1>

      <p className="module-description">
        {details.description}
      </p>

      <div className="module-status">
        <span className="planned-dot" />
        MODULE IN DEVELOPMENT
      </div>

      <div className="module-next">
        <strong>Planned functionality</strong>
        <span>{details.next}</span>
      </div>

      <button
        className="secondary-button"
        type="button"
        onClick={() => setActivePage("overview")}
      >
        <ArrowRight size={16} />
        Return to overview
      </button>
    </div>
  );
}

// ------------------------------------------
// AUTHENTICATED DASHBOARD
// ------------------------------------------

function DashboardApp({
  workspaceName,
  organizationId,
  userId,
  userName,
  onSignOut,
}) {
  const [activePage, setActivePage] = useState("overview");

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        workspaceName={workspaceName}
        userName={userName}
        onSignOut={onSignOut}
      />

      <main className="main-area">
        <Topbar
          activePage={activePage}
          userName={userName}
        />

        <div className="page-content">
          {activePage === "overview" ? (
            <Overview
  setActivePage={setActivePage}
  organizationId={organizationId}
/>
          ) : activePage === "vault" ? (
            <KnowledgeVault
              organizationId={organizationId}
              userId={userId}
            />
          ) : activePage === "graph" ? (
            <KnowledgeGraph
              organizationId={organizationId}
            />
          ) : (
            <ModulePage
              page={activePage}
              setActivePage={setActivePage}
            />
          )}
        </div>

        <footer className="app-footer">
          <span>LOOM · Knowledge Continuity Platform</span>
          <span>Round 2 · Development prototype</span>
        </footer>
      </main>
    </div>
  );
}

// ------------------------------------------
// LOADING SCREEN
// ------------------------------------------

function AppLoading() {
  return (
    <main className="auth-screen">
      <section className="auth-form-area">
        <div className="auth-form-container">
          <div className="auth-logo">L</div>

          <h2>Preparing your workspace...</h2>

          <p>
            Please wait while LOOM securely loads your account.
          </p>
        </div>
      </section>
    </main>
  );
}

// ------------------------------------------
// ERROR SCREEN
// ------------------------------------------

function AppError({
  message,
  onRetry,
  onSignOut,
}) {
  return (
    <main className="org-setup-screen">
      <section className="org-setup-card">
        <div className="org-setup-icon">!</div>

        <h1>Couldn't load your workspace.</h1>

        <p className="org-setup-description">
          {message}
        </p>

        <button
          className="auth-submit"
          type="button"
          onClick={onRetry}
        >
          Try again
        </button>

        <button
          className="text-button"
          type="button"
          onClick={onSignOut}
        >
          Sign out
        </button>
      </section>
    </main>
  );
}

// ------------------------------------------
// MAIN APPLICATION
// ------------------------------------------

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [orgLoading, setOrgLoading] = useState(false);

  const [memberships, setMemberships] = useState([]);
  const [selectedOrganization, setSelectedOrganization] =
    useState(null);

  const [appError, setAppError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  // Restore and monitor the authenticated session.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setAuthReady(true);

        if (!newSession) {
          setMemberships([]);
          setSelectedOrganization(null);
          setAppError("");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Load profile and organisation membership.
  useEffect(() => {
    const user = session?.user;
    let cancelled = false;

    if (!user) {
      setMemberships([]);
      setSelectedOrganization(null);
      setOrgLoading(false);
      setAppError("");
      return;
    }

    async function loadWorkspace() {
      setOrgLoading(true);
      setAppError("");

      try {
        // Create or update the user's profile.
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              full_name:
                user.user_metadata?.full_name ||
                user.email?.split("@")[0] ||
                "LOOM User",
            },
            { onConflict: "id" }
          );

        if (profileError) throw profileError;

        // Retrieve organisation memberships.
        const {
          data: memberRows,
          error: membershipError,
        } = await supabase
          .from("organization_members")
          .select("organization_id, role")
          .eq("user_id", user.id);

        if (membershipError) throw membershipError;

        if (!memberRows || memberRows.length === 0) {
          if (!cancelled) {
            setMemberships([]);
            setSelectedOrganization(null);
          }

          return;
        }

        // Retrieve the corresponding organisations.
        const organizationIds = memberRows.map(
          (member) => member.organization_id
        );

        const {
          data: organizations,
          error: organizationError,
        } = await supabase
          .from("organizations")
          .select("id, name, created_at")
          .in("id", organizationIds);

        if (organizationError) throw organizationError;

        const organizationMap = new Map(
          (organizations || []).map((organization) => [
            organization.id,
            organization,
          ])
        );

        const validMemberships = memberRows
          .map((member) => ({
            ...member,
            organization: organizationMap.get(
              member.organization_id
            ),
          }))
          .filter((member) => member.organization);

        if (!cancelled) {
          setMemberships(validMemberships);

          setSelectedOrganization(
            validMemberships[0]?.organization || null
          );

          if (
            memberRows.length > 0 &&
            validMemberships.length === 0
          ) {
            setAppError(
              "Your organisation membership exists, but the organisation record could not be loaded."
            );
          }
        }
      } catch (error) {
        console.error(
          "LOOM workspace loading error:",
          error
        );

        if (!cancelled) {
          setAppError(
            error.message || "Unable to load your organisation."
          );
        }
      } finally {
        if (!cancelled) {
          setOrgLoading(false);
        }
      }
    }

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, refreshToken]);

  // Sign out.
  async function handleSignOut() {
    setAppError("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setAppError(error.message);
    }
  }

  // Wait for session restoration.
  if (!authReady) {
    return <AppLoading />;
  }

  // Show login or registration.
  if (!session?.user) {
    return <AuthScreen />;
  }

  // Wait for workspace data.
  if (orgLoading) {
    return <AppLoading />;
  }

  // Show loading errors.
  if (appError) {
    return (
      <AppError
        message={appError}
        onRetry={() =>
          setRefreshToken((value) => value + 1)
        }
        onSignOut={handleSignOut}
      />
    );
  }

  // Show organisation setup if the user has no membership.
  if (memberships.length === 0) {
    return (
      <OrganizationSetup
        user={session.user}
        onCreated={() =>
          setRefreshToken((value) => value + 1)
        }
        onSignOut={handleSignOut}
      />
    );
  }

  // Do not render the dashboard without a verified organisation.
  if (!selectedOrganization?.id) {
    return (
      <AppError
        message="No accessible organisation was found for this account."
        onRetry={() =>
          setRefreshToken((value) => value + 1)
        }
        onSignOut={handleSignOut}
      />
    );
  }

  // Open the authenticated LOOM dashboard.
  return (
    <DashboardApp
      workspaceName={
        selectedOrganization.name || "Your organisation"
      }
      organizationId={selectedOrganization.id}
      userId={session.user.id}
      userName={
        session.user.user_metadata?.full_name ||
        session.user.email?.split("@")[0] ||
        "LOOM User"
      }
      onSignOut={handleSignOut}
    />
  );
}
