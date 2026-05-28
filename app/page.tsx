"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Home() {

  const router = useRouter();

  // ================= LOGIN =================

  useEffect(() => {

    const login = localStorage.getItem("login");

    if (login !== "true") {
      router.push("/login");
    }

  }, [router]);

  // ================= SELECT MACHINE =================

  const [selectedMachine, setSelectedMachine] =
    useState<string | null>(null);

  // ================= HISTORY DATA =================

  const [historyData, setHistoryData] = useState<any[]>([
    {
      date: "2026-05-20",
      line: "A01",
      machine: "Printer",
      problem: "Nozzle clog",
      technician: "Somchai",
      status: "Done",
    },
    {
      date: "2026-05-21",
      line: "A02",
      machine: "SPI",
      problem: "Camera calibration fail",
      technician: "Kanya",
      status: "Done",
    },
    {
      date: "2026-05-22",
      line: "A03",
      machine: "Reflow",
      problem: "Fan failure",
      technician: "Anan",
      status: "Done",
    },
    {
      date: "2026-05-23",
      line: "A04",
      machine: "AOI",
      problem: "Lens dirty",
      technician: "Prasert",
      status: "Done",
    },
    {
      date: "2026-05-24",
      line: "A05",
      machine: "Loader",
      problem: "Motor jam",
      technician: "Kanya",
      status: "Done",
    },
  ]);

  // ================= PM LIST =================

  const [pmList, setPmList] = useState([
    {
      line: "A01",
      last: "2026-05-01",
      next: "2026-06-01",
    },
    {
      line: "A02",
      last: "2026-05-03",
      next: "2026-05-30",
    },
    {
      line: "A03",
      last: "2026-05-05",
      next: "2026-05-28",
    },
    {
      line: "A04",
      last: "2026-05-10",
      next: "2026-06-05",
    },
    {
      line: "A05",
      last: "2026-05-12",
      next: "2026-06-08",
    },
  ]);

  // ================= FORM DATA =================

  const [formData, setFormData] = useState({
    date: "",
    line: "A01",
  });

  // ================= PM DATA =================

  const pmData = pmList.map((m) => {

    const today = new Date();

    const next = new Date(m.next);

    const remaining = Math.ceil(
      (next.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
    );

    return {
      ...m,
      remaining,
    };

  });

  // ================= ERROR SUMMARY =================

  const errorSummary = useMemo(() => {

    return Object.values(

      historyData.reduce((acc: any, item: any) => {

        const key = item.machine;

        if (!acc[key]) {

          acc[key] = {
            machine: key,
            count: 0,
            items: [],
          };

        }

        acc[key].count += 1;

        acc[key].items.push(item);

        return acc;

      }, {})

    );

  }, [historyData]);

  // ================= DETAIL DATA =================

  const detailData = selectedMachine
    ? historyData.filter(
        (d) => d.machine === selectedMachine
      )
    : [];

  // ================= COLORS =================

  const COLORS = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#3b82f6",
    "#a855f7",
  ];

  // ================= SAVE PM RECORD =================

  const savePMRecord = () => {

    if (!formData.date) {

      alert("Please select date");

      return;

    }

    // ================= NEXT PM +15 DAYS =================

    const currentDate = new Date(formData.date);

    const nextPM = new Date(currentDate);

    nextPM.setDate(nextPM.getDate() + 15);

    const nextPMString =
      nextPM.toISOString().split("T")[0];

    // ================= UPDATE PM LIST =================

    const updatedPM = pmList.map((item: any) => {

      if (item.line === formData.line) {

        return {

          ...item,
          last: formData.date,
          next: nextPMString,

        };

      }

      return item;

    });

    setPmList(updatedPM);

    // ================= ADD HISTORY =================

    const newRecord = {

      date: formData.date,
      line: formData.line,
      machine: "FULL LINE PM",
      problem: "Preventive Maintenance",
      technician: "Maintenance Team",
      status: "Done",

    };

    setHistoryData([
      newRecord,
      ...historyData,
    ]);

    // ================= RESET FORM =================

    setFormData({
      date: "",
      line: "A01",
    });

  };

  return (

    <main className="min-h-screen bg-slate-950 text-white p-6">

      {/* ================= HEADER ================= */}

      <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">

        <div>

          <h1 className="text-4xl font-bold">
            SMT Maintenance Dashboard
          </h1>

          <p className="text-gray-400 mt-2">
            Real-time SMT Factory Maintenance System
          </p>

        </div>

        <button
          onClick={() => {

            localStorage.removeItem("login");

            router.push("/login");

          }}
          className="bg-red-600 hover:bg-red-500 px-5 py-3 rounded-xl"
        >
          Logout
        </button>

      </div>

      {/* ================= MAINTENANCE SCHEDULE ================= */}

      <section className="mb-8">

        <h2 className="text-2xl font-bold mb-5">
          Maintenance Schedule
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {pmData
            .sort((a, b) => a.remaining - b.remaining)
            .slice(0, 3)
            .map((item, i) => (

            <div
              key={i}
              className={
                item.remaining <= 0
                  ? "bg-red-600 p-5 rounded-2xl shadow-lg"
                  : item.remaining <= 3
                  ? "bg-yellow-500 p-5 rounded-2xl shadow-lg"
                  : "bg-green-600 p-5 rounded-2xl shadow-lg"
              }
            >

              <h3 className="text-3xl font-bold">
                LINE {item.line}
              </h3>

              <div className="mt-4 space-y-2">

                <p>
                  Last PM : {item.last}
                </p>

                <p>
                  Next PM : {item.next}
                </p>

              </div>

              <p className="text-2xl font-bold mt-5">

                {item.remaining <= 0
                  ? `OVERDUE ${Math.abs(item.remaining)} DAYS`
                  : `${item.remaining} DAYS LEFT`}

              </p>

            </div>

          ))}

        </div>

      </section>

      {/* ================= ADD MAINTENANCE ================= */}

      <section className="bg-slate-900 border border-slate-700 p-6 rounded-2xl mb-8">

        <div className="flex justify-between items-center mb-5">

          <h2 className="text-2xl font-bold">
            Add Maintenance Record
          </h2>

          <div className="bg-cyan-600 px-4 py-2 rounded-xl text-sm">
            PM RECORD INPUT
          </div>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* DATE */}

          <input
            type="date"
            value={formData.date}
            onChange={(e) =>
              setFormData({
                ...formData,
                date: e.target.value,
              })
            }
            className="bg-slate-800 border border-slate-600 p-3 rounded-xl"
          />

          {/* LINE */}

          <select
            value={formData.line}
            onChange={(e) =>
              setFormData({
                ...formData,
                line: e.target.value,
              })
            }
            className="bg-slate-800 border border-slate-600 p-3 rounded-xl"
          >
            <option>A01</option>
            <option>A02</option>
            <option>A03</option>
            <option>A04</option>
            <option>A05</option>
            <option>A06</option>
            <option>A07</option>
            <option>A08</option>
            <option>A09</option>
            <option>A10</option>
          </select>

        </div>

        {/* SAVE BUTTON */}

        <button
          onClick={savePMRecord}
          className="mt-5 bg-green-600 hover:bg-green-500 px-6 py-3 rounded-xl font-bold"
        >
          SAVE PM RECORD
        </button>

      </section>

      {/* ================= BAR CHART ================= */}

      <section className="bg-slate-900 border border-slate-700 p-6 rounded-2xl mb-8">

        <h2 className="text-2xl font-bold mb-5">
          Machine Error Statistics
        </h2>

        <ResponsiveContainer width="100%" height={350}>

          <BarChart data={errorSummary}>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
            />

            <XAxis
              dataKey="machine"
              stroke="#94a3b8"
            />

            <YAxis stroke="#94a3b8" />

            <Tooltip />

            <Bar
              dataKey="count"
              fill="#ef4444"
              radius={[10, 10, 0, 0]}
              onClick={(data: any) => {
                setSelectedMachine(data.machine);
              }}
            />

          </BarChart>

        </ResponsiveContainer>

      </section>

      {/* ================= PIE CHART ================= */}

      <section className="bg-slate-900 border border-slate-700 p-6 rounded-2xl mb-8">

        <h2 className="text-2xl font-bold mb-5">
          Machine Error Distribution
        </h2>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* PIE */}

          <div style={{ width: "100%", height: 350 }}>

            <ResponsiveContainer>

              <PieChart>

                <Pie
                  data={errorSummary}
                  dataKey="count"
                  nameKey="machine"
                  outerRadius={120}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >

                  {errorSummary.map((entry: any, index) => (

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

          {/* SUMMARY */}

          <div className="space-y-3">

            {errorSummary.map((item: any, index) => {

              const total = errorSummary.reduce(
                (sum: number, d: any) => sum + d.count,
                0
              );

              const percent = (
                (item.count / total) * 100
              ).toFixed(0);

              return (

                <div
                  key={index}
                  className="bg-slate-800 p-4 rounded-xl flex justify-between items-center"
                >

                  <div>

                    <p className="font-bold text-lg">
                      {item.machine}
                    </p>

                    <p className="text-sm text-gray-400">
                      Error Distribution
                    </p>

                  </div>

                  <div className="text-3xl font-bold text-red-400">
                    {percent}%
                  </div>

                </div>

              );

            })}

          </div>

        </div>

      </section>

      {/* ================= MACHINE DETAIL ================= */}

      {selectedMachine && (

        <section className="bg-slate-900 border border-slate-700 p-6 rounded-2xl mb-8">

          <div className="flex justify-between items-center mb-5">

            <h2 className="text-2xl font-bold">
              Machine Detail : {selectedMachine}
            </h2>

            <button
              onClick={() =>
                setSelectedMachine(null)
              }
              className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg"
            >
              Close
            </button>

          </div>

          <table className="w-full text-sm">

            <thead className="text-gray-400 border-b border-slate-700">

              <tr>

                <th className="py-3 text-left">
                  Date
                </th>

                <th className="text-left">
                  Line
                </th>

                <th className="text-left">
                  Problem
                </th>

                <th className="text-left">
                  Technician
                </th>

                <th className="text-left">
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {detailData.map((item, i) => (

                <tr
                  key={i}
                  className="border-b border-slate-800"
                >

                  <td className="py-3">
                    {item.date}
                  </td>

                  <td>{item.line}</td>

                  <td>{item.problem}</td>

                  <td>{item.technician}</td>

                  <td>{item.status}</td>

                </tr>

              ))}

            </tbody>

          </table>

        </section>

      )}

      {/* ================= HISTORY ================= */}

      <section className="bg-slate-900 border border-slate-700 p-6 rounded-2xl">

        <h2 className="text-2xl font-bold mb-5">
          Maintenance History
        </h2>

        <table className="w-full text-sm">

          <thead className="text-gray-400 border-b border-slate-700">

            <tr>

              <th className="py-3 text-left">
                Date
              </th>

              <th className="text-left">
                Line
              </th>

              <th className="text-left">
                Machine
              </th>

              <th className="text-left">
                Problem
              </th>

              <th className="text-left">
                Technician
              </th>

              <th className="text-left">
                Status
              </th>

            </tr>

          </thead>

          <tbody>

            {historyData.map((item, i) => (

              <tr
                key={i}
                className="border-b border-slate-800"
              >

                <td className="py-3">
                  {item.date}
                </td>

                <td>{item.line}</td>

                <td>{item.machine}</td>

                <td>{item.problem}</td>

                <td>{item.technician}</td>

                <td>

                  <span
                    className={
                      item.status === "Done"
                        ? "bg-green-600 px-3 py-1 rounded-full text-xs"
                        : item.status === "Repairing"
                        ? "bg-yellow-500 px-3 py-1 rounded-full text-xs"
                        : "bg-red-600 px-3 py-1 rounded-full text-xs"
                    }
                  >
                    {item.status}
                  </span>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </section>

    </main>
  );
}