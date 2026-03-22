import React from "react";
import { useNavigate } from "react-router-dom";
import { fetchUserSuggestions, resolveUserExact } from "../services/leaderboardApi";
import useDebouncedValue from "../hooks/useDebouncedValue";

export default function UserSearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [suggestions, setSuggestions] = React.useState([]);
  const [error, setError] = React.useState("");
  const abortRef = React.useRef(null);
  const debouncedQuery = useDebouncedValue(query, 400);

  React.useEffect(() => {
    if (debouncedQuery.trim().length <= 3) {
      setSuggestions([]);
      setError("");
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    async function loadSuggestions() {
      try {
        setError("");
        const response = await fetchUserSuggestions({ query: debouncedQuery, signal: controller.signal });
        setSuggestions(response.items || []);
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        setSuggestions([]);
        setError("No se pudieron cargar sugerencias.");
      }
    }

    loadSuggestions();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery]);

  async function handleSubmit(event) {
    event.preventDefault();
    const normalized = query.trim();
    if (!normalized) {
      return;
    }

    try {
      const response = await resolveUserExact({ username: normalized });
      navigate(`/user/${encodeURIComponent(response.username)}`);
    } catch {
      setError("Usuario no encontrado");
    }
  }

  function handleSuggestionClick(username) {
    navigate(`/user/${encodeURIComponent(username)}`);
  }

  return (
    <div className="searchWrap">
      <form onSubmit={handleSubmit}>
        <input
          aria-label="Buscar usuario"
          className="searchInput"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar usuario..."
        />
      </form>

      {error ? <p className="errorText">{error}</p> : null}

      {suggestions.length ? (
        <ul className="suggestionsList" role="listbox" aria-label="Sugerencias de usuarios">
          {suggestions.map((username) => (
            <li key={username}>
              <button type="button" onClick={() => handleSuggestionClick(username)}>
                {username}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
