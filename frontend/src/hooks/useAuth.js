"use client";
import { useState, useEffect, createContext, useContext } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [recruiter, setRecruiter] = useState(undefined); // undefined = loading

  useEffect(() => {
    fetch(`${API}/api/admin/me`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setRecruiter(data))
      .catch(() => setRecruiter(null));
  }, []);

  async function login(email, password) {
    const res = await fetch(`${API}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    setRecruiter(data);
    return data;
  }

  async function logout() {
    await fetch(`${API}/api/admin/logout`, { method: "POST", credentials: "include" });
    setRecruiter(null);
  }

  return (
    <AuthContext.Provider value={{ recruiter, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
