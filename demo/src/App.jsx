import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './admin/pages/Login.jsx'
import Dashboard from './admin/pages/Dashboard.jsx'
import Countries from './admin/pages/Countries.jsx'
import Tours from './admin/pages/Tours.jsx'
import Hotels from './admin/pages/Hotels.jsx'
import Offers from './admin/pages/Offers.jsx'
import NotFound from './admin/pages/NotFound.jsx'
import AdminLayout from './admin/components/AdminLayout.jsx'
import { RequireAdmin } from './admin/auth.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/login" element={<Login />} />

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="countries" element={<Countries />} />
        <Route path="tours" element={<Tours />} />
        <Route path="hotels" element={<Hotels />} />
        <Route path="offers" element={<Offers />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
