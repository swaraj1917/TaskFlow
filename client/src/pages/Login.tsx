import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      await login(email, password);
    } catch {
      setError("Invalid email or password");
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>TaskFlow</h1>
        <p>Project and task management</p>

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          required
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          required
        />

        {error && <div className="error">{error}</div>}

        <button type="submit">Login</button>

        <div className="demo-login">
          <strong>Demo accounts</strong>
          <span>Admin: admin@taskflow.com</span>
          <span>PM: pm1@taskflow.com</span>
          <span>Developer: dev1@taskflow.com</span>
          <small>Password: password123</small>
        </div>
      </form>
    </div>
  );
}