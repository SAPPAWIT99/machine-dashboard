"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function Home() {

  const router = useRouter();

  const [historyData, setHistoryData] = useState<any[]>([]);

  useEffect(() => {

    const login = localStorage.getItem("login");

    if (login !== "true") {

      router.push("/login");

    }

    const fetchData = async () => {

      const { data, error } = await supabase
        .from("maintenance")
        .select("*")
        .order("id", { ascending: false });

      if (error) {

        console.log(error);

      } else {

        setHistoryData(data || []);

      }

    };

    fetchData();

  }, [router]);

  // Production Lines
  const lines = [
    "A01","A02","A03","A04",
    "A05","A06","A07","A08",
    "A09","A10","A11","A12",
    "B07","B10"
  ];

  // Production Output Graph
  const productionData = [
    { machine: "A01", error: 2 },
    { machine: "A02", error: 5 },
    { machine: "A03", error: 1 },
    { machine: "A04", error: 7 },
    { machine: "A05", error: 3 },
    { machine: "A06", error: 4 },
  ];

  // Downtime Graph
  const downtimeData = [
    { machine: "Printer", time: 35 },
    { machine: "SPI", time: 18 },
    { machine: "Reflow", time: 52 },
    { machine: "AOI", time: 20 },
    { machine: "Loader", time: 12 },
  ];

  // Pie Chart Data
  const statusData = [
    { name: "Running", value: 28 },
    { name: "Alarm", value: 3 },
    { name: "Idle", value: 11 },
  ];

  // PM Schedule
  const maintenanceSchedule = [
    {
      machine: "A01",
      lastPM: "2026-05-10",
      nextPM: "2026-05-25",
      status: "Due Soon",
    },
    {
      machine: "A02",
      lastPM: "2026-05-01",
      nextPM: "2026-05-16",
      status: "Overdue",
    },
    {
      machine: "A03",
      lastPM: "2026-05-15",
      nextPM: "2026-05-30",
      status: "Normal",
    },
  ];

  const COLORS = [
    "#22c55e",
    "#ef4444",
    "#eab308",
  ];

  return (

    <main className="min-h-screen bg-[#0f172a] text-white">

      {/* ================= TOPBAR ================= */}

      <div className="flex items-center justify-between px-8 py-5 border-b border-gray-700">

        <div>

          <h1 className="text-2xl font-bold">
            MACHINE MAINTENANCE DASHBOARD
          </h1>

          <p className="text-gray-400 mt-1">
            Factory Monitoring System
          </p>

        </div>

        <div className="flex gap-4">

          <div className="bg-red-600 px-5 py-3 rounded-2xl shadow-lg">
            Alarm 3
          </div>

          <div className="bg-green-600 px-5 py-3 rounded-2xl shadow-lg">
            Running 28
          </div>

          <button
            onClick={() => {

              localStorage.removeItem("login");

              router.push("/login");

            }}
            className="bg-gray-700 hover:bg-gray-600 px-5 py-3 rounded-2xl shadow-lg"
          >
            Logout
          </button>

        </div>

      </div>

      {/* ================= SUMMARY ================= */}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-8">

        <div className="bg-[#1e293b] p-4 rounded-2xl shadow-lg">

          <h2 className="text-gray-400">
            Total Machines
          </h2>

          <p className="text-3xl font-bold mt-4">
            42
          </p>

        </div>

        <div className="bg-[#1e293b] p-4 rounded-2xl shadow-lg">

          <h2 className="text-gray-400">
            Breakdown Today
          </h2>

          <p className="text-5xl font-bold mt-4 text-red-500">
            5
          </p>

        </div>

        <div className="bg-[#1e293b] p-4 rounded-2xl shadow-lg">

          <h2 className="text-gray-400">
            Downtime
          </h2>

          <p className="text-5xl font-bold mt-4 text-yellow-400">
            128m
          </p>

        </div>

        <div className="bg-[#1e293b] p-4 rounded-2xl shadow-lg">

          <h2 className="text-gray-400">
            MTTR
          </h2>

          <p className="text-5xl font-bold mt-4 text-cyan-400">
            24m
          </p>

        </div>

      </section>

      {/* ================= PM SCHEDULE ================= */}

      <section className="px-8 mt-8">

        <div className="bg-[#1e293b] rounded-2xl p-4 shadow-lg">

          <div className="flex items-center justify-between mb-4">

            <h2 className="text-xl font-bold">
              Maintenance Schedule (15 Days)
            </h2>

            <div className="bg-cyan-600 px-3 py-2 rounded-xl text-sm">
              PM Every 15 Days
            </div>

          </div>

          <table className="w-full text-sm">

            <thead className="text-left text-gray-400 border-b border-gray-700">

              <tr>

                <th className="py-3">Machine</th>
                <th>Last PM</th>
                <th>Next PM</th>
                <th>Status</th>

              </tr>

            </thead>

            <tbody>

              {maintenanceSchedule.map((item, index) => (

                <tr
                  key={index}
                  className="border-b border-gray-800"
                >

                  <td className="py-3 font-semibold">
                    {item.machine}
                  </td>

                  <td>
                    {item.lastPM}
                  </td>

                  <td>
                    {item.nextPM}
                  </td>

                  <td>

                    <span
                      className={
                        item.status === "Overdue"
                          ? "bg-red-600 px-3 py-1 rounded-full text-xs"
                          : item.status === "Due Soon"
                          ? "bg-yellow-500 px-3 py-1 rounded-full text-xs"
                          : "bg-green-600 px-3 py-1 rounded-full text-xs"
                      }
                    >
                      {item.status}
                    </span>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </section>

      {/* ================= GRAPH SECTION ================= */}

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 px-8">

        {/* LINE GRAPH */}

        <div className="bg-[#1e293b] rounded-2xl p-4 col-span-2 shadow-lg">

          <h2 className="text-2xl font-bold mb-6">
            Machine Error Monitoring
          </h2>

          <div style={{ width: "100%", height: 320 }}>

            <ResponsiveContainer>

              <LineChart data={productionData}>

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="machine" />

                <YAxis />

                <Tooltip />

                <Line
                  type="monotone"
                  dataKey="error"
                  stroke="#ef4444"
                  strokeWidth={4}
                />

              </LineChart>

            </ResponsiveContainer>

          </div>

        </div>

        {/* PIE CHART */}

        <div className="bg-[#1e293b] rounded-2xl p-4 shadow-lg">

          <h2 className="text-2xl font-bold mb-6">
            Machine Status
          </h2>

          <div style={{ width: "100%", height: 320 }}>

            <ResponsiveContainer>

              <PieChart>

                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  label
                >

                  {statusData.map((entry, index) => (

                    <Cell
                      key={index}
                      fill={COLORS[index % COLORS.length]}
                    />

                  ))}

                </Pie>

                <Tooltip />

                <Legend />

              </PieChart>

            </ResponsiveContainer>

          </div>

        </div>

      </section>

      {/* ================= BAR GRAPH ================= */}

      <section className="px-8 mt-6">

        <div className="bg-[#1e293b] rounded-2xl p-4 shadow-lg">

          <h2 className="text-2xl font-bold mb-6">
            Downtime by Machine
          </h2>

          <div style={{ width: "100%", height: 320 }}>

            <ResponsiveContainer>

              <BarChart data={downtimeData}>

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="machine" />

                <YAxis />

                <Tooltip />

                <Bar
                  dataKey="time"
                  fill="#f59e0b"
                  radius={[10, 10, 0, 0]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>

      </section>

      {/* ================= LINE STATUS ================= */}

      <section className="px-8 mt-8">

        <h2 className="text-2xl font-bold mb-6">
          Production Lines
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

          {lines.map((line, index) => (

            <div
              key={index}
              className="bg-[#1e293b] rounded-2xl p-5 border border-gray-700 hover:border-cyan-400 transition shadow-lg"
            >

              <div className="flex items-center justify-between">

                <h3 className="text-3xl font-bold">
                  {line}
                </h3>

                <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>

              </div>

              <div className="mt-5 space-y-2 text-gray-300">

                <p>
                  Machines : 3
                </p>

                <p>
                  Alarm : 0
                </p>

                <p>
                  Downtime : 12m
                </p>

              </div>

              <button className="mt-5 w-full bg-cyan-600 hover:bg-cyan-500 py-3 rounded-xl font-semibold">
                View Detail
              </button>

            </div>

          ))}

        </div>

      </section>

      {/* ================= HISTORY TABLE ================= */}

      <section className="p-8">

        <div className="bg-[#1e293b] rounded-2xl p-4 shadow-lg">

          <div className="flex items-center justify-between mb-6">

            <h2 className="text-2xl font-bold">
              Maintenance History
            </h2>

            <button className="bg-green-600 hover:bg-green-500 px-5 py-3 rounded-xl">
              + Add Record
            </button>

          </div>

          <table className="w-full">

            <thead className="text-left text-gray-400 border-b border-gray-700">

              <tr>

                <th className="py-4">Date</th>
                <th>Line</th>
                <th>Machine</th>
                <th>Problem</th>
                <th>Technician</th>
                <th>Downtime</th>
                <th>Status</th>

              </tr>

            </thead>

            <tbody>

              {historyData.map((item: any, index) => (

                <tr
                  key={index}
                  className="border-b border-gray-800"
                >

                  <td className="py-4">
                    {item.date}
                  </td>

                  <td>
                    {item.line}
                  </td>

                  <td>
                    {item.machine}
                  </td>

                  <td>
                    {item.problem}
                  </td>

                  <td>
                    {item.technician}
                  </td>

                  <td>
                    {item.downtime}
                  </td>

                  <td>

                    <span className="bg-green-600 px-3 py-1 rounded-full text-sm">
                      {item.status}
                    </span>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </section>

    </main>

  );

}