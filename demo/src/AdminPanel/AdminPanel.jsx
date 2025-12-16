import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AdminPanel.css'

const API = 'http://localhost:5000'

export default function AdminPanel() {
  const navigate = useNavigate()

  const [countries, setCountries] = useState([])
  const [tours, setTours] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin')
    if (!isAdmin) navigate('/admin')
  }, [navigate])

  const loadData = async () => {
    setLoading(true)
    try {
      const [countriesRes, toursRes] = await Promise.all([
        fetch(`${API}/admin/countries`),
        fetch(`${API}/admin/tours`)
      ])

      const countriesData = await countriesRes.json()
      const toursData = await toursRes.json()

      setCountries(countriesData)
      setTours(toursData)
    } catch (err) {
      console.error('Ошибка загрузки данных', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const logout = () => {
    localStorage.removeItem('isAdmin')
    navigate('/admin')
  }

  const deleteCountry = async (id) => {
    if (!window.confirm('Удалить страну?')) return
    await fetch(`${API}/admin/countries/${id}`, { method: 'DELETE' })
    loadData()
  }

  const deleteTour = async (id) => {
    if (!window.confirm('Удалить тур?')) return
    await fetch(`${API}/admin/tours/${id}`, { method: 'DELETE' })
    loadData()
  }

  if (loading) {
    return (
      <section className="admin-panel">
        <h1>Загрузка...</h1>
      </section>
    )
  }

  return (
    <section className="admin-panel">
      <header className="admin-header">
        <h1>Админ-панель Orion Tour</h1>
        <button className="admin-btn logout" onClick={logout}>
          Выйти
        </button>
      </header>

      {/* ================= COUNTRIES ================= */}
      <h2>Страны</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Флаг</th>
            <th>Название</th>
            <th>ISO</th>
            <th>Отелей</th>
            <th>Офферов</th>
            <th>Popular</th>
            <th>Score</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {countries.map(c => (
            <tr key={c.id}>
              <td>
                {c.flag_url ? (
                  <img src={c.flag_url} alt={c.name_ru} width="32" />
                ) : '—'}
              </td>
              <td>{c.name_ru}</td>
              <td>{c.iso_code}</td>
              <td>{c.hotels_count ?? 0}</td>
              <td>{c.offers_count ?? 0}</td>
              <td>{c.is_popular ? '✔' : '—'}</td>
              <td>{c.popularity_score}</td>
              <td>
                <button className="admin-btn danger" onClick={() => deleteCountry(c.id)}>
                  Удалить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ================= TOURS ================= */}
      <h2>Туры</h2>
      <div className="admin-tour-list">
        {tours.map(t => (
          <div className="admin-tour-card" key={t.id}>
            <img src={t.image_url} alt={t.title} />

            <div className="admin-tour-info">
              <h3>{t.title}</h3>
              <p>{t.country_name}</p>
              <p>
                💰 от {Number(t.price_from).toLocaleString('ru-RU')} ₽
                {' '}| ⭐ {Number(t.rating_avg).toFixed(1)}
                {' '}| 🎫 офферов: {t.offers_count}
              </p>
              {t.short_desc && <p className="muted">{t.short_desc}</p>}
            </div>

            <div className="admin-tour-flags">
              {t.is_hot && <span className="hot">🔥 Горящий</span>}
              <button className="admin-btn danger" onClick={() => deleteTour(t.id)}>
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
