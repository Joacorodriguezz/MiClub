import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { StatusPage } from '../pages/StatusPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StatusPage />} />
        <Route path="/ingresar" element={<LoginPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <main className="page">
      <h1>MiClub</h1>
      <p className="banner" role="alert">
        Esta ruta no existe.
      </p>
      <p>
        <Link to="/">Volver al estado de la API</Link>
      </p>
    </main>
  );
}
