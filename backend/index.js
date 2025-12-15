const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
    host: 'localhost',
    user: 'postgres',
    database: 'postgres',
    password: '1234',
    port: 5432,
    options: '-c search_path=oriontour' 
});

app.post('/admin/login', (req, res) => {
    const { login, password } = req.body;

    if (login === 'admin' && password === 'admin') {
        return res.json({ success: true });
    }

    res.status(401).json({ success: false, message: 'Неверные данные' });
});

app.get('/admin/countries', async (req, res) => {
    const { rows } = await pool.query(`
        SELECT * FROM globe_markers
        ORDER BY popularity_score DESC
    `);
    res.json(rows);
});

app.post('/admin/countries', async (req, res) => {
    const {
        name_ru, name_en, iso_code, lat, lng,
        flag_url, is_popular, popularity_score
    } = req.body;

    await pool.query(`
        INSERT INTO country
        (name_ru, name_en, iso_code, lat, lng, flag_url, is_popular, popularity_score)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [
        name_ru, name_en, iso_code, lat, lng,
        flag_url, is_popular, popularity_score
    ]);

    res.sendStatus(201);
});

app.get('/admin/tours', async (req, res) => {
    const { rows } = await pool.query(`
        SELECT t.*, c.name_ru AS country_name
        FROM tour t
        JOIN country c ON c.id = t.country_id
        ORDER BY t.id DESC
    `);

    res.json(rows);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});