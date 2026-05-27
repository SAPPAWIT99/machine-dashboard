"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {

  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {

    if (username === "admin" && password === "1234") {

      localStorage.setItem("login", "true");

      router.push("/");

    } else {

      setError("Username หรือ Password ไม่ถูกต้อง");

    }

  };

  return (

    <main className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">

      <div className="bg-[#1e293b] p-8 rounded-2xl shadow-lg w-full max-w-md">

        <h1 className="text-3xl font-bold mb-6 text-center">
          MACHINE LOGIN
        </h1>

        <div className="space-y-4">

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 rounded-xl bg-[#0f172a] border border-gray-700"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl bg-[#0f172a] border border-gray-700"
          />

          {error && (
            <p className="text-red-500 text-sm">
              {error}
            </p>
          )}

          <button
            onClick={handleLogin}
            className="w-full bg-cyan-600 hover:bg-cyan-500 py-3 rounded-xl font-semibold"
          >
            LOGIN
          </button>

        </div>

      </div>

    </main>

  );

}