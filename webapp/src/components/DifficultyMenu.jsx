import React from "react";
import "./DifficultyMenu.css";


export default function DifficultyMenu({ onSelect }) {
  return (
    <div className= "difficultyMenu">
      <h2>Selecciona dificultad</h2>
      <div className= "difficultyButtons">
        <button className= "difficultyButton easy" onClick={() => onSelect("Facil")}>Fácil</button>
        <button className= "difficultyButton medium" onClick={() => onSelect("Media")}>Media</button>
        <button className= "difficultyButton hard" onClick={() => onSelect("Dificil")}>Difícil</button>
      </div>
    </div>
  );
}