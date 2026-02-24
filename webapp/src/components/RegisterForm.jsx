import React from "react";
import "./RegisterForm.css";

export default function RegisterForm({ onSubmit }) {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ username, password });
  };

  return (
    <form className="registerForm" onSubmit={handleSubmit}>
      <h2>Registro</h2>

      <input
        className="registerInput"
        type="text"
        placeholder="Usuario"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />

      <input
        className="registerInput"
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <button className="registerButton" type="submit">
        Continuar
      </button>
    </form>
  );
}
