import React from 'react';
import "./App.css";

import RegisterForm from "./components/RegisterForm";
import DifficultyMenu from "./components/DifficultyMenu";
import GameBoard from "./components/GameBoard";

function App() {
  const [user, setUser] = React.useState(null);
  const [difficulty, setDifficulty] = React.useState(null);

  return (
    <div className="App">
      <h1>Juego Y</h1>

      {!user ? (
        <RegisterForm onSubmit={setUser} />
      ) : !difficulty ? (
        <DifficultyMenu onSelect={setDifficulty} />
      ) : (
        <GameBoard user={user} difficulty={difficulty} />
      )}
    </div>
  );
}

export default App;


//    <RegisterForm /> lo quito para probar <RegisterForm />