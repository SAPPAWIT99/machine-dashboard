export default function Home() {
  const lines = [
    "A01","A02","A03","A04",
    "A05","A06","A07","A08",
    "A09","A10","A11","A12",
    "B07","B10"
  ];

  return (
    <main className="min-h-screen bg-[#0f172a] text-white">

      {/* Topbar */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-gray-700">
        <div>
          <h1 className="text-3xl font-bold">
            MACHINE MAINTENANCE DASHBOARD
          </h1>

          <p className="text-gray-400 mt-1">
            Factory Monitoring System
          </p>
        </div>

        <div className="flex gap-4">
          <div className="bg-red-600 px-4 py-2 rounded-xl">
            Alarm 3
          </div>

          <div className="bg-green-600 px-4 py-2 rounded-xl">
            Running 28
          </div>
        </div>
      </div>

      {/* Summary */}
      <section className="grid grid-cols-4 gap-6 p-8">

        <div className="bg-[#1e293b] p-6 rounded-2xl">
          <h2 className="text-gray-400">
            Total Machines
          </h2>

          <p className="text-5xl font-bold mt-3">
            42
          </p>
        </div>

        <div className="bg-[#1e293b] p-6 rounded-2xl">
          <h2 className="text-gray-400">
            Breakdown Today
          </h2>

          <p className="text-5xl font-bold mt-3 text-red-500">
            5
          </p>
        </div>

        <div className="bg-[#1e293b] p-6 rounded-2xl">
          <h2 className="text-gray-400">
            Downtime
          </h2>

          <p className="text-5xl font-bold mt-3 text-yellow-400">
            128m
          </p>
        </div>

        <div className="bg-[#1e293b] p-6 rounded-2xl">
          <h2 className="text-gray-400">
            MTTR
          </h2>

          <p className="text-5xl font-bold mt-3 text-cyan-400">
            24m
          </p>
        </div>

      </section>

      {/* Line Status */}
      <section className="px-8">

        <h2 className="text-2xl font-bold mb-6">
          Production Lines
        </h2>

        <div className="grid grid-cols-4 gap-5">

          {lines.map((line, index) => (
            <div
              key={index}
              className="bg-[#1e293b] rounded-2xl p-5 border border-gray-700 hover:border-cyan-400 transition"
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

              <button className="mt-5 w-full bg-cyan-600 hover:bg-cyan-500 py-3 rounded-xl">
                View Detail
              </button>

            </div>
          ))}

        </div>

      </section>

      {/* History Table */}
      <section className="p-8">

        <div className="bg-[#1e293b] rounded-2xl p-6">

          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl font-bold">
              Maintenance History
            </h2>

            <button className="bg-green-600 px-5 py-2 rounded-xl">
              + Add Record
            </button>
          </div>

          <table className="w-full">

            <thead className="text-left text-gray-400 border-b border-gray-700">
              <tr>
                <th className="py-3">Date</th>
                <th>Line</th>
                <th>Machine</th>
                <th>Problem</th>
                <th>Technician</th>
                <th>Downtime</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>

              <tr className="border-b border-gray-800">
                <td className="py-4">26/05/2026</td>
                <td>A01</td>
                <td>Printer</td>
                <td>Motor Alarm</td>
                <td>John</td>
                <td>35m</td>
                <td>
                  <span className="bg-green-600 px-3 py-1 rounded-full text-sm">
                    Complete
                  </span>
                </td>
              </tr>

              <tr className="border-b border-gray-800">
                <td className="py-4">26/05/2026</td>
                <td>A04</td>
                <td>SPI</td>
                <td>Camera Error</td>
                <td>Mike</td>
                <td>18m</td>
                <td>
                  <span className="bg-yellow-500 px-3 py-1 rounded-full text-sm">
                    Waiting Part
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-4">26/05/2026</td>
                <td>B10</td>
                <td>Reflow</td>
                <td>Temperature Alarm</td>
                <td>Alex</td>
                <td>52m</td>
                <td>
                  <span className="bg-red-600 px-3 py-1 rounded-full text-sm">
                    Breakdown
                  </span>
                </td>
              </tr>

            </tbody>

          </table>

        </div>

      </section>

    </main>
  );
}