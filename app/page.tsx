"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MaintenanceStatus = "Done" | "Repairing" | "Pending";

type HistoryItem = {
  id: number;
  date: string;
  line: string;
  equipmentSet: string;
  problem: string;
  technician: string;
  status: MaintenanceStatus;
  downtime: number;
  priority: "Low" | "Medium" | "High";
};

type PmItem = {
  line: string;
  equipmentSet: string;
  last: string;
  next: string;
  owner: string;
};

type LineLayout = {
  line: string;
  lineName: string;
  machines: string[];
};

const initialLineLayouts: LineLayout[] = [];
const initialHistory: HistoryItem[] = [];
const initialPmList: PmItem[] = [];

const chartColors = ["#14b8a6", "#38bdf8", "#f97316", "#f43f5e", "#a78bfa", "#84cc16"];
const technicians = ["Maintenance Team"];
const machineOptions = ["Printer", "SPI", "Mounter", "Reflow", "AOI", "Loader", "Unloader", "Conveyor", "Buffer", "NG Buffer"];

function daysBetween(targetDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(date: string, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next.toISOString().split("T")[0];
}

function machinesToText(machines: string[]) {
  return machines.map((machine) => machine.trim()).filter(Boolean).join(" + ");
}

function statusClass(status: MaintenanceStatus) {
  if (status === "Done") return "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30";
  if (status === "Repairing") return "bg-amber-500/15 text-amber-200 ring-amber-400/30";
  return "bg-rose-500/15 text-rose-200 ring-rose-400/30";
}

function priorityClass(priority: HistoryItem["priority"]) {
  if (priority === "High") return "bg-rose-500/15 text-rose-200";
  if (priority === "Medium") return "bg-amber-500/15 text-amber-200";
  return "bg-sky-500/15 text-sky-200";
}

export default function Home() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<"dashboard" | "layout">("dashboard");
  const [storageReady, setStorageReady] = useState(false);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [lineLayouts, setLineLayouts] = useState<LineLayout[]>(initialLineLayouts);
  const [historyData, setHistoryData] = useState<HistoryItem[]>(initialHistory);
  const [pmList, setPmList] = useState<PmItem[]>(initialPmList);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | MaintenanceStatus>("All");
  const [layoutForm, setLayoutForm] = useState({
    line: "",
    lineName: "",
    lastPmDate: "",
    machines: [] as string[],
    customMachine: "",
  });
  const [formData, setFormData] = useState({
    date: "",
    line: "",
    equipmentSet: "",
    problem: "Full Line Preventive Maintenance",
    technician: "Maintenance Team",
    status: "Done" as MaintenanceStatus,
    downtime: 0,
    priority: "Medium" as HistoryItem["priority"],
  });

  useEffect(() => {
    const login = localStorage.getItem("login");

    if (login !== "true") {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    const savedLayouts = localStorage.getItem("smt-line-layouts-v2");
    const savedPmList = localStorage.getItem("smt-pm-list-v2");
    const savedHistory = localStorage.getItem("smt-maintenance-history-v2");

    if (savedLayouts) {
      setLineLayouts(JSON.parse(savedLayouts));
    }

    if (savedPmList) {
      setPmList(JSON.parse(savedPmList));
    }

    if (savedHistory) {
      setHistoryData(JSON.parse(savedHistory));
    }

    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem("smt-line-layouts-v2", JSON.stringify(lineLayouts));
  }, [lineLayouts, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem("smt-pm-list-v2", JSON.stringify(pmList));
  }, [pmList, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem("smt-maintenance-history-v2", JSON.stringify(historyData));
  }, [historyData, storageReady]);

  const activeLines = useMemo(() => lineLayouts.map((layout) => layout.line), [lineLayouts]);

  const getEquipmentSet = (line: string) => {
    const layout = lineLayouts.find((item) => item.line === line);
    return layout ? machinesToText(layout.machines) : "";
  };

  useEffect(() => {
    if (!formData.line && activeLines[0]) {
      setFormData((current) => ({
        ...current,
        line: activeLines[0],
        equipmentSet: getEquipmentSet(activeLines[0]),
      }));
    }
  }, [activeLines, formData.line, lineLayouts]);

  const getPmRecord = (line: string) => pmList.find((item) => item.line === line);

  const pmData = useMemo(
    () =>
      pmList
        .map((item) => ({
          ...item,
          equipmentSet: getEquipmentSet(item.line),
          remaining: daysBetween(item.next),
        }))
        .sort((a, b) => a.remaining - b.remaining),
    [pmList, lineLayouts],
  );

  const lineSummary = useMemo(() => {
    const initialGrouped = lineLayouts.reduce<Record<string, { line: string; count: number; downtime: number }>>((acc, layout) => {
      acc[layout.line] = {
        line: layout.line,
        count: 0,
        downtime: 0,
      };
      return acc;
    }, {});

    const grouped = historyData.reduce<Record<string, { line: string; count: number; downtime: number }>>(
      (acc, item) => {
        if (!acc[item.line]) {
          acc[item.line] = {
            line: item.line,
            count: 0,
            downtime: 0,
          };
        }

        acc[item.line].count += 1;
        acc[item.line].downtime += item.downtime;
        return acc;
      },
      initialGrouped,
    );

    return Object.values(grouped).sort((a, b) => b.count - a.count);
  }, [historyData, lineLayouts]);

  const filteredHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return historyData.filter((item) => {
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        [item.date, item.line, item.equipmentSet, item.problem, item.technician, item.priority]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [historyData, query, statusFilter]);

  const detailData = selectedLine ? historyData.filter((item) => item.line === selectedLine) : [];
  const totalDowntime = historyData.reduce((sum, item) => sum + item.downtime, 0);
  const completedCount = historyData.filter((item) => item.status === "Done").length;
  const urgentPmCount = pmData.filter((item) => item.remaining <= 3).length;
  const openJobs = historyData.filter((item) => item.status !== "Done").length;

  const updateLayoutLine = (value: string) => {
    const nextLine = value.toUpperCase();
    const currentAutoName = layoutForm.line ? `SMT Line ${layoutForm.line}` : "";
    const shouldAutoName = !layoutForm.lineName || layoutForm.lineName === currentAutoName;

    setLayoutForm({
      ...layoutForm,
      line: nextLine,
      lineName: shouldAutoName ? `SMT Line ${nextLine}` : layoutForm.lineName,
    });
  };

  const addLayoutMachine = (machine: string) => {
    const trimmedMachine = machine.trim();

    if (!trimmedMachine) return;

    if (trimmedMachine === "Mounter") {
      const nextMounterNumber = layoutForm.machines.filter((item) => item.startsWith("Mounter")).length + 1;
      setLayoutForm({
        ...layoutForm,
        machines: [...layoutForm.machines, `Mounter ${nextMounterNumber}`],
      });
      return;
    }

    setLayoutForm({
      ...layoutForm,
      machines: [...layoutForm.machines, trimmedMachine],
      customMachine: "",
    });
  };

  const removeLayoutMachine = (index: number) => {
    setLayoutForm({
      ...layoutForm,
      machines: layoutForm.machines.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const moveLayoutMachine = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= layoutForm.machines.length) return;

    const machines = [...layoutForm.machines];
    [machines[index], machines[targetIndex]] = [machines[targetIndex], machines[index]];

    setLayoutForm({
      ...layoutForm,
      machines,
    });
  };

  const saveLineLayout = () => {
    const line = layoutForm.line.trim().toUpperCase();
    const lineName = layoutForm.lineName.trim() || `SMT Line ${line}`;
    const machines = layoutForm.machines.map((machine) => machine.trim()).filter(Boolean);
    const lastPmDate = layoutForm.lastPmDate;
    const nextPmDate = lastPmDate ? addDays(lastPmDate, 15) : addDays(new Date().toISOString().split("T")[0], 15);

    if (!line || machines.length === 0) {
      alert("Please enter line and machines");
      return;
    }

    const equipmentSet = machinesToText(machines);

    setLineLayouts((current) => {
      const exists = current.some((item) => item.line === line);
      const nextLayout = { line, lineName, machines };

      return exists
        ? current.map((item) => (item.line === line ? nextLayout : item))
        : [...current, nextLayout].sort((a, b) => a.line.localeCompare(b.line));
    });

    setPmList((current) => {
      const exists = current.some((item) => item.line === line);

      if (exists) {
        return current.map((item) =>
          item.line === line
            ? {
                ...item,
                equipmentSet,
                last: lastPmDate || item.last,
                next: lastPmDate ? nextPmDate : item.next,
              }
            : item,
        );
      }

      return [
        ...current,
        {
          line,
          equipmentSet,
          last: lastPmDate,
          next: nextPmDate,
          owner: "Maintenance Team",
        },
      ].sort((a, b) => a.line.localeCompare(b.line));
    });

    setFormData((current) =>
      !current.line || current.line === line
        ? {
            ...current,
            line,
            equipmentSet,
          }
        : current,
    );

    setLayoutForm({
      line: "",
      lineName: "",
      lastPmDate: "",
      machines: [],
      customMachine: "",
    });
  };

  const saveMaintenanceRecord = () => {
    if (!formData.line) {
      alert("Please add line layout first");
      return;
    }

    if (!formData.date) {
      alert("Please select date");
      return;
    }

    const newRecord: HistoryItem = {
      id: Date.now(),
      ...formData,
      downtime: Number(formData.downtime) || 0,
    };

    setHistoryData((current) => [newRecord, ...current]);

    setPmList((current) =>
      current.map((item) =>
        item.line === formData.line
          ? {
              ...item,
              last: formData.date,
              next: addDays(formData.date, 15),
              owner: formData.technician,
            }
          : item,
      ),
    );

    setFormData({
      date: "",
      line: activeLines[0] || "",
      equipmentSet: activeLines[0] ? getEquipmentSet(activeLines[0]) : "",
      problem: "Full Line Preventive Maintenance",
      technician: "Maintenance Team",
      status: "Done",
      downtime: 0,
      priority: "Medium",
    });
  };

  return (
    <main className="min-h-screen bg-[#08111f] text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 shadow-2xl shadow-cyan-950/30">
          <div className="relative grid gap-8 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.26),transparent_34%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.22),transparent_30%)] p-6 md:grid-cols-[1.3fr_0.7fr] md:p-8">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-100">
                <Sparkles className="h-4 w-4" />
                SMT Factory Maintenance Command Center
              </div>

              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
                {activeView === "dashboard" ? "SMT Maintenance Dashboard" : "Line Layout Setup"}
              </h1>

              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                {activeView === "dashboard"
                  ? "Monitor preventive maintenance by SMT line, including Printer, SPI, Mounter, Reflow, and AOI in one full-line workflow."
                  : "Set each line name and choose machine layout before linking it to PM records and dashboard charts."}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => setActiveView("dashboard")}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold transition ${
                    activeView === "dashboard"
                      ? "bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/30 hover:bg-cyan-300"
                      : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  <BarChart3 className="h-5 w-5" />
                  Dashboard
                </button>

                <button
                  onClick={() => setActiveView("layout")}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold transition ${
                    activeView === "layout"
                      ? "bg-sky-400 text-slate-950 shadow-lg shadow-sky-950/30 hover:bg-sky-300"
                      : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  <ShieldCheck className="h-5 w-5" />
                  Line Layout
                </button>

                <button
                  onClick={() => {
                    setActiveView("dashboard");
                    setTimeout(() => document.getElementById("add-record")?.scrollIntoView({ behavior: "smooth" }), 0);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white transition hover:bg-white/10"
                >
                  <Wrench className="h-5 w-5" />
                  Add Record
                </button>

                <button
                  onClick={() => {
                    localStorage.removeItem("login");
                    router.push("/login");
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white transition hover:bg-white/10"
                >
                  <LogOut className="h-5 w-5" />
                  Logout
                </button>
              </div>
            </div>

            <div className="grid content-end gap-3 sm:grid-cols-2 md:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-sm text-slate-300">Total Downtime</p>
                <p className="mt-1 text-3xl font-black text-white">{totalDowntime} min</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-sm text-slate-300">PM Attention</p>
                <p className="mt-1 text-3xl font-black text-white">{urgentPmCount} lines</p>
              </div>
            </div>
          </div>
        </header>

        <section className={`${activeView === "dashboard" ? "mb-6 grid" : "hidden"} gap-4 sm:grid-cols-2 xl:grid-cols-4`}>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Completed Jobs</p>
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            </div>
            <p className="mt-3 text-3xl font-black">{completedCount}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Open Jobs</p>
              <AlertTriangle className="h-5 w-5 text-amber-300" />
            </div>
            <p className="mt-3 text-3xl font-black">{openJobs}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Lines Tracked</p>
              <Activity className="h-5 w-5 text-sky-300" />
            </div>
            <p className="mt-3 text-3xl font-black">{lineSummary.length}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Next Critical PM</p>
              <CalendarClock className="h-5 w-5 text-rose-300" />
            </div>
            <p className="mt-3 text-3xl font-black">{pmData[0] ? `${pmData[0].remaining} days` : "-"}</p>
          </div>
        </section>

        <section className={`${activeView === "layout" ? "mb-6 block" : "hidden"} rounded-2xl border border-white/10 bg-slate-900/80 p-5`}>
          <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-2xl font-black">Line Layout Setup</h2>
              <p className="mt-1 text-sm text-slate-400">
                Register each SMT line and its machines here. Dashboard and PM forms will link to this layout data.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-sky-400/10 px-3 py-1 text-sm font-semibold text-sky-200">
              <ShieldCheck className="h-4 w-4" />
              Master Data
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={layoutForm.line}
                  onChange={(event) => updateLayoutLine(event.target.value)}
                  placeholder="Line code A06"
                  className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                />

                <input
                  value={layoutForm.lineName}
                  onChange={(event) => setLayoutForm({ ...layoutForm, lineName: event.target.value })}
                  placeholder="Line name SMT Line A06"
                  className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                />

                <label className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 sm:col-span-2">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Last PM Date
                  </span>
                  <input
                    type="date"
                    value={layoutForm.lastPmDate}
                    onChange={(event) => setLayoutForm({ ...layoutForm, lastPmDate: event.target.value })}
                    className="w-full bg-transparent text-white outline-none"
                  />
                </label>

                <div className="rounded-2xl border border-white/10 bg-slate-900 p-4 sm:col-span-2">
                  <p className="mb-3 text-sm font-bold text-slate-300">Select machines in this line</p>
                  <div className="flex flex-wrap gap-2">
                    {machineOptions.map((machine) => (
                      <button
                        key={machine}
                        type="button"
                        onClick={() => addLayoutMachine(machine)}
                        className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-cyan-300/50 hover:bg-cyan-400/10"
                      >
                        + {machine}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <input
                      value={layoutForm.customMachine}
                      onChange={(event) => setLayoutForm({ ...layoutForm, customMachine: event.target.value })}
                      placeholder="Add other machine name"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                    />
                    <button
                      type="button"
                      onClick={() => addLayoutMachine(layoutForm.customMachine)}
                      className="rounded-xl bg-cyan-400 px-4 py-3 font-black text-slate-950 transition hover:bg-cyan-300"
                    >
                      Add
                    </button>
                  </div>

                  <div className="mt-4 rounded-xl bg-black/20 p-3 text-sm text-slate-300">
                    Preview: <span className="font-semibold text-white">{machinesToText(layoutForm.machines) || "No machines selected"}</span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {layoutForm.machines.map((machine, index) => (
                      <div key={`${machine}-${index}`} className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950 p-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-xs font-black text-slate-300">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 font-semibold text-white">{machine}</span>
                        <button
                          type="button"
                          onClick={() => moveLayoutMachine(index, -1)}
                          className="h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-xs font-black transition hover:bg-white/10 disabled:opacity-30"
                          disabled={index === 0}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveLayoutMachine(index, 1)}
                          className="h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-xs font-black transition hover:bg-white/10 disabled:opacity-30"
                          disabled={index === layoutForm.machines.length - 1}
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLayoutMachine(index)}
                          className="h-8 rounded-lg bg-rose-500/20 px-2 text-xs font-black text-rose-200 transition hover:bg-rose-500/30"
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 rounded-xl bg-black/20 p-3 text-sm text-slate-300">
                    Next PM:{" "}
                    <span className="font-semibold text-white">
                      {layoutForm.lastPmDate ? addDays(layoutForm.lastPmDate, 15) : "Select Last PM Date"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={saveLineLayout}
                  className="rounded-xl bg-sky-400 px-5 py-3 font-black text-slate-950 transition hover:bg-sky-300 sm:col-span-2"
                >
                  Save Line Layout
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {lineLayouts.map((layout) => (
                <button
                  key={layout.line}
                  onClick={() =>
                    setLayoutForm({
                      line: layout.line,
                      lineName: layout.lineName,
                      lastPmDate: getPmRecord(layout.line)?.last || "",
                      machines: layout.machines,
                      customMachine: "",
                    })
                  }
                  className="rounded-2xl border border-white/10 bg-slate-950 p-4 text-left transition hover:border-cyan-300/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-400">{layout.lineName}</p>
                      <h3 className="text-2xl font-black text-white">LINE {layout.line}</h3>
                    </div>
                    <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200">
                      {layout.machines.length} Machines
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {layout.machines.map((machine) => (
                      <span key={machine} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                        {machine}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-slate-400">
                    <p>
                      Last PM: <span className="font-semibold text-white">{getPmRecord(layout.line)?.last || "Not set"}</span>
                    </p>
                    <p>
                      Next PM: <span className="font-semibold text-white">{getPmRecord(layout.line)?.next || "Not set"}</span>
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={activeView === "dashboard" ? "mb-6" : "hidden"}>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Maintenance Schedule</h2>
              <p className="mt-1 text-sm text-slate-400">Sorted by the nearest PM date.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {pmData.slice(0, 3).map((item) => {
              const isOverdue = item.remaining <= 0;
              const isWarning = item.remaining > 0 && item.remaining <= 3;

              return (
                <article
                  key={item.line}
                  className={`rounded-2xl border p-5 shadow-xl ${
                    isOverdue
                      ? "border-rose-400/30 bg-rose-500/15 shadow-rose-950/20"
                      : isWarning
                        ? "border-amber-300/30 bg-amber-500/15 shadow-amber-950/20"
                        : "border-emerald-300/20 bg-emerald-500/10 shadow-emerald-950/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-300">Line</p>
                      <h3 className="text-4xl font-black">{item.line}</h3>
                    </div>
                    <div className="rounded-xl bg-white/10 p-3">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="mt-5 space-y-2 text-sm text-slate-300">
                    <p>Equipment Set: <span className="font-semibold text-white">{item.equipmentSet}</span></p>
                    <p>Owner: <span className="font-semibold text-white">{item.owner}</span></p>
                    <p>Last PM: <span className="font-semibold text-white">{item.last}</span></p>
                    <p>Next PM: <span className="font-semibold text-white">{item.next}</span></p>
                  </div>

                  <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-black/20 px-4 py-2 text-lg font-black">
                    <Clock3 className="h-5 w-5" />
                    {isOverdue ? `OVERDUE ${Math.abs(item.remaining)} DAYS` : `${item.remaining} DAYS LEFT`}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="add-record" className={`${activeView === "dashboard" ? "mb-6 block" : "hidden"} rounded-2xl border border-white/10 bg-slate-900/80 p-5`}>
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-black">Add Maintenance Record</h2>
              <p className="mt-1 text-sm text-slate-400">Each PM record is for the whole SMT line: Printer, SPI, Mounter, Reflow, and AOI together.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-200">
              <BarChart3 className="h-4 w-4" />
              Live Input
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <input
              type="date"
              value={formData.date}
              onChange={(event) => setFormData({ ...formData, date: event.target.value })}
              className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
            />

            <select
              value={formData.line}
              onChange={(event) => {
                const nextLine = event.target.value;
                setFormData({
                  ...formData,
                  line: nextLine,
                  equipmentSet: getEquipmentSet(nextLine),
                });
              }}
              className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
            >
              {activeLines.map((line) => (
                <option key={line}>{line}</option>
              ))}
            </select>

            <div className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-300">
              <span className="block text-xs text-slate-500">Equipment Set</span>
              <span className="font-semibold text-white">{formData.equipmentSet}</span>
            </div>

            <select
              value={formData.technician}
              onChange={(event) => setFormData({ ...formData, technician: event.target.value })}
              className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
            >
              {technicians.map((technician) => (
                <option key={technician}>{technician}</option>
              ))}
            </select>

            <input
              value={formData.problem}
              onChange={(event) => setFormData({ ...formData, problem: event.target.value })}
              placeholder="Problem / PM detail"
              className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 md:col-span-2"
            />

            <input
              type="number"
              min={0}
              value={formData.downtime}
              onChange={(event) => setFormData({ ...formData, downtime: Number(event.target.value) })}
              placeholder="Downtime minutes"
              className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
            />

            <select
              value={formData.status}
              onChange={(event) => setFormData({ ...formData, status: event.target.value as MaintenanceStatus })}
              className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
            >
              <option>Done</option>
              <option>Repairing</option>
              <option>Pending</option>
            </select>

            <select
              value={formData.priority}
              onChange={(event) => setFormData({ ...formData, priority: event.target.value as HistoryItem["priority"] })}
              className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>

            <button
              onClick={saveMaintenanceRecord}
              className="rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-300 md:col-span-2 xl:col-span-1"
            >
              Save Record
            </button>
          </div>
        </section>

        <section className={`${activeView === "dashboard" ? "mb-6 grid" : "hidden"} gap-6 xl:grid-cols-2`}>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="mb-5 text-2xl font-black">Line Maintenance Statistics</h2>
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={lineSummary}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="line" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ background: "#020617", border: "1px solid #1e293b", borderRadius: 12 }} />
                  <Bar
                    dataKey="count"
                    fill="#14b8a6"
                    radius={[10, 10, 0, 0]}
                    onClick={(data: any) => setSelectedLine(data.line)}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="mb-5 text-2xl font-black">Line Work Distribution</h2>
            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={lineSummary} dataKey="count" nameKey="line" innerRadius={58} outerRadius={112} paddingAngle={4}>
                      {lineSummary.map((entry, index) => (
                        <Cell key={entry.line} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#020617", border: "1px solid #1e293b", borderRadius: 12 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {lineSummary.map((item, index) => {
                  const total = lineSummary.reduce((sum, row) => sum + row.count, 0);
                  const percent = total ? Math.round((item.count / total) * 100) : 0;

                  return (
                    <button
                      key={item.line}
                      onClick={() => setSelectedLine(item.line)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-950 p-4 text-left transition hover:border-cyan-300/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ background: chartColors[index % chartColors.length] }} />
                        <div>
                          <p className="font-bold">LINE {item.line}</p>
                          <p className="text-sm text-slate-400">{item.downtime} min downtime</p>
                        </div>
                      </div>
                      <p className="text-2xl font-black">{percent}%</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {activeView === "dashboard" && selectedLine && (
          <section className="mb-6 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Line Detail: {selectedLine}</h2>
                <p className="mt-1 text-sm text-slate-300">{detailData.length} records found.</p>
              </div>
              <button
                onClick={() => setSelectedLine(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 transition hover:bg-white/20"
                aria-label="Close line detail"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-white/10 text-slate-300">
                  <tr>
                    <th className="py-3 text-left">Date</th>
                    <th className="text-left">Line</th>
                    <th className="text-left">PM / Problem Detail</th>
                    <th className="text-left">Technician</th>
                    <th className="text-left">Downtime</th>
                    <th className="text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detailData.map((item) => (
                    <tr key={item.id} className="border-b border-white/5">
                      <td className="py-3">{item.date}</td>
                      <td>{item.line}</td>
                      <td>{item.problem}</td>
                      <td>{item.technician}</td>
                      <td>{item.downtime} min</td>
                      <td>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClass(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className={`${activeView === "dashboard" ? "block" : "hidden"} rounded-2xl border border-white/10 bg-slate-900/80 p-5`}>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-black">Maintenance History</h2>
              <p className="mt-1 text-sm text-slate-400">Search, filter, and review all maintenance activities.</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search records"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 py-3 pl-10 pr-4 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 sm:w-72"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "All" | MaintenanceStatus)}
                className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
              >
                <option>All</option>
                <option>Done</option>
                <option>Repairing</option>
                <option>Pending</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-white/10 text-slate-300">
                <tr>
                  <th className="py-3 text-left">Date</th>
                  <th className="text-left">Line</th>
                    <th className="text-left">Equipment Set</th>
                  <th className="text-left">Problem</th>
                  <th className="text-left">Technician</th>
                  <th className="text-left">Downtime</th>
                  <th className="text-left">Priority</th>
                  <th className="text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                    <td className="py-3">{item.date}</td>
                    <td>{item.line}</td>
                    <td>
                      <button className="font-bold text-cyan-200 hover:text-cyan-100" onClick={() => setSelectedLine(item.line)}>
                        {item.equipmentSet}
                      </button>
                    </td>
                    <td>{item.problem}</td>
                    <td>{item.technician}</td>
                    <td>{item.downtime} min</td>
                    <td>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${priorityClass(item.priority)}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
