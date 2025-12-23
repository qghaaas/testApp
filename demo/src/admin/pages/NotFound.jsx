import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{ padding: 20 }}>
      <h2>Страница не найдена</h2>
      <Link to="/admin/dashboard">В админку</Link>
    </div>
  )
}
