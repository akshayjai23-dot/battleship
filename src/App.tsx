import { RULES_VERSION } from './core/version';

export default function App() {
  return (
    <main>
      <h1>Battleship</h1>
      <p>Scaffold only — the game lands in the next pull requests.</p>
      <footer>rules v{RULES_VERSION}</footer>
    </main>
  );
}
