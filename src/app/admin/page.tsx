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
} from "lucide-react";

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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Lead Flow Admin</h1>
            <p className="text-xs text-gray-500">Facebook Lead Ad Dashboard</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </header>

      <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-7xl mx-auto">
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
              <code className="bg-white/60 px-1 rounded">pages_show_list</code>,{" "}
              <code className="bg-white/60 px-1 rounded">pages_read_engagement</code>,{" "}
              <code className="bg-white/60 px-1 rounded">leads_retrieval</code>,{" "}
              <code className="bg-white/60 px-1 rounded">pages_manage_metadata</code>{" "}
              → Generate Access Token → run{" "}
              <code className="bg-white/60 px-1 rounded">1636980056352348?fields=access_token</code>{" "}
              → copy the <code className="bg-white/60 px-1 rounded">access_token</code> value → update{" "}
              <strong>FB_PAGE_ACCESS_TOKEN</strong> in{" "}
              <a href="https://vercel.com/dashboard" target="_blank" className="underline font-medium">Vercel</a>{" "}
              → Redeploy.
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-start gap-4 mb-6">
          <div className="grid grid-cols-3 gap-3 sm:gap-4 flex-1 min-w-0">
            <StatCard icon={<Users className="w-5 h-5 text-blue-600" />} label="Total" value={leads.length} />
            <StatCard icon={<Calendar className="w-5 h-5 text-green-600" />} label="This Month" value={leads.filter((l) => { const d = new Date(l.created_at); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length} />
            <StatCard icon={<DollarSign className="w-5 h-5 text-purple-600" />} label="Booked" value={leads.filter((l) => l.status === "booked").length} />
          </div>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm shrink-0">
            <button onClick={() => setView("table")} className={`p-2 rounded-md transition-colors ${view === "table" ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`} title="Table view">
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setView("kanban")} className={`p-2 rounded-md transition-colors ${view === "kanban" ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"}`} title="Kanban view">
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
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
                    <div key={lead.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">
                          {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(lead.created_at)}</span>
                      </div>
                      <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-blue-600 text-sm">
                        <Mail className="w-3 h-3" />{lead.email}
                      </a>
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-gray-700 text-sm">
                          <Phone className="w-3 h-3" />{lead.phone}
                        </a>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
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
    </div>
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5 flex items-center gap-4">
      <div className="bg-gray-50 p-3 rounded-lg">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
