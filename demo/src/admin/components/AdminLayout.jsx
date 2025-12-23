import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { logout } from '../auth.jsx'
import './AdminLayout.css'

export default function AdminLayout() {
  const navigate = useNavigate()

  const exit = () => {
    logout()
    navigate('/admin/login')
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">OrionTour Admin</div>

        <nav className="admin-nav">
          <NavLink to="/admin/dashboard">Дашборд</NavLink>
          <NavLink to="/admin/countries">Страны</NavLink>
          <NavLink to="/admin/tours">Туры</NavLink>
          <NavLink to="/admin/hotels">Отели</NavLink>
          <NavLink to="/admin/offers">Офферы</NavLink>
        </nav>

        <button className="admin-logout" onClick={exit}>Выйти</button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-header-title">Админ-панель</div>
          <div className="admin-header-sub">Управление контентом</div>
        </header>

        <section className="admin-content">
          <Outlet />
        </section>
      </main>
    </div>
  )
}
