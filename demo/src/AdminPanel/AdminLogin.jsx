import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AdminLogin.css'

export default function AdminLogin() {
    const [login, setLogin] = useState('')
    const [password, setPassword] = useState('')
    const navigate = useNavigate()

    const submit = async (e) => {
        e.preventDefault()

        const res = await fetch('http://localhost:5000/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        })

        if (res.ok) {
            localStorage.setItem('isAdmin', 'true')
            navigate('/admin/panel')
        } else {
            alert('Неверный логин или пароль')
        }
    }

    return (
        <section className="admin-login">
            <form onSubmit={submit}>
                <h1>Admin Login</h1>

                <input
                    value={login}
                    onChange={e => setLogin(e.target.value)}
                    placeholder="Login"
                />

                <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                />

                <button type="submit">Войти</button>
            </form>
        </section>
    )
}
