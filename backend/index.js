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

/* ==========================
   ADMIN LOGIN (простая проверка)
========================== */
app.post('/admin/login', (req, res) => {
  const { login, password } = req.body;
  if (login === 'admin' && password === 'admin') return res.json({ success: true });
  return res.status(401).json({ success: false, message: 'Неверные данные' });
});

/* ==========================
   COUNTRIES (CRUD)
========================== */

// список стран для админки (с маркерами)
app.get('/admin/countries', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT *
      FROM globe_markers
      ORDER BY popularity_score DESC, name_ru ASC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка получения стран' });
  }
});

// создать страну (upsert по iso_code)
app.post('/admin/countries', async (req, res) => {
  try {
    const { name_ru, name_en, iso_code, lat, lng, flag_url, is_popular, popularity_score } = req.body;

    const { rows } = await pool.query(`
      INSERT INTO country (name_ru, name_en, iso_code, lat, lng, flag_url, is_popular, popularity_score)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (iso_code) DO UPDATE SET
        name_ru = EXCLUDED.name_ru,
        name_en = EXCLUDED.name_en,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        flag_url = EXCLUDED.flag_url,
        is_popular = EXCLUDED.is_popular,
        popularity_score = EXCLUDED.popularity_score,
        updated_at = now()
      RETURNING *
    `, [name_ru, name_en, iso_code, lat, lng, flag_url, is_popular, popularity_score]);

    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка добавления/обновления страны' });
  }
});

// обновить страну по id
app.put('/admin/countries/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name_ru, name_en, iso_code, lat, lng, flag_url, is_popular, popularity_score } = req.body;

    const { rows } = await pool.query(`
      UPDATE country SET
        name_ru=$1, name_en=$2, iso_code=$3, lat=$4, lng=$5,
        flag_url=$6, is_popular=$7, popularity_score=$8, updated_at=now()
      WHERE id=$9
      RETURNING *
    `, [name_ru, name_en, iso_code, lat, lng, flag_url, is_popular, popularity_score, id]);

    if (!rows[0]) return res.status(404).json({ message: 'Страна не найдена' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка обновления страны' });
  }
});

// удалить страну по id
app.delete('/admin/countries/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(`DELETE FROM country WHERE id=$1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Страна не найдена' });
    res.sendStatus(204);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка удаления страны' });
  }
});

/* ==========================
   TOURS (CRUD) + агрегаты по предложениям
   price_from и rating_avg считаем через tour_offer + hotel_listing
========================== */

// список туров (с price_from и rating_avg из офферов)
app.get('/admin/tours', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        t.id,
        t.title,
        t.short_desc,
        t.image_url,
        t.is_hot,
        t.country_id,
        c.name_ru AS country_name,

        -- цена "от" по офферам, привязанным к этому tour
        COALESCE(MIN(o.price), 0) AS price_from,

        -- рейтинг: средний рейтинг отелей, которые встречаются в офферах этого tour
        COALESCE(AVG(hl.rating_avg), 0)::numeric(3,1) AS rating_avg,

        -- сколько офферов у тура
        COUNT(o.id) AS offers_count
      FROM tour t
      JOIN country c ON c.id = t.country_id
      LEFT JOIN tour_offer o ON o.tour_id = t.id
      LEFT JOIN hotel_listing hl ON hl.hotel_id = o.hotel_id
      GROUP BY t.id, c.name_ru
      ORDER BY t.id DESC
    `);

    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка получения туров' });
  }
});

// создать/обновить тур (upsert по (title, country_id))
app.post('/admin/tours', async (req, res) => {
  try {
    const { title, short_desc, country_id, image_url, is_hot } = req.body;

    // убедись, что у тебя есть уникальность по (title, country_id) или убери ON CONFLICT
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_tour_title_country
      ON tour (title, country_id)
    `);

    const { rows } = await pool.query(`
      INSERT INTO tour (title, short_desc, country_id, image_url, is_hot)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (title, country_id) DO UPDATE SET
        short_desc = EXCLUDED.short_desc,
        image_url = EXCLUDED.image_url,
        is_hot = EXCLUDED.is_hot,
        updated_at = now()
      RETURNING *
    `, [title, short_desc, country_id, image_url, is_hot]);

    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка добавления/обновления тура' });
  }
});

app.put('/admin/tours/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, short_desc, country_id, image_url, is_hot } = req.body;

    const { rows } = await pool.query(`
      UPDATE tour SET
        title=$1, short_desc=$2, country_id=$3, image_url=$4, is_hot=$5, updated_at=now()
      WHERE id=$6
      RETURNING *
    `, [title, short_desc, country_id, image_url, is_hot, id]);

    if (!rows[0]) return res.status(404).json({ message: 'Тур не найден' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка обновления тура' });
  }
});

app.delete('/admin/tours/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(`DELETE FROM tour WHERE id=$1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ message: 'Тур не найден' });
    res.sendStatus(204);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Ошибка удаления тура' });
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
