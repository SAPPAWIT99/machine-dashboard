"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
import { supabase } from "./supabase";

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
  machineSerials: Record<string, string>;
};

type SupabaseLineLayoutRow = {
  line: string;
  line_name: string;
  machines: Array<string | { name?: unknown; serialNumber?: unknown; serial?: unknown; sn?: unknown }> | null;
};

type SupabasePmRecordRow = {
  line: string;
  equipment_set: string;
  last_pm_date: string | null;
  next_pm_date: string | null;
  owner: string | null;
};

type SupabaseHistoryRow = {
  id: number | string;
  pm_date: string;
  line: string;
  equipment_set: string;
  problem: string;
  technician: string;
  status: MaintenanceStatus;
  downtime: number;
  priority: HistoryItem["priority"];
};

type LineSummaryItem = {
  line: string;
  count: number;
  downtime: number;
};

type MachineIssueItem = {
  id: string;
  date: string;
  line: string;
  machine: string;
  problem: string;
  technician: string;
  status: MaintenanceStatus;
  downtime: number;
  priority: HistoryItem["priority"];
};

type SparePartItem = {
  id: number;
  partNo: string;
  partName: string;
  line: string;
  machine: string;
  qty: number;
  minQty: number;
  location: string;
  supplier: string;
  owner: string;
  updatedDate: string;
};

const sparePartStorageKey = "machine-spare-parts-v1";

const initialLineLayouts: LineLayout[] = [];
const initialHistory: HistoryItem[] = [];
const initialPmList: PmItem[] = [];

const chartColors = ["#14b8a6", "#38bdf8", "#f97316", "#f43f5e", "#a78bfa", "#84cc16"];
const machineOptions = ["Printer", "SPI", "Mounter", "Reflow", "AOI", "Loader", "Unloader", "Conveyor", "Buffer", "NG Buffer"];

function normalizeMachines(
  machines: SupabaseLineLayoutRow["machines"],
): { names: string[]; serials: Record<string, string> } {
  return (machines || []).reduce(
    (acc, item) => {
      if (typeof item === "string") {
        const machine = item.trim();
        if (machine) {
          acc.names.push(machine);
        }
        return acc;
      }

      const name = typeof item.name === "string" ? item.name.trim() : "";
      const serial =
        typeof item.serialNumber === "string"
          ? item.serialNumber.trim()
          : typeof item.serial === "string"
            ? item.serial.trim()
            : typeof item.sn === "string"
              ? item.sn.trim()
              : "";

      if (name) {
        acc.names.push(name);
        if (serial) {
          acc.serials[name] = serial;
        }
      }

      return acc;
    },
    { names: [] as string[], serials: {} as Record<string, string> },
  );
}

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

function isMounterMachine(machine: string) {
  const normalized = machine.toLowerCase();
  return normalized.includes("mounter") || normalized.includes("hi-speed") || normalized.includes("multi");
}

function getMachineFlowOrder(machine: string) {
  const normalized = machine.toLowerCase();

  if (normalized.includes("printer")) return 10;
  if (normalized.includes("spi")) return 20;
  if (isMounterMachine(machine)) return 30;
  if (normalized.includes("aoi1")) return 40;
  if (normalized === "aoi") return 45;
  if (normalized.includes("reflow")) return 50;
  if (normalized.includes("aoi2")) return 60;
  return 70;
}

function getMachineImageSrc(machine: string) {
  const normalized = machine.toLowerCase();

  if (normalized.includes("printer")) return "/images/machines/printer.png";
  if (normalized.includes("spi")) return "/images/machines/spi.png";
  if (normalized.includes("reflow")) return "/images/machines/reflow.png";
  if (normalized.includes("aoi")) return "/images/machines/aoi.png";
  if (isMounterMachine(machine)) return "/images/machines/mounter.png";
  return "/images/machines/mounter.png";
}

function getLineMachineRows(layout: LineLayout) {
  let mounterNumber = 0;

  return layout.machines
    .map((machine, index) => ({ machine, index }))
    .sort((a, b) => getMachineFlowOrder(a.machine) - getMachineFlowOrder(b.machine) || a.index - b.index)
    .map(({ machine }) => {
      const isMounter = isMounterMachine(machine);
      const displayName = isMounter ? `Mounter ${++mounterNumber}` : machine;

      return {
        machine,
        displayName,
        serialNumber: layout.machineSerials[machine] || "",
        imageSrc: getMachineImageSrc(machine),
      };
    });
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

function isLineSummaryItem(value: unknown): value is LineSummaryItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "line" in value &&
    typeof (value as { line: unknown }).line === "string"
  );
}

export default function Home() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<"dashboard" | "layout" | "record" | "machine" | "spare">("dashboard");
  const [isChartReady, setIsChartReady] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [lineLayouts, setLineLayouts] = useState<LineLayout[]>(initialLineLayouts);
  const [historyData, setHistoryData] = useState<HistoryItem[]>(initialHistory);
  const [pmList, setPmList] = useState<PmItem[]>(initialPmList);
  const [spareParts, setSpareParts] = useState<SparePartItem[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const saved = window.localStorage.getItem(sparePartStorageKey);
      return saved ? (JSON.parse(saved) as SparePartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | MaintenanceStatus>("All");
  const [machineQuery, setMachineQuery] = useState("");
  const [machineStatusFilter, setMachineStatusFilter] = useState<"All" | MaintenanceStatus>("All");
  const [spareQuery, setSpareQuery] = useState("");
  const [spareLineFilter, setSpareLineFilter] = useState("All");
  const [spareMachineFilter, setSpareMachineFilter] = useState("All");
  const [spareStockFilter, setSpareStockFilter] = useState<"All" | "Low Stock" | "Out of Stock" | "In Stock">("All");
  const [dashboardIssueLineFilter, setDashboardIssueLineFilter] = useState("All");
  const [dashboardIssueMachineFilter, setDashboardIssueMachineFilter] = useState("All");
  const [dashboardIssueDateFilter, setDashboardIssueDateFilter] = useState("");
  const [dashboardIssueMonthFilter, setDashboardIssueMonthFilter] = useState("All");
  const [dashboardIssueYearFilter, setDashboardIssueYearFilter] = useState("All");
  const [layoutForm, setLayoutForm] = useState({
    line: "",
    lineName: "",
    lastPmDate: "",
    machines: [] as string[],
    machineSerials: {} as Record<string, string>,
    customMachine: "",
  });
  const [formData, setFormData] = useState({
    date: "",
    line: "",
    equipmentSet: "",
    workItems: [] as string[],
    remark: "",
    technician: "",
    status: "Done" as MaintenanceStatus,
    downtime: 0,
    priority: "Medium" as HistoryItem["priority"],
  });
  const [machineIssueForm, setMachineIssueForm] = useState({
    date: "",
    line: "",
    machine: "",
    problem: "",
    lineTechnician: "",
    downtime: 0,
    priority: "High" as HistoryItem["priority"],
    status: "Repairing" as MaintenanceStatus,
  });
  const [sparePartForm, setSparePartForm] = useState({
    partNo: "",
    partName: "",
    line: "",
    machine: "",
    qty: 0,
    minQty: 1,
    location: "",
    supplier: "",
    owner: "",
    updatedDate: "",
  });

  useEffect(() => {
    const login = localStorage.getItem("login");

    if (login !== "true") {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsChartReady(true);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(sparePartStorageKey, JSON.stringify(spareParts));
  }, [spareParts]);

  useEffect(() => {
    const loadSupabaseData = async () => {
      setIsLoadingData(true);

      const [layoutsResult, pmResult, historyResult] = await Promise.all([
        supabase.from("line_layouts").select("*").order("line", { ascending: true }),
        supabase.from("pm_records").select("*").order("line", { ascending: true }),
        supabase.from("maintenance_history").select("*").order("id", { ascending: false }),
      ]);

      if (layoutsResult.error || pmResult.error || historyResult.error) {
        console.error("Supabase load error", {
          layouts: layoutsResult.error,
          pm: pmResult.error,
          history: historyResult.error,
        });
        alert("Cannot load Supabase data. Please check database tables and policies.");
        setIsLoadingData(false);
        return;
      }

      const layouts = ((layoutsResult.data || []) as SupabaseLineLayoutRow[]).map((item) => {
        const normalized = normalizeMachines(item.machines);

        return {
          line: item.line,
          lineName: item.line_name,
          machines: normalized.names,
          machineSerials: normalized.serials,
        };
      });

      const pmRecords = ((pmResult.data || []) as SupabasePmRecordRow[]).map((item) => ({
          line: item.line,
          equipmentSet: item.equipment_set,
          last: item.last_pm_date || "",
          next: item.next_pm_date || "",
          owner: item.owner || "Maintenance Team",
        }));

      const history = ((historyResult.data || []) as SupabaseHistoryRow[]).map((item) => ({
          id: Number(item.id),
          date: item.pm_date,
          line: item.line,
          equipmentSet: item.equipment_set,
          problem: item.problem,
          technician: item.technician,
          status: item.status,
          downtime: item.downtime,
          priority: item.priority,
        }));

      setLineLayouts(layouts);
      setPmList(pmRecords);
      setHistoryData(history);
      setFormData((current) => {
        if (current.line || !layouts[0]) {
          return current;
        }

        return {
          ...current,
          line: layouts[0].line,
          equipmentSet: machinesToText(layouts[0].machines),
          workItems: [],
        };
      });
      setMachineIssueForm((current) => {
        if (current.line || !layouts[0]) {
          return current;
        }

        return {
          ...current,
          line: layouts[0].line,
          machine: layouts[0].machines[0] || "",
        };
      });
      setSparePartForm((current) => {
        if (current.line || !layouts[0]) {
          return current;
        }

        return {
          ...current,
          line: layouts[0].line,
          machine: layouts[0].machines[0] || "",
        };
      });

      setIsLoadingData(false);
    };

    loadSupabaseData();
  }, []);

  const activeLines = useMemo(() => lineLayouts.map((layout) => layout.line), [lineLayouts]);
  const activeLineMachines = useMemo(
    () => lineLayouts.find((layout) => layout.line === formData.line)?.machines || [],
    [formData.line, lineLayouts],
  );
  const activeIssueLineMachines = useMemo(
    () => lineLayouts.find((layout) => layout.line === machineIssueForm.line)?.machines || [],
    [machineIssueForm.line, lineLayouts],
  );
  const activeSpareLineMachines = useMemo(
    () => lineLayouts.find((layout) => layout.line === sparePartForm.line)?.machines || [],
    [sparePartForm.line, lineLayouts],
  );

  const getEquipmentSet = useCallback((line: string) => {
    const layout = lineLayouts.find((item) => item.line === line);
    return layout ? machinesToText(layout.machines) : "";
  }, [lineLayouts]);

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
    [pmList, getEquipmentSet],
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

  const machineIssueRows = useMemo<MachineIssueItem[]>(() => {
    const issueKeywords = ["fail", "error", "alarm", "repair", "ng", "abnormal", "break", "down", "เสีย"];
    const machineNames = Array.from(new Set(lineLayouts.flatMap((layout) => layout.machines)))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    return historyData.flatMap((item) => {
      const problemText = item.problem.toLowerCase();
      const hasIssueKeyword = issueKeywords.some((keyword) => problemText.includes(keyword));
      const isIssue = item.status !== "Done" || item.priority === "High" || item.downtime > 0 || hasIssueKeyword;

      if (!isIssue) {
        return [];
      }

      const matchedMachines = machineNames.filter((machine) => problemText.includes(machine.toLowerCase()));
      const machines = matchedMachines.length > 0 ? matchedMachines : ["Line issue"];

      return machines.map((machine) => ({
        id: `${item.id}-${machine}`,
        date: item.date,
        line: item.line,
        machine,
        problem: item.problem,
        technician: item.technician,
        status: item.status,
        downtime: item.downtime,
        priority: item.priority,
      }));
    });
  }, [historyData, lineLayouts]);

  const filteredMachineIssues = useMemo(() => {
    const normalizedQuery = machineQuery.trim().toLowerCase();

    return machineIssueRows.filter((item) => {
      const matchesStatus = machineStatusFilter === "All" || item.status === machineStatusFilter;
      const matchesQuery =
        !normalizedQuery ||
        [item.date, item.line, item.machine, item.problem, item.technician, item.priority]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [machineIssueRows, machineQuery, machineStatusFilter]);

  const machineIssueSummary = useMemo(() => {
    const grouped = machineIssueRows.reduce<Record<string, { machine: string; count: number; downtime: number; latest: string }>>(
      (acc, item) => {
        if (!acc[item.machine]) {
          acc[item.machine] = {
            machine: item.machine,
            count: 0,
            downtime: 0,
            latest: item.date,
          };
        }

        acc[item.machine].count += 1;
        acc[item.machine].downtime += item.downtime;
        if (item.date > acc[item.machine].latest) {
          acc[item.machine].latest = item.date;
        }

        return acc;
      },
      {},
    );

    return Object.values(grouped).sort((a, b) => b.count - a.count || b.downtime - a.downtime);
  }, [machineIssueRows]);

  const dashboardIssueMachineOptions = useMemo(() => {
    const machines = machineIssueRows
      .filter((item) => dashboardIssueLineFilter === "All" || item.line === dashboardIssueLineFilter)
      .map((item) => item.machine);

    return Array.from(new Set(machines)).sort((a, b) => a.localeCompare(b));
  }, [dashboardIssueLineFilter, machineIssueRows]);

  const dashboardIssueYearOptions = useMemo(() => {
    const years = machineIssueRows
      .map((item) => item.date.slice(0, 4))
      .filter(Boolean);

    return Array.from(new Set(years)).sort((a, b) => b.localeCompare(a));
  }, [machineIssueRows]);

  const dashboardFilteredMachineIssues = useMemo(() => {
    return machineIssueRows.filter((item) => {
      const [year, month] = item.date.split("-");
      const matchesLine = dashboardIssueLineFilter === "All" || item.line === dashboardIssueLineFilter;
      const matchesMachine = dashboardIssueMachineFilter === "All" || item.machine === dashboardIssueMachineFilter;
      const matchesDate = !dashboardIssueDateFilter || item.date === dashboardIssueDateFilter;
      const matchesMonth = dashboardIssueMonthFilter === "All" || month === dashboardIssueMonthFilter;
      const matchesYear = dashboardIssueYearFilter === "All" || year === dashboardIssueYearFilter;

      return matchesLine && matchesMachine && matchesDate && matchesMonth && matchesYear;
    });
  }, [
    dashboardIssueDateFilter,
    dashboardIssueLineFilter,
    dashboardIssueMachineFilter,
    dashboardIssueMonthFilter,
    dashboardIssueYearFilter,
    machineIssueRows,
  ]);

  const dashboardIssueByMachine = useMemo(() => {
    const grouped = dashboardFilteredMachineIssues.reduce<Record<string, { machine: string; count: number; downtime: number }>>(
      (acc, item) => {
        if (!acc[item.machine]) {
          acc[item.machine] = {
            machine: item.machine,
            count: 0,
            downtime: 0,
          };
        }

        acc[item.machine].count += 1;
        acc[item.machine].downtime += item.downtime;
        return acc;
      },
      {},
    );

    return Object.values(grouped).sort((a, b) => b.count - a.count || b.downtime - a.downtime);
  }, [dashboardFilteredMachineIssues]);

  const dashboardIssueByLine = useMemo(() => {
    const grouped = dashboardFilteredMachineIssues.reduce<Record<string, { line: string; count: number; downtime: number }>>(
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
      {},
    );

    return Object.values(grouped).sort((a, b) => b.count - a.count || b.downtime - a.downtime);
  }, [dashboardFilteredMachineIssues]);

  const detailData = selectedLine ? historyData.filter((item) => item.line === selectedLine) : [];
  const totalDowntime = historyData.reduce((sum, item) => sum + item.downtime, 0);
  const completedCount = historyData.filter((item) => item.status === "Done").length;
  const urgentPmCount = pmData.filter((item) => item.remaining <= 3).length;
  const openJobs = historyData.filter((item) => item.status !== "Done").length;
  const machineIssueDowntime = machineIssueRows.reduce((sum, item) => sum + item.downtime, 0);
  const topIssueMachine = machineIssueSummary[0]?.machine || "No issue";
  const dashboardIssueDowntime = dashboardFilteredMachineIssues.reduce((sum, item) => sum + item.downtime, 0);
  const dashboardOpenIssueCount = dashboardFilteredMachineIssues.filter((item) => item.status !== "Done").length;
  const dashboardTopIssueMachine = dashboardIssueByMachine[0]?.machine || "No issue";

  const getSpareStockStatus = (item: SparePartItem) => {
    if (item.qty <= 0) return "Out of Stock";
    if (item.qty <= item.minQty) return "Low Stock";
    return "In Stock";
  };

  const spareMachineOptions = useMemo(() => {
    const machines = spareParts
      .filter((item) => spareLineFilter === "All" || item.line === spareLineFilter)
      .map((item) => item.machine);

    return Array.from(new Set(machines)).sort((a, b) => a.localeCompare(b));
  }, [spareLineFilter, spareParts]);

  const filteredSpareParts = useMemo(() => {
    const normalizedQuery = spareQuery.trim().toLowerCase();

    return spareParts.filter((item) => {
      const status = getSpareStockStatus(item);
      const matchesLine = spareLineFilter === "All" || item.line === spareLineFilter;
      const matchesMachine = spareMachineFilter === "All" || item.machine === spareMachineFilter;
      const matchesStock = spareStockFilter === "All" || status === spareStockFilter;
      const matchesQuery =
        !normalizedQuery ||
        [item.partNo, item.partName, item.line, item.machine, item.location, item.supplier, item.owner]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesLine && matchesMachine && matchesStock && matchesQuery;
    });
  }, [spareLineFilter, spareMachineFilter, spareParts, spareQuery, spareStockFilter]);

  const totalSpareQty = spareParts.reduce((sum, item) => sum + item.qty, 0);
  const lowStockCount = spareParts.filter((item) => getSpareStockStatus(item) === "Low Stock").length;
  const outOfStockCount = spareParts.filter((item) => getSpareStockStatus(item) === "Out of Stock").length;
  const spareMachinesTracked = new Set(spareParts.map((item) => `${item.line}-${item.machine}`)).size;

  const toggleWorkItem = (machine: string) => {
    setFormData((current) => ({
      ...current,
      workItems: current.workItems.includes(machine)
        ? current.workItems.filter((item) => item !== machine)
        : [...current.workItems, machine],
    }));
  };

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
      const nextMachine = `Mounter ${nextMounterNumber}`;
      setLayoutForm({
        ...layoutForm,
        machines: [...layoutForm.machines, nextMachine],
        machineSerials: {
          ...layoutForm.machineSerials,
          [nextMachine]: "",
        },
      });
      return;
    }

    setLayoutForm({
      ...layoutForm,
      machines: [...layoutForm.machines, trimmedMachine],
      machineSerials: {
        ...layoutForm.machineSerials,
        [trimmedMachine]: layoutForm.machineSerials[trimmedMachine] || "",
      },
      customMachine: "",
    });
  };

  const removeLayoutMachine = (index: number) => {
    const machine = layoutForm.machines[index];
    const nextSerials = { ...layoutForm.machineSerials };
    delete nextSerials[machine];

    setLayoutForm({
      ...layoutForm,
      machines: layoutForm.machines.filter((_, itemIndex) => itemIndex !== index),
      machineSerials: nextSerials,
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

  const updateLayoutMachineSerial = (machine: string, serialNumber: string) => {
    setLayoutForm({
      ...layoutForm,
      machineSerials: {
        ...layoutForm.machineSerials,
        [machine]: serialNumber,
      },
    });
  };

  const saveLineLayout = async () => {
    const line = layoutForm.line.trim().toUpperCase();
    const lineName = layoutForm.lineName.trim() || `SMT Line ${line}`;
    const machines = layoutForm.machines.map((machine) => machine.trim()).filter(Boolean);
    const machineSerials = machines.reduce<Record<string, string>>((acc, machine) => {
      const serial = (layoutForm.machineSerials[machine] || "").trim();
      if (serial) {
        acc[machine] = serial;
      }
      return acc;
    }, {});
    const lastPmDate = layoutForm.lastPmDate;
    const nextPmDate = lastPmDate ? addDays(lastPmDate, 15) : addDays(new Date().toISOString().split("T")[0], 15);

    if (!line || machines.length === 0) {
      alert("Please enter line and machines");
      return;
    }

    const equipmentSet = machinesToText(machines);

    const { error: layoutError } = await supabase.from("line_layouts").upsert({
      line,
      line_name: lineName,
      machines: machines.map((machine) => ({
        name: machine,
        serialNumber: machineSerials[machine] || "",
      })),
    });

    if (layoutError) {
      console.error("Save line layout error", layoutError);
      alert("Cannot save line layout to Supabase");
      return;
    }

    const { error: pmError } = await supabase.from("pm_records").upsert({
      line,
      equipment_set: equipmentSet,
      last_pm_date: lastPmDate || null,
      next_pm_date: nextPmDate,
      owner: "Maintenance Team",
    });

    if (pmError) {
      console.error("Save PM record error", pmError);
      alert("Cannot save PM date to Supabase");
      return;
    }

    setLineLayouts((current) => {
      const exists = current.some((item) => item.line === line);
      const nextLayout = { line, lineName, machines, machineSerials };

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
            workItems: [],
          }
        : current,
    );

    setLayoutForm({
      line: "",
      lineName: "",
      lastPmDate: "",
      machines: [],
      machineSerials: {},
      customMachine: "",
    });
  };

  const saveMaintenanceRecord = async () => {
    if (!formData.line) {
      alert("Please add line layout first");
      return;
    }

    if (!formData.date) {
      alert("Please select date");
      return;
    }

    if (formData.workItems.length === 0) {
      alert("Please select work items");
      return;
    }

    if (!formData.technician.trim()) {
      alert("Please enter technician name");
      return;
    }

    const problemDetail = [
      `Completed: ${formData.workItems.join(", ")}`,
      formData.remark.trim() ? `Remark: ${formData.remark.trim()}` : "",
    ].filter(Boolean).join(" | ");

    const newRecord: HistoryItem = {
      id: Date.now(),
      date: formData.date,
      line: formData.line,
      equipmentSet: formData.equipmentSet,
      problem: problemDetail,
      technician: formData.technician.trim(),
      status: "Done",
      downtime: 0,
      priority: "Medium",
    };

    const { error: historyError } = await supabase.from("maintenance_history").insert({
      id: newRecord.id,
      pm_date: newRecord.date,
      line: newRecord.line,
      equipment_set: newRecord.equipmentSet,
      problem: newRecord.problem,
      technician: newRecord.technician,
      status: newRecord.status,
      downtime: newRecord.downtime,
      priority: newRecord.priority,
    });

    if (historyError) {
      console.error("Save maintenance history error", historyError);
      alert("Cannot save maintenance record to Supabase");
      return;
    }

    const { error: pmError } = await supabase.from("pm_records").upsert({
      line: formData.line,
      equipment_set: formData.equipmentSet,
      last_pm_date: formData.date,
      next_pm_date: addDays(formData.date, 15),
      owner: formData.technician,
    });

    if (pmError) {
      console.error("Update PM record error", pmError);
      alert("Cannot update PM schedule in Supabase");
      return;
    }

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
      workItems: [],
      remark: "",
      technician: "",
      status: "Done",
      downtime: 0,
      priority: "Medium",
    });
  };

  const saveMachineIssueRecord = async () => {
    const line = machineIssueForm.line;
    const machine = machineIssueForm.machine.trim();
    const problem = machineIssueForm.problem.trim();
    const lineTechnician = machineIssueForm.lineTechnician.trim();

    if (!line) {
      alert("Please add line layout first");
      return;
    }

    if (!machineIssueForm.date) {
      alert("Please select issue date");
      return;
    }

    if (!machine) {
      alert("Please select machine");
      return;
    }

    if (!problem) {
      alert("Please enter machine issue detail");
      return;
    }

    if (!lineTechnician) {
      alert("Please enter line technician name");
      return;
    }

    const equipmentSet = getEquipmentSet(line);
    const problemDetail = `Machine Issue: ${machine} | Detail: ${problem}`;
    const newRecord: HistoryItem = {
      id: Date.now(),
      date: machineIssueForm.date,
      line,
      equipmentSet,
      problem: problemDetail,
      technician: lineTechnician,
      status: machineIssueForm.status,
      downtime: Number(machineIssueForm.downtime) || 0,
      priority: machineIssueForm.priority,
    };

    const { error: historyError } = await supabase.from("maintenance_history").insert({
      id: newRecord.id,
      pm_date: newRecord.date,
      line: newRecord.line,
      equipment_set: newRecord.equipmentSet,
      problem: newRecord.problem,
      technician: newRecord.technician,
      status: newRecord.status,
      downtime: newRecord.downtime,
      priority: newRecord.priority,
    });

    if (historyError) {
      console.error("Save machine issue history error", historyError);
      alert("Cannot save machine issue record to Supabase");
      return;
    }

    setHistoryData((current) => [newRecord, ...current]);
    setMachineIssueForm({
      date: "",
      line: activeLines[0] || "",
      machine: activeLines[0] ? lineLayouts.find((layout) => layout.line === activeLines[0])?.machines[0] || "" : "",
      problem: "",
      lineTechnician: "",
      downtime: 0,
      priority: "High",
      status: "Repairing",
    });
  };

  const saveSparePart = () => {
    const partNo = sparePartForm.partNo.trim();
    const partName = sparePartForm.partName.trim();
    const line = sparePartForm.line;
    const machine = sparePartForm.machine;
    const owner = sparePartForm.owner.trim();
    const updatedDate = sparePartForm.updatedDate || new Date().toISOString().split("T")[0];

    if (!partNo) {
      alert("Please enter part number");
      return;
    }

    if (!partName) {
      alert("Please enter spare part name");
      return;
    }

    if (!line || !machine) {
      alert("Please select line and machine");
      return;
    }

    if (!owner) {
      alert("Please enter owner / line technician name");
      return;
    }

    const nextPart: SparePartItem = {
      id: Date.now(),
      partNo,
      partName,
      line,
      machine,
      qty: Number(sparePartForm.qty) || 0,
      minQty: Number(sparePartForm.minQty) || 0,
      location: sparePartForm.location.trim(),
      supplier: sparePartForm.supplier.trim(),
      owner,
      updatedDate,
    };

    setSpareParts((current) => [nextPart, ...current]);
    setSparePartForm({
      partNo: "",
      partName: "",
      line: activeLines[0] || "",
      machine: activeLines[0] ? lineLayouts.find((layout) => layout.line === activeLines[0])?.machines[0] || "" : "",
      qty: 0,
      minQty: 1,
      location: "",
      supplier: "",
      owner: "",
      updatedDate: "",
    });
  };

  const updateSparePartQty = (id: number, amount: number) => {
    setSpareParts((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              qty: Math.max(0, item.qty + amount),
              updatedDate: new Date().toISOString().split("T")[0],
            }
          : item,
      ),
    );
  };

  const deleteSparePart = (id: number) => {
    setSpareParts((current) => current.filter((item) => item.id !== id));
  };

  return (
    <main className="min-h-screen bg-[#08111f] text-slate-100">
      <div className="w-full px-4 py-5 sm:px-6 lg:px-8 2xl:px-10">
        <header className="mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 shadow-2xl shadow-cyan-950/30">
          <div className="relative grid gap-8 p-6 md:grid-cols-[1.3fr_0.7fr] md:p-8">
            <Image
              src="/images/smt-mounter-dashboard.png"
              alt=""
              fill
              priority
              className="absolute inset-0 h-full w-full object-cover opacity-50"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.96),rgba(2,6,23,0.78)_45%,rgba(2,6,23,0.42)),radial-gradient(circle_at_top_left,rgba(20,184,166,0.35),transparent_34%)]" />
            <button
              onClick={() => {
                localStorage.removeItem("login");
                router.push("/login");
              }}
              className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10 md:right-6 md:top-6"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
            <div className="relative z-10">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-100">
                <Sparkles className="h-4 w-4" />
                SMT Factory Maintenance Command Center
              </div>

              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
                {activeView === "dashboard"
                  ? "SMT Maintenance Dashboard"
                  : activeView === "layout"
                    ? "Line Layout Setup"
                    : activeView === "record"
                      ? "Add Maintenance Record"
                      : activeView === "machine"
                        ? "Machine Issue History"
                        : "Machine Spare Part"}
              </h1>

              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
                {activeView === "dashboard"
                  ? "Monitor preventive maintenance reports by SMT line, including schedule status, downtime, charts, and maintenance history."
                  : activeView === "layout"
                    ? "Set each line name and choose machine layout before linking it to PM records and dashboard charts."
                    : activeView === "record"
                      ? "Record completed maintenance work and update the next PM schedule for each SMT line."
                      : activeView === "machine"
                        ? "Review machine issue records by line, machine name, status, downtime, and technician response."
                        : "Manage spare part stock by line, machine, part number, location, supplier, and responsible technician."}
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
                  onClick={() => setActiveView("record")}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold transition ${
                    activeView === "record"
                      ? "bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-950/30 hover:bg-emerald-300"
                      : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  <Wrench className="h-5 w-5" />
                  Add Record
                </button>

                <button
                  onClick={() => setActiveView("machine")}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold transition ${
                    activeView === "machine"
                      ? "bg-rose-400 text-slate-950 shadow-lg shadow-rose-950/30 hover:bg-rose-300"
                      : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                  Machine History
                </button>

                <button
                  onClick={() => setActiveView("spare")}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold transition ${
                    activeView === "spare"
                      ? "bg-violet-400 text-slate-950 shadow-lg shadow-violet-950/30 hover:bg-violet-300"
                      : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  <Wrench className="h-5 w-5" />
                  Spare Part
                </button>

              </div>
            </div>

            <div className="relative z-10 grid content-end gap-3 sm:grid-cols-2 md:grid-cols-1">
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
          {isLoadingData && (
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-5 text-sm font-semibold text-cyan-100 sm:col-span-2 xl:col-span-4">
              Loading data from Supabase...
            </div>
          )}

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

        <section className={`${activeView === "dashboard" ? "mb-6 block" : "hidden"} rounded-2xl border border-white/10 bg-slate-900/80 p-5`}>
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-2xl font-black">Machine Issue Statistics</h2>
              <p className="mt-1 text-sm text-slate-400">Filter machine issue records by line, machine, day, month, and year.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Line</span>
                <select
                  value={dashboardIssueLineFilter}
                  onChange={(event) => {
                    setDashboardIssueLineFilter(event.target.value);
                    setDashboardIssueMachineFilter("All");
                  }}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                >
                  <option>All</option>
                  {activeLines.map((line) => (
                    <option key={line}>{line}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Machine</span>
                <select
                  value={dashboardIssueMachineFilter}
                  onChange={(event) => setDashboardIssueMachineFilter(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                >
                  <option>All</option>
                  {dashboardIssueMachineOptions.map((machine) => (
                    <option key={machine}>{machine}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Day</span>
                <input
                  type="date"
                  value={dashboardIssueDateFilter}
                  onChange={(event) => setDashboardIssueDateFilter(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Month</span>
                <select
                  value={dashboardIssueMonthFilter}
                  onChange={(event) => setDashboardIssueMonthFilter(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                >
                  <option value="All">All</option>
                  <option value="01">Jan</option>
                  <option value="02">Feb</option>
                  <option value="03">Mar</option>
                  <option value="04">Apr</option>
                  <option value="05">May</option>
                  <option value="06">Jun</option>
                  <option value="07">Jul</option>
                  <option value="08">Aug</option>
                  <option value="09">Sep</option>
                  <option value="10">Oct</option>
                  <option value="11">Nov</option>
                  <option value="12">Dec</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Year</span>
                <select
                  value={dashboardIssueYearFilter}
                  onChange={(event) => setDashboardIssueYearFilter(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                >
                  <option>All</option>
                  {dashboardIssueYearOptions.map((year) => (
                    <option key={year}>{year}</option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => {
                  setDashboardIssueLineFilter("All");
                  setDashboardIssueMachineFilter("All");
                  setDashboardIssueDateFilter("");
                  setDashboardIssueMonthFilter("All");
                  setDashboardIssueYearFilter("All");
                }}
                className="self-end rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-bold text-white transition hover:bg-white/10"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <p className="text-sm text-slate-400">Filtered Issues</p>
              <p className="mt-3 text-3xl font-black">{dashboardFilteredMachineIssues.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <p className="text-sm text-slate-400">Open Issues</p>
              <p className="mt-3 text-3xl font-black">{dashboardOpenIssueCount}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <p className="text-sm text-slate-400">Issue Downtime</p>
              <p className="mt-3 text-3xl font-black">{dashboardIssueDowntime} min</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <p className="text-sm text-slate-400">Top Issue Machine</p>
              <p className="mt-3 text-3xl font-black">{dashboardTopIssueMachine}</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <h3 className="mb-4 text-xl font-black">Issues by Machine</h3>
              <div className="h-[320px]">
                {isChartReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardIssueByMachine.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="machine" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ background: "#020617", border: "1px solid #1e293b", borderRadius: 12 }} />
                      <Bar dataKey="count" fill="#fb7185" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full rounded-2xl bg-slate-900/80" />
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <h3 className="mb-4 text-xl font-black">Issues by Line</h3>
              <div className="h-[320px]">
                {isChartReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardIssueByLine}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="line" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ background: "#020617", border: "1px solid #1e293b", borderRadius: 12 }} />
                      <Bar dataKey="count" fill="#38bdf8" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full rounded-2xl bg-slate-900/80" />
                )}
              </div>
            </div>
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
                      <div key={`${machine}-${index}`} className="grid gap-3 rounded-xl border border-white/10 bg-slate-950 p-3 lg:grid-cols-[32px_1fr_220px_auto] lg:items-end">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-xs font-black text-slate-300">
                          {index + 1}
                        </span>
                        <div>
                          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Machine</span>
                          <p className="font-semibold text-white">{machine}</p>
                        </div>
                        <label className="block">
                          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">S/N</span>
                          <input
                            value={layoutForm.machineSerials[machine] || ""}
                            onChange={(event) => updateLayoutMachineSerial(machine, event.target.value)}
                            placeholder="Serial number"
                            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => moveLayoutMachine(index, -1)}
                            className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black transition hover:bg-white/10 disabled:opacity-30"
                            disabled={index === 0}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLayoutMachine(index, 1)}
                            className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-black transition hover:bg-white/10 disabled:opacity-30"
                            disabled={index === layoutForm.machines.length - 1}
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLayoutMachine(index)}
                            className="h-9 rounded-lg bg-rose-500/20 px-3 text-xs font-black text-rose-200 transition hover:bg-rose-500/30"
                          >
                            X
                          </button>
                        </div>
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
                      machineSerials: layout.machineSerials,
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

                  <div className="mt-4 grid gap-2">
                    {getLineMachineRows(layout).map((item) => (
                      <div
                        key={item.machine}
                        className="grid grid-cols-[64px_1fr] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
                      >
                        <div className="relative h-14 w-16 overflow-hidden rounded-lg border border-white/10 bg-slate-900">
                          <Image
                            src={item.imageSrc}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{item.displayName}</p>
                          <p className="truncate text-xs font-semibold text-slate-400">
                            S/N: <span className="text-slate-200">{item.serialNumber || "-"}</span>
                          </p>
                        </div>
                      </div>
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

        <section className={`${activeView === "record" ? "mb-6 block" : "hidden"} rounded-2xl border border-white/10 bg-slate-900/80 p-5`}>
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-black">Add Maintenance Record</h2>
              <p className="mt-1 text-sm text-slate-400">Select the line, work date, completed items, remark, and technician name.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-200">
              <BarChart3 className="h-4 w-4" />
              Live Input
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950 p-4 md:grid-cols-2 lg:grid-cols-1">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Line</span>
                <select
                  value={formData.line}
                  onChange={(event) => {
                    const nextLine = event.target.value;
                    setFormData({
                      ...formData,
                      line: nextLine,
                      equipmentSet: getEquipmentSet(nextLine),
                      workItems: [],
                    });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                >
                  {activeLines.map((line) => (
                    <option key={line}>{line}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Work Date</span>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(event) => setFormData({ ...formData, date: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                />
              </label>

              <label className="block md:col-span-2 lg:col-span-1">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Technician Name</span>
                <input
                  value={formData.technician}
                  onChange={(event) => setFormData({ ...formData, technician: event.target.value })}
                  placeholder="Name"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
              <div className="mb-4 rounded-xl bg-black/20 p-3 text-sm text-slate-300">
                Equipment Set: <span className="font-semibold text-white">{formData.equipmentSet || "Select a line"}</span>
              </div>

              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-bold text-slate-300">Work Completed</p>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        workItems: formData.workItems.length === activeLineMachines.length ? [] : activeLineMachines,
                      })
                    }
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:bg-white/10"
                    disabled={activeLineMachines.length === 0}
                  >
                    {formData.workItems.length === activeLineMachines.length && activeLineMachines.length > 0 ? "Clear All" : "Select All"}
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {activeLineMachines.length > 0 ? (
                    activeLineMachines.map((machine) => {
                      const isChecked = formData.workItems.includes(machine);

                      return (
                        <label
                          key={machine}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                            isChecked
                              ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-100"
                              : "border-white/10 bg-slate-900 text-slate-200 hover:border-cyan-300/40"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleWorkItem(machine)}
                            className="h-4 w-4 accent-emerald-400"
                          />
                          {machine}
                        </label>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm font-semibold text-amber-100 sm:col-span-2 xl:col-span-3">
                      Please add a line layout first.
                    </div>
                  )}
                </div>
              </div>

              <label className="mt-4 block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Remark</span>
                <textarea
                  value={formData.remark}
                  onChange={(event) => setFormData({ ...formData, remark: event.target.value })}
                  placeholder="Remark / note"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                />
              </label>

              <button
                onClick={saveMaintenanceRecord}
                className="mt-4 w-full rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-300"
              >
                Save Record
              </button>
            </div>
          </div>
        </section>

        <section className={`${activeView === "spare" ? "mb-6 block" : "hidden"} rounded-2xl border border-violet-300/20 bg-slate-900/80 p-5`}>
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-black">Add Machine Spare Part</h2>
              <p className="mt-1 text-sm text-slate-400">Register spare parts and minimum stock by line and machine.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-violet-400/10 px-3 py-1 text-sm font-semibold text-violet-200">
              <Wrench className="h-4 w-4" />
              Spare Part Master
            </span>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950 p-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Part Number</span>
                <input
                  value={sparePartForm.partNo}
                  onChange={(event) => setSparePartForm({ ...sparePartForm, partNo: event.target.value })}
                  placeholder="Part no."
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Spare Part Name</span>
                <input
                  value={sparePartForm.partName}
                  onChange={(event) => setSparePartForm({ ...sparePartForm, partName: event.target.value })}
                  placeholder="Nozzle / belt / sensor"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Line</span>
                <select
                  value={sparePartForm.line}
                  onChange={(event) => {
                    const nextLine = event.target.value;
                    const nextMachines = lineLayouts.find((layout) => layout.line === nextLine)?.machines || [];
                    setSparePartForm({
                      ...sparePartForm,
                      line: nextLine,
                      machine: nextMachines[0] || "",
                    });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                >
                  {activeLines.map((line) => (
                    <option key={line}>{line}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Machine</span>
                <select
                  value={sparePartForm.machine}
                  onChange={(event) => setSparePartForm({ ...sparePartForm, machine: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                >
                  {activeSpareLineMachines.map((machine) => (
                    <option key={machine}>{machine}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Quantity</span>
                <input
                  type="number"
                  min={0}
                  value={sparePartForm.qty}
                  onChange={(event) => setSparePartForm({ ...sparePartForm, qty: Number(event.target.value) })}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Minimum Stock</span>
                <input
                  type="number"
                  min={0}
                  value={sparePartForm.minQty}
                  onChange={(event) => setSparePartForm({ ...sparePartForm, minQty: Number(event.target.value) })}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                />
              </label>
            </div>

            <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950 p-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Location</span>
                <input
                  value={sparePartForm.location}
                  onChange={(event) => setSparePartForm({ ...sparePartForm, location: event.target.value })}
                  placeholder="Shelf / cabinet / bin"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Supplier</span>
                <input
                  value={sparePartForm.supplier}
                  onChange={(event) => setSparePartForm({ ...sparePartForm, supplier: event.target.value })}
                  placeholder="Supplier / maker"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Owner / Technician</span>
                <input
                  value={sparePartForm.owner}
                  onChange={(event) => setSparePartForm({ ...sparePartForm, owner: event.target.value })}
                  placeholder="Responsible person"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Updated Date</span>
                <input
                  type="date"
                  value={sparePartForm.updatedDate}
                  onChange={(event) => setSparePartForm({ ...sparePartForm, updatedDate: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                />
              </label>

              <button
                type="button"
                onClick={saveSparePart}
                className="rounded-xl bg-violet-400 px-5 py-3 font-black text-slate-950 transition hover:bg-violet-300 md:col-span-2"
              >
                Save Spare Part
              </button>
            </div>
          </div>
        </section>

        <section className={`${activeView === "spare" ? "mb-6 grid" : "hidden"} gap-4 sm:grid-cols-2 xl:grid-cols-4`}>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">Spare Part Items</p>
            <p className="mt-3 text-3xl font-black">{spareParts.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">Total Quantity</p>
            <p className="mt-3 text-3xl font-black">{totalSpareQty}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">Low Stock</p>
            <p className="mt-3 text-3xl font-black text-amber-200">{lowStockCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">Out of Stock</p>
            <p className="mt-3 text-3xl font-black text-rose-200">{outOfStockCount}</p>
          </div>
        </section>

        <section className={`${activeView === "spare" ? "block" : "hidden"} rounded-2xl border border-white/10 bg-slate-900/80 p-5`}>
          <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-2xl font-black">Machine Spare Part List</h2>
              <p className="mt-1 text-sm text-slate-400">{spareMachinesTracked} line-machine groups tracked.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={spareQuery}
                  onChange={(event) => setSpareQuery(event.target.value)}
                  placeholder="Search spare parts"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 py-3 pl-10 pr-4 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                />
              </div>

              <select
                value={spareLineFilter}
                onChange={(event) => {
                  setSpareLineFilter(event.target.value);
                  setSpareMachineFilter("All");
                }}
                className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
              >
                <option>All</option>
                {activeLines.map((line) => (
                  <option key={line}>{line}</option>
                ))}
              </select>

              <select
                value={spareMachineFilter}
                onChange={(event) => setSpareMachineFilter(event.target.value)}
                className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
              >
                <option>All</option>
                {spareMachineOptions.map((machine) => (
                  <option key={machine}>{machine}</option>
                ))}
              </select>

              <select
                value={spareStockFilter}
                onChange={(event) => setSpareStockFilter(event.target.value as "All" | "Low Stock" | "Out of Stock" | "In Stock")}
                className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
              >
                <option>All</option>
                <option>In Stock</option>
                <option>Low Stock</option>
                <option>Out of Stock</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-sm">
              <thead className="border-b border-white/10 text-slate-300">
                <tr>
                  <th className="py-3 text-left">Part No.</th>
                  <th className="text-left">Part Name</th>
                  <th className="text-left">Line</th>
                  <th className="text-left">Machine</th>
                  <th className="text-left">Qty</th>
                  <th className="text-left">Min</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Location</th>
                  <th className="text-left">Supplier</th>
                  <th className="text-left">Owner</th>
                  <th className="text-left">Updated</th>
                  <th className="text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSpareParts.length > 0 ? (
                  filteredSpareParts.map((item) => {
                    const stockStatus = getSpareStockStatus(item);

                    return (
                      <tr key={item.id} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                        <td className="py-3 font-bold text-cyan-200">{item.partNo}</td>
                        <td>{item.partName}</td>
                        <td>{item.line}</td>
                        <td>{item.machine}</td>
                        <td className="font-black">{item.qty}</td>
                        <td>{item.minQty}</td>
                        <td>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              stockStatus === "Out of Stock"
                                ? "bg-rose-500/15 text-rose-200"
                                : stockStatus === "Low Stock"
                                  ? "bg-amber-500/15 text-amber-200"
                                  : "bg-emerald-500/15 text-emerald-200"
                            }`}
                          >
                            {stockStatus}
                          </span>
                        </td>
                        <td>{item.location || "-"}</td>
                        <td>{item.supplier || "-"}</td>
                        <td>{item.owner}</td>
                        <td>{item.updatedDate}</td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => updateSparePartQty(item.id, -1)}
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 font-bold text-white hover:bg-white/10"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() => updateSparePartQty(item.id, 1)}
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 font-bold text-white hover:bg-white/10"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSparePart(item.id)}
                              className="rounded-lg border border-rose-300/20 bg-rose-400/10 px-3 py-1 font-bold text-rose-100 hover:bg-rose-400/20"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400">
                      No spare parts match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${activeView === "machine" ? "mb-6 block" : "hidden"} rounded-2xl border border-rose-300/20 bg-slate-900/80 p-5`}>
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-black">Add Machine Issue</h2>
              <p className="mt-1 text-sm text-slate-400">For line technicians to record machine breakdown history by line and machine.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-rose-400/10 px-3 py-1 text-sm font-semibold text-rose-200">
              <AlertTriangle className="h-4 w-4" />
              Machine Issue Input
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950 p-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Issue Date</span>
                <input
                  type="date"
                  value={machineIssueForm.date}
                  onChange={(event) => setMachineIssueForm({ ...machineIssueForm, date: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Line</span>
                <select
                  value={machineIssueForm.line}
                  onChange={(event) => {
                    const nextLine = event.target.value;
                    const nextMachines = lineLayouts.find((layout) => layout.line === nextLine)?.machines || [];
                    setMachineIssueForm({
                      ...machineIssueForm,
                      line: nextLine,
                      machine: nextMachines[0] || "",
                    });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                >
                  {activeLines.map((line) => (
                    <option key={line}>{line}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Machine</span>
                <select
                  value={machineIssueForm.machine}
                  onChange={(event) => setMachineIssueForm({ ...machineIssueForm, machine: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                >
                  {activeIssueLineMachines.map((machine) => (
                    <option key={machine}>{machine}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Line Technician Name</span>
                <input
                  value={machineIssueForm.lineTechnician}
                  onChange={(event) => setMachineIssueForm({ ...machineIssueForm, lineTechnician: event.target.value })}
                  placeholder="Technician name"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Downtime (min)</span>
                <input
                  type="number"
                  min={0}
                  value={machineIssueForm.downtime}
                  onChange={(event) => setMachineIssueForm({ ...machineIssueForm, downtime: Number(event.target.value) })}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Status</span>
                <select
                  value={machineIssueForm.status}
                  onChange={(event) => setMachineIssueForm({ ...machineIssueForm, status: event.target.value as MaintenanceStatus })}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                >
                  <option>Repairing</option>
                  <option>Pending</option>
                  <option>Done</option>
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Priority</span>
                <select
                  value={machineIssueForm.priority}
                  onChange={(event) => setMachineIssueForm({ ...machineIssueForm, priority: event.target.value as HistoryItem["priority"] })}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                >
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
              <div className="mb-4 rounded-xl bg-black/20 p-3 text-sm text-slate-300">
                Equipment Set: <span className="font-semibold text-white">{getEquipmentSet(machineIssueForm.line) || "Select a line"}</span>
              </div>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Machine Issue Detail</span>
                <textarea
                  value={machineIssueForm.problem}
                  onChange={(event) => setMachineIssueForm({ ...machineIssueForm, problem: event.target.value })}
                  placeholder="Describe alarm, error, NG, abnormal sound, repair action, or symptom"
                  rows={8}
                  className="w-full resize-none rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                />
              </label>

              <button
                onClick={saveMachineIssueRecord}
                className="mt-4 w-full rounded-xl bg-rose-400 px-5 py-3 font-black text-slate-950 transition hover:bg-rose-300"
              >
                Save Machine Issue
              </button>
            </div>
          </div>
        </section>

        <section className={`${activeView === "machine" ? "mb-6 grid" : "hidden"} gap-4 sm:grid-cols-2 xl:grid-cols-4`}>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-slate-400">Machine Issues</p>
              <AlertTriangle className="h-5 w-5 text-rose-300" />
            </div>
            <p className="mt-3 text-3xl font-black">{machineIssueRows.length}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-slate-400">Issue Downtime</p>
              <Clock3 className="h-5 w-5 text-amber-300" />
            </div>
            <p className="mt-3 text-3xl font-black">{machineIssueDowntime} min</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-slate-400">Top Issue Machine</p>
              <Wrench className="h-5 w-5 text-cyan-300" />
            </div>
            <p className="mt-3 text-3xl font-black">{topIssueMachine}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-slate-400">Open Issues</p>
              <Activity className="h-5 w-5 text-sky-300" />
            </div>
            <p className="mt-3 text-3xl font-black">{machineIssueRows.filter((item) => item.status !== "Done").length}</p>
          </div>
        </section>

        <section className={`${activeView === "machine" ? "mb-6 grid" : "hidden"} gap-6 xl:grid-cols-[0.8fr_1.2fr]`}>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <div className="mb-5">
              <h2 className="text-2xl font-black">Frequent Machine Issues</h2>
              <p className="mt-1 text-sm text-slate-400">Machines ranked by issue count from maintenance history.</p>
            </div>

            <div className="space-y-3">
              {machineIssueSummary.length > 0 ? (
                machineIssueSummary.slice(0, 8).map((item, index) => {
                  const maxCount = machineIssueSummary[0]?.count || 1;
                  const width = `${Math.max(8, Math.round((item.count / maxCount) * 100))}%`;

                  return (
                    <div key={item.machine} className="rounded-xl border border-white/10 bg-slate-950 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-black text-white">{item.machine}</p>
                          <p className="mt-1 text-sm text-slate-400">Latest: {item.latest}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black">{item.count}</p>
                          <p className="text-xs text-slate-400">{item.downtime} min</p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full" style={{ width, background: chartColors[index % chartColors.length] }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm font-semibold text-emerald-100">
                  No machine issue history found.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black">Machine Issue History</h2>
                <p className="mt-1 text-sm text-slate-400">Review machine breakdown, repair, NG, alarm, and downtime records.</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={machineQuery}
                    onChange={(event) => setMachineQuery(event.target.value)}
                    placeholder="Search machine issues"
                    className="w-full rounded-xl border border-white/10 bg-slate-950 py-3 pl-10 pr-4 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 sm:w-72"
                  />
                </div>

                <select
                  value={machineStatusFilter}
                  onChange={(event) => setMachineStatusFilter(event.target.value as "All" | MaintenanceStatus)}
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
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-white/10 text-slate-300">
                  <tr>
                    <th className="py-3 text-left">Date</th>
                    <th className="text-left">Line</th>
                    <th className="text-left">Machine</th>
                    <th className="text-left">Problem Detail</th>
                    <th className="text-left">Technician</th>
                    <th className="text-left">Downtime</th>
                    <th className="text-left">Priority</th>
                    <th className="text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMachineIssues.length > 0 ? (
                    filteredMachineIssues.map((item) => (
                      <tr key={item.id} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                        <td className="py-3">{item.date}</td>
                        <td>{item.line}</td>
                        <td className="font-bold text-cyan-200">{item.machine}</td>
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No machine issue records match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className={`${activeView === "dashboard" ? "mb-6 grid" : "hidden"} gap-6 xl:grid-cols-2`}>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="mb-5 text-2xl font-black">Line Maintenance Statistics</h2>
            <div className="h-[360px]">
              {isChartReady ? (
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
                      onClick={(data: unknown) => {
                        if (isLineSummaryItem(data)) {
                          setSelectedLine(data.line);
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full rounded-2xl bg-slate-950/60" />
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="mb-5 text-2xl font-black">Line Work Distribution</h2>
            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="h-[320px]">
                {isChartReady ? (
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
                ) : (
                  <div className="h-full rounded-2xl bg-slate-950/60" />
                )}
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
