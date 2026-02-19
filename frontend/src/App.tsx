import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ShowPage } from './pages/ShowPage';
import { PreviewPage } from './pages/PreviewPage';
import { EditorPage } from './pages/EditorPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlaysProvider } from './context/PlaysContext';

export default function App() {
  return (
    <PlaysProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<ShowPage />} />
            <Route path="preview" element={<PreviewPage />} />
            <Route path="editor" element={<EditorPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </PlaysProvider>
  );
}
