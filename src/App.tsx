import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import Audience from './pages/Audience';
import Solo from './pages/Solo';

const Screen = lazy(() => import('./pages/Screen'));
const Admin = lazy(() => import('./pages/Admin'));

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/screen" element={<Screen />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/solo" element={<Solo />} />
          <Route path="*" element={<Audience />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
