"use client";

import { useEffect, useState, useCallback } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { getSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  Users,
  LogOut,
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  DollarSign,
  Phone,
  Mail,
  Calendar,
  LayoutGrid,
  List,
  Send,
  Check,
  X,
  UserPlus,
} from "lucide-react";

const EMPTY_FORM = { first_name: "", last_name: "", email: "", phone: "", budget: "", appointment_date: "" };

type LeadStatus = "new" | "booked" | "archived";
type ViewMode = "table" | "kanban";
type SortDir = "asc" | "desc";

interface Lead {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  appointment_date: string;
  budget: string;
  fb_leadgen_id: string;
  fb_page_id: string;
  status: LeadStatus;
}

type SortKey = keyof Lead;

interface TokenStatus {
  status: "valid" | "expiring_soon" | "expired" | "missing" | "unknown";
  expires?: string | null;
  daysLeft?: number;
}

const COLUMNS: { id: LeadStatus; label: string; bg: string; border: string; badge: string }[] = [
  { id: "new", label: "New", bg: "bg-blue-50", border: "border-blue-200", badge: "bg-blue-100 text-blue-700" },
  { id: "booked", label: "Booked", bg: "bg-green-50", border: "border-green-200", badge: "bg-green-100 text-green-700" },
  { id: "archived", label: "Archived", bg: "bg-gray-50", border: "border-gray-200", badge: "bg-gray-100 text-gray-600" },
];

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  booked: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-600",
};

export default function AdminDashboard() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filtered, setFiltered] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [view, setView] = useState<ViewMode>("table");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, "ok" | "error">>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [addingLead, setAddingLead] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getSupabase()
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setLeads(data ?? []);
      setFiltered(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/");
      else {
        fetchLeads();
        fetch("/api/token-status").then((r) => r.json()).then(setTokenStatus).catch(() => {});
      }
    });
  }, [fetchLeads, router]);

  useEffect(() => {
    const term = search.toLowerCase();
    const result = leads.filter(
      (l) =>
        l.first_name?.toLowerCase().includes(term) ||
        l.last_name?.toLowerCase().includes(term) ||
        l.email?.toLowerCase().includes(term) ||
        l.phone?.includes(term) ||
        l.budget?.toLowerCase().includes(term)
    );
    setFiltered(result);
  }, [search, leads]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  async function handleAddLead(e: React.FormEvent) {
    e.preventDefault();
    setAddingLead(true);
    setAddError(null);
    try {
      const { data: { session } } = await getSupabase().auth.getSession();
      if (!session) { setAddError("Not authenticated"); return; }

      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(addForm),
      });
      const json = await res.json();
      if (!res.ok) { setAddError(json.error || "Failed to add lead"); return; }

      setShowAddModal(false);
      setAddForm(EMPTY_FORM);
      await fetchLeads();
    } catch {
      setAddError("Something went wrong. Please try again.");
    } finally {
      setAddingLead(false);
    }
  }

  async function syncToMoosend(id: string) {
    setSyncingId(id);
    try {
      const res = await fetch("/api/leads/sync-moosend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setSyncResults((prev) => ({ ...prev, [id]: res.ok ? "ok" : "error" }));
    } catch {
      setSyncResults((prev) => ({ ...prev, [id]: "error" }));
    } finally {
      setSyncingId(null);
      setTimeout(
        () => setSyncResults((prev) => { const next = { ...prev }; delete next[id]; return next; }),
        3000
      );
    }
  }

  async function handleLogout() {
    await getSupabase().auth.signOut();
    router.push("/");
  }

  async function updateLeadStatus(id: string, status: LeadStatus) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    const { error } = await getSupabase().from("leads").update({ status }).eq("id", id);
    if (error) {
      console.error("Status update failed:", error);
      fetchLeads();
    }
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId as LeadStatus;
    if (result.source.droppableId !== newStatus) {
      updateLeadStatus(result.draggableId, newStatus);
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (col !== sortKey) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1" />
    );
  }

  function formatDate(val: string) {
    if (!val) return "—";
    const d = new Date(val);
    return isNaN(d.getTime()) ? val : d.toLocaleDateString();
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-blue-600 text-white p-2 rounded-lg shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">Lead Flow Admin</h1>
            <p className="text-xs text-gray-500 hidden sm:block">Facebook Lead Ad Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setView("table")} className={`p-1.5 rounded-md transition-colors ${view === "table" ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`} title="Table view">
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setView("kanban")} className={`p-1.5 rounded-md transition-colors ${view === "kanban" ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`} title="Kanban view">
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => { setAddForm(EMPTY_FORM); setAddError(null); setShowAddModal(true); }}
            className="flex items-center gap-1.5 text-sm font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Lead</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-7xl mx-auto w-full">
        {tokenStatus && tokenStatus.status !== "valid" && (
          <div className={`mb-6 rounded-lg p-4 border ${
            tokenStatus.status === "expired" || tokenStatus.status === "missing"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-yellow-50 border-yellow-200 text-yellow-800"
          }`}>
            <div className="font-semibold mb-1">
              {tokenStatus.status === "expired" || tokenStatus.status === "missing"
                ? "⚠️ Facebook Page Token Expired — Leads are not being received"
                : `⚠️ Facebook Page Token Expiring in ${tokenStatus.daysLeft} day(s)`}
            </div>
            <div className="text-sm">
              To refresh: go to{" "}
              <a href="https://developers.facebook.com/tools/explorer" target="_blank" className="underline font-medium">Graph API Explorer</a>
              {" "}→ select <strong>Wedding Lead Flow</strong> app → add permissions{" "}
              <code className="bg-white/60 px-1 rounded break-all">pages_show_list</code>,{" "}
              <code className="bg-white/60 px-1 rounded break-all">pages_read_engagement</code>,{" "}
              <code className="bg-white/60 px-1 rounded break-all">leads_retrieval</code>,{" "}
              <code className="bg-white/60 px-1 rounded break-all">pages_manage_metadata</code>{" "}
              → Generate Access Token → run{" "}
              <code className="bg-white/60 px-1 rounded break-all">1636980056352348?fields=access_token</code>{" "}
              → copy the <code className="bg-white/60 px-1 rounded break-all">access_token</code> value → update{" "}
              <strong>FB_PAGE_ACCESS_TOKEN</strong> in{" "}
              <a href="https://vercel.com/dashboard" target="_blank" className="underline font-medium">Vercel</a>{" "}
              → Redeploy.
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          <StatCard icon={<Users className="w-5 h-5 text-blue-600" />} label="Total" value={leads.length} />
          <StatCard icon={<Calendar className="w-5 h-5 text-green-600" />} label="This Month" value={leads.filter((l) => { const d = new Date(l.created_at); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length} />
          <StatCard icon={<DollarSign className="w-5 h-5 text-purple-600" />} label="Booked" value={leads.filter((l) => l.status === "booked").length} />
        </div>

        {view === "table" ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button onClick={fetchLeads} className="p-2 text-gray-500 hover:text-blue-600 border border-gray-200 rounded-lg transition-colors" title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {loading ? (
              <div className="py-20 text-center text-gray-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading leads...
              </div>
            ) : sorted.length === 0 ? (
              <div className="py-20 text-center text-gray-400">No leads found.</div>
            ) : (
              <>
                {/* Mobile card layout */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {sorted.map((lead) => (
                    <div key={lead.id} className="px-4 py-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-gray-900 text-sm leading-tight">
                          {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown"}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400">{formatDate(lead.created_at)}</span>
                          <select
                            value={lead.status ?? "new"}
                            onChange={(e) => updateLeadStatus(lead.id, e.target.value as LeadStatus)}
                            className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${STATUS_STYLES[lead.status ?? "new"]}`}
                          >
                            <option value="new">New</option>
                            <option value="booked">Booked</option>
                            <option value="archived">Archived</option>
                          </select>
                        </div>
                      </div>
                      <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-blue-600 text-sm">
                        <Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{lead.email}</span>
                      </a>
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-gray-600 text-sm">
                          <Phone className="w-3.5 h-3.5 shrink-0" />{lead.phone}
                        </a>
                      )}
                      {(lead.appointment_date || lead.budget) && (
                        <div className="flex items-center gap-3 pt-0.5">
                          {lead.appointment_date && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Calendar className="w-3 h-3" />{formatDate(lead.appointment_date)}
                            </span>
                          )}
                          {lead.budget && (
                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                              <DollarSign className="w-3 h-3" />{lead.budget}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="pt-1">
                        <SyncButton id={lead.id} syncingId={syncingId} syncResults={syncResults} onSync={syncToMoosend} />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table layout */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {(
                          [
                            ["created_at", "Submitted"],
                            ["first_name", "First Name"],
                            ["last_name", "Last Name"],
                            ["email", "Email"],
                            ["phone", "Phone"],
                            ["appointment_date", "Appt. Date"],
                            ["budget", "Budget"],
                          ] as [SortKey, string][]
                        ).map(([key, label]) => (
                          <th key={key} className="px-4 py-3 cursor-pointer hover:text-gray-700 whitespace-nowrap" onClick={() => handleSort(key)}>
                            {label}<SortIcon col={key} />
                          </th>
                        ))}
                        <th className="px-4 py-3 whitespace-nowrap">Status</th>
                        <th className="px-4 py-3 whitespace-nowrap">Moosend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sorted.map((lead) => (
                        <tr key={lead.id} className="hover:bg-blue-50 transition-colors">
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(lead.created_at)}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{lead.first_name}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{lead.last_name}</td>
                          <td className="px-4 py-3">
                            <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                              <Mail className="w-3 h-3" />{lead.email}
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-gray-700 hover:text-blue-600">
                              <Phone className="w-3 h-3" />{lead.phone || "—"}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(lead.appointment_date)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">
                              <DollarSign className="w-3 h-3" />{lead.budget || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={lead.status ?? "new"}
                              onChange={(e) => updateLeadStatus(lead.id, e.target.value as LeadStatus)}
                              className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${STATUS_STYLES[lead.status ?? "new"]}`}
                            >
                              <option value="new">New</option>
                              <option value="booked">Booked</option>
                              <option value="archived">Archived</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <SyncButton id={lead.id} syncingId={syncingId} syncResults={syncResults} onSync={syncToMoosend} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        ) : loading ? (
          <div className="py-20 text-center text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading leads...
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {COLUMNS.map((col) => {
                const colLeads = leads.filter((l) => (l.status ?? "new") === col.id);
                return (
                  <div key={col.id} className={`rounded-xl border ${col.border} ${col.bg} flex flex-col min-h-64`}>
                    <div className="px-4 py-3 border-b border-black/10 flex items-center justify-between">
                      <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${col.badge}`}>
                        {col.label}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">{colLeads.length} leads</span>
                    </div>
                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 p-3 space-y-2 transition-colors rounded-b-xl ${snapshot.isDraggingOver ? "bg-white/50" : ""}`}
                        >
                          {colLeads.map((lead, index) => (
                            <Draggable key={lead.id} draggableId={lead.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`bg-white rounded-lg border border-gray-200 p-3 shadow-sm space-y-1.5 select-none transition-shadow ${snapshot.isDragging ? "shadow-lg rotate-1 border-blue-300" : "hover:shadow-md"}`}
                                >
                                  <div className="font-semibold text-sm text-gray-900">
                                    {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown"}
                                  </div>
                                  <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-blue-600 text-xs hover:underline">
                                    <Mail className="w-3 h-3 shrink-0" /><span className="truncate">{lead.email}</span>
                                  </a>
                                  {lead.phone && (
                                    <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-gray-600 text-xs">
                                      <Phone className="w-3 h-3 shrink-0" />{lead.phone}
                                    </a>
                                  )}
                                  <div className="flex items-center justify-between pt-0.5">
                                    <span className="text-xs text-gray-400">{formatDate(lead.created_at)}</span>
                                    {lead.budget && (
                                      <span className="inline-flex items-center gap-0.5 bg-green-100 text-green-800 text-xs px-1.5 py-0.5 rounded-full">
                                        <DollarSign className="w-2.5 h-2.5" />{lead.budget}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {colLeads.length === 0 && !snapshot.isDraggingOver && (
                            <p className="text-xs text-gray-400 text-center pt-4">Drop leads here</p>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </main>

      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Add Lead</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddLead} className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={addForm.first_name}
                    onChange={(e) => setAddForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={addForm.last_name}
                    onChange={(e) => setAddForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Budget</label>
                <input
                  type="text"
                  placeholder="e.g. $5,000–$10,000"
                  value={addForm.budget}
                  onChange={(e) => setAddForm((f) => ({ ...f, budget: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Appointment Date</label>
                <input
                  type="date"
                  value={addForm.appointment_date}
                  onChange={(e) => setAddForm((f) => ({ ...f, appointment_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {addError && <p className="text-sm text-red-600">{addError}</p>}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingLead}
                  className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {addingLead ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {addingLead ? "Adding..." : "Add Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SyncButton({
  id,
  syncingId,
  syncResults,
  onSync,
}: {
  id: string;
  syncingId: string | null;
  syncResults: Record<string, "ok" | "error">;
  onSync: (id: string) => void;
}) {
  const isSyncing = syncingId === id;
  const result = syncResults[id];
  return (
    <button
      onClick={() => onSync(id)}
      disabled={isSyncing || syncingId !== null}
      title="Sync to Moosend"
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50
        ${result === "ok" ? "border-green-300 bg-green-50 text-green-700" :
          result === "error" ? "border-red-300 bg-red-50 text-red-700" :
          "border-gray-200 bg-white text-gray-500 hover:text-blue-600 hover:border-blue-300"}`}
    >
      {isSyncing ? (
        <RefreshCw className="w-3 h-3 animate-spin" />
      ) : result === "ok" ? (
        <Check className="w-3 h-3" />
      ) : result === "error" ? (
        <X className="w-3 h-3" />
      ) : (
        <Send className="w-3 h-3" />
      )}
      {result === "ok" ? "Synced" : result === "error" ? "Failed" : "Sync"}
    </button>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-3 sm:px-6 sm:py-5 flex items-center gap-2 sm:gap-4">
      <div className="bg-gray-50 p-2 sm:p-3 rounded-lg hidden sm:block shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
