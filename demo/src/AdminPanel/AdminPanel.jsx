import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AdminPanel.css'

export default function AdminPanel() {
    const navigate = useNavigate()

    const [countries, setCountries] = useState([])
    const [tours, setTours] = useState([])
    const [loading, setLoading] = useState(true)

    /* ==========================
       ЗАЩИТА ДОСТУПА
    ========================== */
    useEffect(() => {
        const isAdmin = localStorage.getItem('isAdmin')
        if (!isAdmin) {
            navigate('/admin')
        }
    }, [navigate])

    /* ==========================
       ЗАГРУЗКА ДАННЫХ
    ========================== */
    useEffect(() => {
        const loadData = async () => {
            try {
                const [countriesRes, toursRes] = await Promise.all([
                    fetch('http://localhost:5000/admin/countries'),
                    fetch('http://localhost:5000/admin/tours')
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

        loadData()
    }, [])

    const logout = () => {
        localStorage.removeItem('isAdmin')
        navigate('/admin')
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
            {/* ================= HEADER ================= */}
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
                        <th>Туров</th>
                        <th>Popular</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody>
                    {countries.map(country => (
                        <tr key={country.id}>
                            <td>
                                <img
                                    src={country.flag_url}
                                    alt={country.name_ru}
                                    width="32"
                                />
                            </td>
                            <td>{country.name_ru}</td>
                            <td>{country.iso_code}</td>
                            <td>{country.tours_count}</td>
                            <td>{country.is_popular ? '✔' : '—'}</td>
                            <td>{country.popularity_score}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* ================= TOURS ================= */}
            <h2>Туры</h2>
            <div className="admin-tour-list">
                {tours.map(tour => (
                    <div className="admin-tour-card" key={tour.id}>
                        <img
                            src={tour.image_url}
                            alt={tour.title}
                        />

                        <div className="admin-tour-info">
                            <h3>{tour.title}</h3>
                            <p>{tour.country_name}</p>
                            <p>
                                💰 от {tour.price_from} ₽ | ⭐ {tour.rating}
                            </p>
                        </div>

                        <div className="admin-tour-flags">
                            {tour.is_hot && <span className="hot">🔥 Горящий</span>}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}
