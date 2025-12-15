import { Routes, Route, BrowserRouter } from "react-router-dom"
import AdminPanel from "./AdminPanel/AdminPanel"
import AdminLogin from "./AdminPanel/AdminLogin"

export default function MainRouters() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/admin" element={<AdminLogin />} />
                <Route path="/admin/panel" element={<AdminPanel />} />
            </Routes>
        </BrowserRouter>
    )
}
