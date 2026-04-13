"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";

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
}

type SortKey = keyof Lead;
type SortDir = "asc" | "desc";

interface TokenStatus {
  status: "valid" | "expiring_soon" | "expired" | "missing" | "unknown";
  expires?: string | null;
  daysLeft?: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filtered, setFiltered] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);

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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={<Users className="w-5 h-5 text-blue-600" />}
            label="Total Leads"
            value={leads.length}
          />
          <StatCard
            icon={<Calendar className="w-5 h-5 text-green-600" />}
            label="This Month"
            value={
              leads.filter((l) => {
                const d = new Date(l.created_at);
                const now = new Date();
                return (
                  d.getMonth() === now.getMonth() &&
                  d.getFullYear() === now.getFullYear()
                );
              }).length
            }
          />
          <StatCard
            icon={<DollarSign className="w-5 h-5 text-purple-600" />}
            label="Showing"
            value={filtered.length}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
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
            <button
              onClick={fetchLeads}
              className="p-2 text-gray-500 hover:text-blue-600 border border-gray-200 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="py-20 text-center text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading leads...
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-20 text-center text-gray-400">
              No leads found.
            </div>
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
                    <div className="flex items-center gap-3 pt-1">
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
                        <th
                          key={key}
                          className="px-4 py-3 cursor-pointer hover:text-gray-700 whitespace-nowrap"
                          onClick={() => handleSort(key)}
                        >
                          {label}
                          <SortIcon col={key} />
                        </th>
                      ))}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
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
