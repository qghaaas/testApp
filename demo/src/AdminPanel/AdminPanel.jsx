import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AdminPanel.css'

const API = 'http://localhost:5000'

const NAV = [
  {
    title: 'Справочники',
    items: [
      { key: 'countries', label: 'Страны' },
      { key: 'meta', label: 'Справочники (read-only)' },
    ]
  },
  {
    title: 'Контент',
    items: [
      { key: 'tours', label: 'Туры' },
      { key: 'hotels', label: 'Отели' },
    ]
  },
  {
    title: 'Продажи',
    items: [
      { key: 'offers', label: 'Офферы' },
    ]
  },
]

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('ru-RU');
};

function formatNum(v) {
  const n = Number(v)
  if (Number.isNaN(n)) return '0'
  return n.toLocaleString('ru-RU')
}

async function apiJson(url, options) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `HTTP ${res.status}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return null
}

export default function AdminPanel() {
  const navigate = useNavigate()

  const [active, setActive] = useState('countries')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // data
  const [meta, setMeta] = useState({
    countries: [],
    resorts: [],
    departureCities: [],
    mealPlans: [],
    currencies: [],
  })
  const [countries, setCountries] = useState([])
  const [tours, setTours] = useState([])
  const [hotels, setHotels] = useState([])
  const [offers, setOffers] = useState([])

  const [q, setQ] = useState('')

  const [showCreate, setShowCreate] = useState(false)

  const [newCountry, setNewCountry] = useState({
    name_ru: '',
    name_en: '',
    iso_code: '',
    lat: '',
    lng: '',
    flag_url: '',
    is_popular: false,
    popularity_score: 0,
  })

  const [newTour, setNewTour] = useState({
    title: '',
    short_desc: '',
    country_id: '',
    image_url: '',
    is_hot: false,
  })

  const [newHotel, setNewHotel] = useState({
    country_id: '',
    resort_id: '',
    name: '',
    stars: 4,
    address: '',
    lat: '',
    lng: '',
    description: '',
  })

  const [newOffer, setNewOffer] = useState({
    tour_id: '',
    hotel_id: '',
    departure_city_id: '',
    start_date: '',
    nights: 7,
    meal_plan_id: '',
    price: '',
    currency_code: 'RUB',
    includes_flight: true,
    is_available: true,
    available_seats: '',
  })

  useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin')
    if (!isAdmin) navigate('/admin')
  }, [navigate])

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [metaData, countriesData, toursData, hotelsData, offersData] = await Promise.all([
        apiJson(`${API}/admin/meta`),
        apiJson(`${API}/admin/countries`),
        apiJson(`${API}/admin/tours`),
        apiJson(`${API}/admin/hotels`),
        apiJson(`${API}/admin/offers`),
      ])

      setMeta(metaData || meta)
      setCountries(countriesData || [])
      setTours(toursData || [])
      setHotels(hotelsData || [])
      setOffers(offersData || [])
    } catch (e) {
      console.error(e)
      setError('Ошибка загрузки данных. Проверь бек и эндпоинты /admin/meta, /admin/hotels, /admin/offers.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const logout = () => {
    localStorage.removeItem('isAdmin')
    navigate('/admin')
  }

  const deleteCountry = async (id) => {
    if (!window.confirm('Удалить страну?')) return
    await apiJson(`${API}/admin/countries/${id}`, { method: 'DELETE' })
    loadAll()
  }

  const deleteTour = async (id) => {
    if (!window.confirm('Удалить тур?')) return
    await apiJson(`${API}/admin/tours/${id}`, { method: 'DELETE' })
    loadAll()
  }

  const deleteHotel = async (id) => {
    if (!window.confirm('Удалить отель? (удалятся и офферы/отзывы из-за FK)')) return
    await apiJson(`${API}/admin/hotels/${id}`, { method: 'DELETE' })
    loadAll()
  }

  const deleteOffer = async (id) => {
    if (!window.confirm('Удалить оффер?')) return
    await apiJson(`${API}/admin/offers/${id}`, { method: 'DELETE' })
    loadAll()
  }

  const createCountry = async (e) => {
    e.preventDefault()
    const payload = {
      ...newCountry,
      iso_code: (newCountry.iso_code || '').toUpperCase().trim(),
      lat: Number(newCountry.lat),
      lng: Number(newCountry.lng),
      popularity_score: Number(newCountry.popularity_score || 0),
    }
    await apiJson(`${API}/admin/countries`, { method: 'POST', body: JSON.stringify(payload) })
    setNewCountry({
      name_ru: '', name_en: '', iso_code: '', lat: '', lng: '',
      flag_url: '', is_popular: false, popularity_score: 0
    })
    loadAll()
  }

  const createTour = async (e) => {
    e.preventDefault()
    const payload = {
      ...newTour,
      country_id: Number(newTour.country_id),
      is_hot: !!newTour.is_hot
    }
    await apiJson(`${API}/admin/tours`, { method: 'POST', body: JSON.stringify(payload) })
    setNewTour({ title: '', short_desc: '', country_id: '', image_url: '', is_hot: false })
    loadAll()
  }

  const createHotel = async (e) => {
    e.preventDefault()
    const payload = {
      ...newHotel,
      country_id: Number(newHotel.country_id),
      resort_id: newHotel.resort_id ? Number(newHotel.resort_id) : null,
      stars: newHotel.stars ? Number(newHotel.stars) : null,
      lat: newHotel.lat === '' ? null : Number(newHotel.lat),
      lng: newHotel.lng === '' ? null : Number(newHotel.lng),
    }
    await apiJson(`${API}/admin/hotels`, { method: 'POST', body: JSON.stringify(payload) })
    setNewHotel({ country_id: '', resort_id: '', name: '', stars: 4, address: '', lat: '', lng: '', description: '' })
    loadAll()
  }

  const createOffer = async (e) => {
    e.preventDefault()
    const payload = {
      ...newOffer,
      tour_id: newOffer.tour_id ? Number(newOffer.tour_id) : null,
      hotel_id: Number(newOffer.hotel_id),
      departure_city_id: Number(newOffer.departure_city_id),
      nights: Number(newOffer.nights),
      meal_plan_id: newOffer.meal_plan_id ? Number(newOffer.meal_plan_id) : null,
      price: Number(newOffer.price),
      currency_code: (newOffer.currency_code || 'RUB').toUpperCase(),
      includes_flight: !!newOffer.includes_flight,
      is_available: !!newOffer.is_available,
      available_seats: newOffer.available_seats === '' ? null : Number(newOffer.available_seats),
    }
    await apiJson(`${API}/admin/offers`, { method: 'POST', body: JSON.stringify(payload) })
    setNewOffer({
      tour_id: '',
      hotel_id: '',
      departure_city_id: '',
      start_date: '',
      nights: 7,
      meal_plan_id: '',
      price: '',
      currency_code: 'RUB',
      includes_flight: true,
      is_available: true,
      available_seats: '',
    })
    loadAll()
  }

  const qLower = q.trim().toLowerCase()

  const filteredCountries = useMemo(() => {
    if (!qLower) return countries
    return countries.filter(c =>
      (c.name_ru || '').toLowerCase().includes(qLower) ||
      (c.name_en || '').toLowerCase().includes(qLower) ||
      (c.iso_code || '').toLowerCase().includes(qLower)
    )
  }, [countries, qLower])

  const filteredTours = useMemo(() => {
    if (!qLower) return tours
    return tours.filter(t =>
      (t.title || '').toLowerCase().includes(qLower) ||
      (t.country_name || '').toLowerCase().includes(qLower)
    )
  }, [tours, qLower])

  const filteredHotels = useMemo(() => {
    if (!qLower) return hotels
    return hotels.filter(h =>
      (h.name || '').toLowerCase().includes(qLower) ||
      (h.country_name || '').toLowerCase().includes(qLower) ||
      (h.resort_name || '').toLowerCase().includes(qLower)
    )
  }, [hotels, qLower])

  const filteredOffers = useMemo(() => {
    if (!qLower) return offers
    return offers.filter(o =>
      (o.hotel_name || '').toLowerCase().includes(qLower) ||
      (o.tour_title || '').toLowerCase().includes(qLower) ||
      (o.departure_city_name || '').toLowerCase().includes(qLower) ||
      String(o.start_date || '').includes(qLower)
    )
  }, [offers, qLower])

  const resortsByCountry = useMemo(() => {
    const map = new Map()
    for (const r of meta.resorts || []) {
      if (!map.has(r.country_id)) map.set(r.country_id, [])
      map.get(r.country_id).push(r)
    }
    return map
  }, [meta.resorts])

  const resortsForSelectedHotelCountry = useMemo(() => {
    const cid = Number(newHotel.country_id || 0)
    return resortsByCountry.get(cid) || []
  }, [newHotel.country_id, resortsByCountry])

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
        <div className="admin-header-left">
          <h1>Админ-панель Orion Tour</h1>
          {error && <div className="admin-error">{error}</div>}
        </div>

        <div className="admin-header-actions">
          <button className="admin-btn" onClick={() => loadAll()}>Обновить</button>
          <button className="admin-btn" onClick={() => setShowCreate(v => !v)}>
            {showCreate ? 'Скрыть формы' : 'Добавить данные'}
          </button>
          <button className="admin-btn logout" onClick={logout}>Выйти</button>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-nav">
          <div className="admin-search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по текущему разделу…"
            />
          </div>

          {NAV.map(group => (
            <div className="admin-nav-group" key={group.title}>
              <div className="admin-nav-title">{group.title}</div>
              {group.items.map(item => (
                <button
                  key={item.key}
                  className={`admin-nav-item ${active === item.key ? 'active' : ''}`}
                  onClick={() => setActive(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <main className="admin-content">

          {showCreate && (
            <div className="admin-forms">
              <div className="admin-form-card">
                <h3>➕ Страна</h3>
                <form onSubmit={createCountry} className="admin-form">
                  <input placeholder="name_ru" value={newCountry.name_ru} onChange={e => setNewCountry(s => ({ ...s, name_ru: e.target.value }))} required />
                  <input placeholder="name_en" value={newCountry.name_en} onChange={e => setNewCountry(s => ({ ...s, name_en: e.target.value }))} required />
                  <input placeholder="iso_code (TR)" value={newCountry.iso_code} onChange={e => setNewCountry(s => ({ ...s, iso_code: e.target.value }))} required />
                  <div className="admin-form-row">
                    <input placeholder="lat" value={newCountry.lat} onChange={e => setNewCountry(s => ({ ...s, lat: e.target.value }))} required />
                    <input placeholder="lng" value={newCountry.lng} onChange={e => setNewCountry(s => ({ ...s, lng: e.target.value }))} required />
                  </div>
                  <input placeholder="flag_url" value={newCountry.flag_url} onChange={e => setNewCountry(s => ({ ...s, flag_url: e.target.value }))} />
                  <div className="admin-form-row">
                    <label className="admin-check">
                      <input type="checkbox" checked={newCountry.is_popular} onChange={e => setNewCountry(s => ({ ...s, is_popular: e.target.checked }))} />
                      popular
                    </label>
                    <input
                      placeholder="popularity_score"
                      value={newCountry.popularity_score}
                      onChange={e => setNewCountry(s => ({ ...s, popularity_score: e.target.value }))}
                    />
                  </div>
                  <button className="admin-btn" type="submit">Сохранить</button>
                </form>
              </div>

              <div className="admin-form-card">
                <h3>➕ Тур</h3>
                <form onSubmit={createTour} className="admin-form">
                  <input placeholder="title" value={newTour.title} onChange={e => setNewTour(s => ({ ...s, title: e.target.value }))} required />
                  <textarea placeholder="short_desc" value={newTour.short_desc} onChange={e => setNewTour(s => ({ ...s, short_desc: e.target.value }))} />
                  <select value={newTour.country_id} onChange={e => setNewTour(s => ({ ...s, country_id: e.target.value }))} required>
                    <option value="">Страна…</option>
                    {meta.countries.map(c => <option key={c.id} value={c.id}>{c.name_ru} ({c.iso_code})</option>)}
                  </select>
                  <input placeholder="image_url" value={newTour.image_url} onChange={e => setNewTour(s => ({ ...s, image_url: e.target.value }))} />
                  <label className="admin-check">
                    <input type="checkbox" checked={newTour.is_hot} onChange={e => setNewTour(s => ({ ...s, is_hot: e.target.checked }))} />
                    🔥 Горящий
                  </label>
                  <button className="admin-btn" type="submit">Сохранить</button>
                </form>
              </div>

              <div className="admin-form-card">
                <h3>➕ Отель</h3>
                <form onSubmit={createHotel} className="admin-form">
                  <select value={newHotel.country_id} onChange={e => setNewHotel(s => ({ ...s, country_id: e.target.value, resort_id: '' }))} required>
                    <option value="">Страна…</option>
                    {meta.countries.map(c => <option key={c.id} value={c.id}>{c.name_ru}</option>)}
                  </select>

                  <select value={newHotel.resort_id} onChange={e => setNewHotel(s => ({ ...s, resort_id: e.target.value }))}>
                    <option value="">Курорт (опц.)…</option>
                    {resortsForSelectedHotelCountry.map(r => <option key={r.id} value={r.id}>{r.name_ru}</option>)}
                  </select>

                  <input placeholder="name" value={newHotel.name} onChange={e => setNewHotel(s => ({ ...s, name: e.target.value }))} required />
                  <input placeholder="stars (1-5)" value={newHotel.stars} onChange={e => setNewHotel(s => ({ ...s, stars: e.target.value }))} />
                  <input placeholder="address" value={newHotel.address} onChange={e => setNewHotel(s => ({ ...s, address: e.target.value }))} />
                  <div className="admin-form-row">
                    <input placeholder="lat (опц.)" value={newHotel.lat} onChange={e => setNewHotel(s => ({ ...s, lat: e.target.value }))} />
                    <input placeholder="lng (опц.)" value={newHotel.lng} onChange={e => setNewHotel(s => ({ ...s, lng: e.target.value }))} />
                  </div>
                  <textarea placeholder="description" value={newHotel.description} onChange={e => setNewHotel(s => ({ ...s, description: e.target.value }))} />
                  <button className="admin-btn" type="submit">Сохранить</button>
                </form>
              </div>

              <div className="admin-form-card">
                <h3>➕ Оффер</h3>
                <form onSubmit={createOffer} className="admin-form">
                  <select value={newOffer.tour_id} onChange={e => setNewOffer(s => ({ ...s, tour_id: e.target.value }))}>
                    <option value="">Тур (опц.)…</option>
                    {tours.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>

                  <select value={newOffer.hotel_id} onChange={e => setNewOffer(s => ({ ...s, hotel_id: e.target.value }))} required>
                    <option value="">Отель…</option>
                    {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>

                  <select value={newOffer.departure_city_id} onChange={e => setNewOffer(s => ({ ...s, departure_city_id: e.target.value }))} required>
                    <option value="">Город вылета…</option>
                    {meta.departureCities.map(dc => <option key={dc.id} value={dc.id}>{dc.name_ru}</option>)}
                  </select>

                  <div className="admin-form-row">
                    <input type="date" value={newOffer.start_date} onChange={e => setNewOffer(s => ({ ...s, start_date: e.target.value }))} required />
                    <input placeholder="nights" value={newOffer.nights} onChange={e => setNewOffer(s => ({ ...s, nights: e.target.value }))} required />
                  </div>

                  <select value={newOffer.meal_plan_id} onChange={e => setNewOffer(s => ({ ...s, meal_plan_id: e.target.value }))}>
                    <option value="">Питание (опц.)…</option>
                    {meta.mealPlans.map(mp => <option key={mp.id} value={mp.id}>{mp.code} — {mp.name_ru}</option>)}
                  </select>

                  <div className="admin-form-row">
                    <input placeholder="price" value={newOffer.price} onChange={e => setNewOffer(s => ({ ...s, price: e.target.value }))} required />
                    <select value={newOffer.currency_code} onChange={e => setNewOffer(s => ({ ...s, currency_code: e.target.value }))}>
                      {meta.currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                    </select>
                  </div>

                  <div className="admin-form-row">
                    <label className="admin-check">
                      <input type="checkbox" checked={newOffer.includes_flight} onChange={e => setNewOffer(s => ({ ...s, includes_flight: e.target.checked }))} />
                      перелёт включён
                    </label>
                    <label className="admin-check">
                      <input type="checkbox" checked={newOffer.is_available} onChange={e => setNewOffer(s => ({ ...s, is_available: e.target.checked }))} />
                      доступен
                    </label>
                  </div>

                  <input
                    placeholder="available_seats (опц.)"
                    value={newOffer.available_seats}
                    onChange={e => setNewOffer(s => ({ ...s, available_seats: e.target.value }))}
                  />

                  <button className="admin-btn" type="submit">Сохранить</button>
                </form>
              </div>
            </div>
          )}

          {active === 'countries' && (
            <>
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
                  {filteredCountries.map(c => (
                    <tr key={c.id}>
                      <td>{c.flag_url ? <img src={c.flag_url} alt={c.name_ru} width="32" /> : '—'}</td>
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
            </>
          )}

          {active === 'tours' && (
            <>
              <h2>Туры</h2>
              <div className="admin-hint">
                ⚠️ price_from берётся как MIN(price) по офферам без конвертации валют.
              </div>
              <div className="admin-tour-list">
                {filteredTours.map(t => (
                  <div className="admin-tour-card" key={t.id}>
                    <img src={t.image_url} alt={t.title} />

                    <div className="admin-tour-info">
                      <h3>{t.title}</h3>
                      <p>{t.country_name}</p>
                      <p>
                        💰 от {formatNum(t.price_from)}
                        {' '}| ⭐ {Number(t.rating_avg || 0).toFixed(1)}
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
            </>
          )}

          {active === 'hotels' && (
            <>
              <h2>Отели</h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Превью</th>
                    <th>Отель</th>
                    <th>Страна</th>
                    <th>Курорт</th>
                    <th>⭐</th>
                    <th>Цена от</th>
                    <th>Рейтинг</th>
                    <th>Отзывы</th>
                    <th>Офферы</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHotels.map(h => (
                    <tr key={h.id}>
                      <td>{h.id}</td>
                      <td>
                        {h.preview_image_url ? (
                          <img className="admin-thumb" src={h.preview_image_url} alt={h.name} />
                        ) : '—'}
                      </td>
                      <td>
                        <div className="admin-strong">{h.name}</div>
                        {h.address && <div className="muted">{h.address}</div>}
                      </td>
                      <td>{h.country_name}</td>
                      <td>{h.resort_name || '—'}</td>
                      <td>{h.stars || '—'}</td>
                      <td>{formatNum(h.price_from || 0)}</td>
                      <td>{Number(h.rating_avg || 0).toFixed(1)}</td>
                      <td>{h.reviews_count ?? 0}</td>
                      <td>{h.offers_count ?? 0}</td>
                      <td>
                        <button className="admin-btn danger" onClick={() => deleteHotel(h.id)}>
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {active === 'offers' && (
            <>
              <h2>Офферы</h2>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Тур</th>
                    <th>Отель</th>
                    <th>Вылет</th>
                    <th>Дата</th>
                    <th>Ночей</th>
                    <th>Питание</th>
                    <th>Цена</th>
                    <th>Перелёт</th>
                    <th>Доступен</th>
                    <th>Мест</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOffers.map(o => (
                    <tr key={o.id}>
                      <td>{o.id}</td>
                      <td>{o.tour_title || '—'}</td>
                      <td>
                        <div className="admin-strong">{o.hotel_name}</div>
                        <div className="muted">⭐ {o.hotel_stars_cached ?? '—'}</div>
                      </td>
                      <td>{o.departure_city_name}</td>
                      <td>{formatDate(o.start_date)}</td>
                      <td>{o.nights}</td>
                      <td>{o.meal_plan_code || '—'}</td>
                      <td>{formatNum(o.price)} {o.currency_code}</td>
                      <td>{o.includes_flight ? '✔' : '—'}</td>
                      <td>{o.is_available ? '✔' : '—'}</td>
                      <td>{o.available_seats ?? '—'}</td>
                      <td>
                        <button className="admin-btn danger" onClick={() => deleteOffer(o.id)}>
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {active === 'meta' && (
            <>
              <h2>Справочники (read-only)</h2>

              <div className="admin-grid-2">
                <div className="admin-box">
                  <h3>Города вылета</h3>
                  <ul className="admin-list">
                    {meta.departureCities.map(dc => (
                      <li key={dc.id}>
                        <span className="admin-strong">{dc.name_ru}</span> <span className="muted">#{dc.id}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="admin-box">
                  <h3>Курорты</h3>
                  <ul className="admin-list">
                    {meta.resorts.map(r => (
                      <li key={r.id}>
                        <span className="admin-strong">{r.name_ru}</span>
                        <span className="muted"> (country_id: {r.country_id})</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="admin-box">
                  <h3>Питание</h3>
                  <ul className="admin-list">
                    {meta.mealPlans.map(mp => (
                      <li key={mp.id}>
                        <span className="admin-strong">{mp.code}</span> — {mp.name_ru}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="admin-box">
                  <h3>Валюты</h3>
                  <ul className="admin-list">
                    {meta.currencies.map(c => (
                      <li key={c.code}>
                        <span className="admin-strong">{c.code}</span> — {c.name_ru} <span className="muted">{c.symbol || ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}

        </main>
      </div>
    </section>
  )
}
